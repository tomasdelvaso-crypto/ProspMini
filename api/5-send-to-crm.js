const { createClient } = require('@supabase/supabase-js');

// Escalas PPVVCC en nivel 1 (prospecto recién identificado)
// Etapa 1A/1B del proceso Ventapel → empresa + contacto identificados
const SCALE_DESCRIPTIONS = {
    dor:      ["Não há identificação de necessidade","Vendedor assume necessidades","PC admite necessidade","PC admite razões e sintomas","PC admite dor","Vendedor documenta dor e PC concorda","PC formaliza necessidades do TD","TD admite necessidades","TD admite razões e sintomas","TD admite dor","Vendedor documenta dor e Power concorda"],
    poder:    ["TD não identificado","Processo de decisão revelado","TD Potencial identificado","Acesso a TD concedido","TD acessado","TD concorda em explorar","Processo confirmado pelo TD","TD concorda em fazer Prova de Valor","TD concorda com proposta","TD confirma aprovação verbal","TD aprova formalmente"],
    visao:    ["Nenhuma visão estabelecida","Visão em termos de produto","Visão em termos SPI","Visão diferenciada criada","Visão diferenciada documentada","Documentação concordada por PC","Visão Power em termos de produto","Visão Power em termos SPI","Visão diferenciada com TD","Visão documentada com TD","Documentação concordada por TD"],
    valor:    ["Valor não identificado","Vendedor identifica valor","PC concorda em explorar valor","TD concorda em explorar valor","Critérios de valor estabelecidos","Valor associado a visão TD","Análise de valor por vendedor","Análise de valor por PC","TD concorda com análise","Conclusão documentada","TD confirma por escrito"],
    controle: ["Nenhum follow documentado","1a visão enviada para PC","1a visão concordada por PC","1a visão enviada para TD","1a visão concordada por TD","Aprovação para explorar Valor","Plano de avaliação enviado","TD concorda com Avaliação","Plano conduzido","Resultado aprovado","TD aprova proposta final"],
    compras:  ["Processo desconhecido","Processo esclarecido por PC","Processo confirmado pelo TD","Condições validadas","Proposta apresentada","Negociação iniciada","Condições aprovadas","Contrato assinado","Pedido recebido","Cobrança emitida","Pagamento realizado"]
};

// ProspMini no tiene análisis Claude → escalas en nivel 1 (prospecto identificado)
// DOR=1 (vendedor asume necesidad), PODER=1 (proceso de decisión a revelar),
// VISAO=0, VALOR=0, CONTROLE=0, COMPRAS=0
function buildDefaultScales(contact) {
    // Si el contacto es Owner/CEO, PODER sube a 2 (TD Potencial identificado)
    const seniority = (contact.seniority || '').toLowerCase();
    const isDecisionMaker = ['owner', 'c_suite', 'founder'].includes(seniority);

    return {
        dor:      { score: 1, description: SCALE_DESCRIPTIONS.dor[1] + '. Prospecto identificado via ProspMini SC.' },
        poder:    { score: isDecisionMaker ? 2 : 1, description: SCALE_DESCRIPTIONS.poder[isDecisionMaker ? 2 : 1] + (isDecisionMaker ? ' (Owner/CEO identificado)' : '') },
        visao:    { score: 0, description: SCALE_DESCRIPTIONS.visao[0] },
        valor:    { score: 0, description: SCALE_DESCRIPTIONS.valor[0] },
        controle: { score: 0, description: SCALE_DESCRIPTIONS.controle[0] },
        compras:  { score: 0, description: SCALE_DESCRIPTIONS.compras[0] }
    };
}

// Estimativa de valor basada solo en datos de la empresa (sin análisis Claude)
function estimateValue(company) {
    const employees = company.estimated_num_employees || company.employees || 50;
    const industry = (company.industry || '').toLowerCase();

    let base = 0.08, min = 15;
    if (industry.includes('logistics') || industry.includes('fulfillment') || industry.includes('3pl')) { base = 0.6; min = 100; }
    else if (industry.includes('ecommerce') || industry.includes('retail'))                            { base = 0.4; min = 80; }
    else if (industry.includes('manufacturing') || industry.includes('food'))                          { base = 0.25; min = 50; }
    else if (industry.includes('automotive') || industry.includes('autopeças'))                        { base = 0.15; min = 40; }

    const boxesPerDay = Math.max(Math.round(employees * base), min);
    const rollsPerMonth = Math.ceil((boxesPerDay * 22) / 200);
    const monthlyValueBRL = rollsPerMonth * 45;

    return {
        boxesPerDay,
        rollsPerMonth,
        monthlyValueBRL,
        annualValueBRL: monthlyValueBRL * 12
    };
}

// Consolida emails de Apollo (free) y Lusha (enriched)
function extractEmails(contact) {
    const emailSet = new Set();

    // Apollo free (emails_apollo array)
    if (Array.isArray(contact.emails_apollo)) {
        contact.emails_apollo.forEach(e => { if (isValidEmail(e)) emailSet.add(e); });
    }
    // Lusha enriched (all_emails)
    if (Array.isArray(contact.all_emails)) {
        contact.all_emails.forEach(e => {
            const addr = (typeof e === 'string') ? e : e.email;
            if (isValidEmail(addr)) emailSet.add(addr);
        });
    }
    // Fallback: campo email directo
    if (isValidEmail(contact.email)) emailSet.add(contact.email);

    return [...emailSet];
}

// Consolida teléfonos de Apollo y Lusha
function extractPhones(contact) {
    const phoneSet = new Set();
    const phones = [];

    const addPhone = (number, type, source) => {
        if (number && !phoneSet.has(number)) {
            phones.push({ number, type: type || 'work', source });
            phoneSet.add(number);
        }
    };

    // Apollo free (phones_apollo array)
    if (Array.isArray(contact.phones_apollo)) {
        contact.phones_apollo.forEach(p => addPhone(p.number, p.type, 'Apollo'));
    }
    // Lusha enriched (all_phones)
    if (Array.isArray(contact.all_phones)) {
        contact.all_phones.forEach(p => addPhone(p.number, p.type, 'Lusha'));
    }
    // Fallback
    if (contact.phone) addPhone(contact.phone, 'work', 'Apollo');

    return phones;
}

function isValidEmail(addr) {
    return addr &&
        typeof addr === 'string' &&
        addr.includes('@') &&
        addr !== 'Não disponível' &&
        addr !== 'email_not_unlocked@domain.com';
}

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────

module.exports = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({
            success: false,
            error: 'Variáveis SUPABASE_URL e SUPABASE_ANON_KEY não configuradas no Vercel'
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { company, contact } = req.body;

        if (!company || !contact) {
            return res.status(400).json({ success: false, error: 'company e contact são obrigatórios' });
        }

        // 1. DEDUPLICACIÓN: buscar si ya existe oportunidad para esta empresa
        const { data: existingOpps } = await supabase
            .from('opportunities')
            .select('id, name, client, stage, vendor')
            .ilike('client', `%${company.name}%`);

        if (existingOpps && existingOpps.length > 0) {
            return res.status(200).json({
                success: false,
                already_exists: true,
                duplicates: existingOpps,
                message: `Já existe ${existingOpps.length} oportunidade(s) para ${company.name} no CRM`
            });
        }

        // 2. PREPARAR DATOS DE CONTACTO
        const validEmails = extractEmails(contact);
        const validPhones = extractPhones(contact);

        console.log('📧 Emails para CRM:', validEmails);
        console.log('📱 Phones para CRM:', validPhones.map(p => p.number));

        // 3. ESCALAS PPVVCC (default para prospectos nuevos)
        const scales = buildDefaultScales(contact);

        // 4. ESTIMATIVA DE VALOR
        const val = estimateValue(company);

        // 5. SPONSOR (contacto principal con cargo)
        const seniority = (contact.seniority || '').toLowerCase();
        const isOwner = ['owner', 'founder'].includes(seniority);
        const isCEO   = seniority === 'c_suite';

        let sponsorName = contact.name || null;
        if (sponsorName && contact.title) {
            sponsorName = `${contact.name} (${contact.title})`;
        }

        // 6. SUPPORT_CONTACT con todos los datos de contacto
        const supportParts = [];
        validEmails.forEach(e => supportParts.push(e));
        validPhones.forEach(p => supportParts.push(p.number));
        if (contact.linkedin_url) supportParts.push(contact.linkedin_url);

        // 7. NEXT_ACTION según datos disponibles
        const channel = validPhones.length > 0 ? 'via telefone/WhatsApp'
            : validEmails.length > 0           ? 'via email'
            : contact.linkedin_url             ? 'via LinkedIn'
            : 'realizar primeiro contato';

        const nextAction = `Contatar ${contact.name || 'decisor'} (${contact.title || 'N/A'}) ${channel} | Identificado via ProspMini SC`;

        // 8. FECHA DE CIERRE ESTIMADA
        // PME: ciclo más corto → 45 días (vs 90 del Prospector grande)
        const closeDate = new Date();
        closeDate.setDate(closeDate.getDate() + 45);

        // 9. PRIORIDAD basada en seniority + ciudad
        const isPriorityCity = ['Balneário Camboriú', 'Itajaí', 'Joinville', 'Blumenau'].includes(company.city || '');
        let priority = 'baixa';
        if (isOwner || isCEO) priority = isPriorityCity ? 'alta' : 'média';
        else if (isPriorityCity) priority = 'média';

        // 10. FUENTE: indica que viene de ProspMini (para tracking)
        const opportunityName = `Fita WAT - ${company.name}`;

        const opp = {
            name:            opportunityName,
            client:          company.name,
            vendor:          '',                                    // sin asignar
            value:           val.annualValueBRL,
            stage:           1,                                     // Etapa 1: Prospecção
            priority:        priority,
            probability:     0,
            last_update:     new Date().toISOString().split('T')[0],
            scales:          scales,
            expected_close:  closeDate.toISOString().split('T')[0],
            next_action:     nextAction,
            product:         'Fita WAT',
            power_sponsor:   null,
            sponsor:         isOwner || isCEO ? sponsorName : null,
            influencer:      (!isOwner && !isCEO) ? sponsorName : null,
            support_contact: supportParts.join(' | ') || null,
            industry:        company.industry || null
        };

        // 11. INSERT
        console.log(`Inserindo oportunidade: ${company.name} | Prioridade: ${priority} | Valor: R$${val.annualValueBRL.toLocaleString('pt-BR')}/ano`);

        const { data: created, error: insertError } = await supabase
            .from('opportunities')
            .insert([opp])
            .select()
            .single();

        if (insertError) throw insertError;

        console.log(`✅ Criada oportunidade #${created.id}`);

        return res.status(200).json({
            success: true,
            opportunity: created,
            valueEstimate: val,
            priority,
            contact_summary: {
                emails: validEmails.length,
                phones: validPhones.length,
                has_linkedin: !!contact.linkedin_url
            }
        });

    } catch (err) {
        console.error('Erro ao enviar para CRM:', err);
        return res.status(500).json({ success: false, error: err.message || 'Erro interno' });
    }
};
