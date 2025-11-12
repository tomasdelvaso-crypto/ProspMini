const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { company, contact, intel } = req.body;
        const apiKey = process.env.CLAUDE_API_KEY;

        if (!apiKey) {
            console.warn('Claude API key not found. Using fallback analysis.');
            return res.status(200).json(generateSmallCompanyFallback(company, contact, intel));
        }

        const anthropic = new Anthropic({ apiKey });

        // PROMPT ADAPTADO PARA PEQUEÑAS EMPRESAS
        const prompt = `
Você é um especialista em vendas B2B para PEQUENAS EMPRESAS com foco em Santa Catarina. Analise este prospecto PME com profundidade.

CONTEXTO VENTAPEL:
- Solução: Sistema BP555/BP755 + Cinta VENOM para fechamento inviolável
- Investimento PME: R$50k-150k (versão mais acessível para pequenas empresas)
- ROI típico PME: 8-15 meses
- Casos de sucesso PME: Redução 60% custos embalagem, 85% menos violações
- Vantagem PME: Implementação rápida (1-2 semanas vs 3-6 meses em grandes)

DADOS DO PROSPECTO:
Empresa: ${company?.name || 'Não identificada'}
- Cidade: ${company?.city || 'SC'}
- Indústria: ${company?.industry || 'Não especificada'}
- Funcionários: ${company?.estimated_num_employees || 'Desconhecido'}
- Receita estimada: ${company?.annual_revenue ? 'R$ ' + (company.annual_revenue / 1000000).toFixed(1) + 'M' : 'Pequeno porte'}

Contato: ${contact?.name || 'Não identificado'}
- Cargo: ${contact?.title || 'Não especificado'}
- Senioridade: ${contact?.seniority || 'Não identificada'}
- Email: ${contact?.email ? 'DISPONÍVEL' : 'NÃO DISPONÍVEL'}
- Telefone: ${contact?.phone ? 'DISPONÍVEL' : 'NÃO ENCONTRADO'}

INTELIGÊNCIA DE MERCADO:
${intel?.raw_intelligence || 'Dados limitados de pequena empresa'}

Score de Oportunidade: ${intel?.insights?.opportunity_score || 0}/100
Problemas Encontrados: ${intel?.insights?.key_pain_points || 0}
Sinais de Expansão: ${intel?.insights?.expansion_signals || 0}

ANÁLISE PPVVC PARA PME:

1. PAIN (0-10): 
   - PMEs têm dor aguda em violações (clientes menores = mais sensíveis)
   - Volume menor mas impacto proporcionalmente MAIOR
   - Dificuldade em achar soluções acessíveis
   - Se tem e-commerce = alta dor (7-9 pontos)
   - Se distribui produtos de valor = alta dor (7-8 pontos)

2. POWER (0-10): EM PME O POWER É DIFERENTE
   - Owner/CEO/Sócio = 10 pontos (decisão imediata!)
   - Diretor = 9 pontos (alta autonomia em PME)
   - Gerente = 7-8 pontos (mais poder que em grandes empresas)
   - Coordenador = 5-6 pontos (ainda tem voz em PME)

3. VISION (0-10): PME entende valor mais rápido
   - Owner/CEO = 9-10 (vê impacto no bottom line direto)
   - Gerente Ops/Log = 8-9 (sente dor no dia a dia)
   - Outros gerentes = 6-7
   - PME = MENOS BUROCRACIA = MAIS VISÃO DIRETA

4. VALUE (0-10): ROI é MELHOR em PME
   - 50-200 funcionários = 7-9 (sweet spot)
   - 200-500 funcionários = 6-8 (bom volume)
   - <50 funcionários = 4-6 (volume baixo mas implementação rápida)
   - E-commerce ativo = +2 pontos (necessidade crítica)

5. CONTROL (0-10): URGÊNCIA em PME
   - Problemas severos = 9-10 (menos recursos para remediar)
   - Crescimento rápido = 8-9 (precisa estruturar AGORA)
   - Competindo com grandes = 7-8 (precisa se diferenciar)
   - PME decide RÁPIDO quando vê urgência

6. COMPRAS (0-10 invertido): GRANDE VANTAGEM PME
   - <100 funcionários = 9-10 (decisão em 1-2 reuniões)
   - 100-300 funcionários = 7-9 (processo simples)
   - >300 funcionários = 5-7 (mais estruturado mas ainda ágil)
   - Owner direto = 10 (fecha na hora!)
   - PME = CICLO DE VENDA 2-4 SEMANAS (vs 3-6 meses grandes)

ABORDAGEM PARA PME:
- FOCO NO OWNER: "Como proprietário, você sabe quanto uma violação custa..."
- ROI DIRETO: "R$X mil/mês em economia, investimento se paga em X meses"
- CASE PME: Usar cases de empresas similares em tamanho
- URGÊNCIA: "Implementamos em 2 semanas, você já está economizando no mês seguinte"
- SEM ENROLAÇÃO: PME não tem tempo, seja direto

RESPOSTA APENAS EM JSON:
{
  "scores": {
    "pain": <0-10 considerando impacto proporcionalmente maior em PME>,
    "power": <0-10 AJUSTADO - owners/gerentes têm MAIS poder em PME>,
    "vision": <0-10 - PME vê ROI mais claro>,
    "value": <0-10 - considerar volume + velocidade implementação>,
    "control": <0-10 - PME decide RÁPIDO quando há urgência>,
    "compras": <0-10 invertido - PME = PROCESSO MAIS SIMPLES>
  },
  "total_score": <média ponderada>,
  "priority": "HOT|WARM|COLD",
  "justification": "Justificativa específica para PME",
  "approach": "Abordagem direta para owner/decisor PME",
  "estimated_boxes_day": <número realista para PME>,
  "key_hook": "Gancho principal (foco em ROI direto e rapidez)",
  "first_message": "Mensagem de WhatsApp/email direta e sem enrolação",
  "objection_handling": "Principal objeção PME e resposta",
  "next_steps": ["Ação 1", "Ação 2", "Ação 3"],
  "pme_advantages": ["Vantagem 1 específica PME", "Vantagem 2"],
  "estimated_close_time": "Tempo estimado para fechar (ex: 2-3 semanas)"
}`;

        const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2048,
            temperature: 0.3,
            messages: [{ 
                role: 'user', 
                content: prompt 
            }]
        });

        const responseText = response.content[0].text;
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(cleanJson);

        res.status(200).json(analysis);

    } catch (error) {
        console.error('Claude analysis error:', error);
        
        res.status(200).json(generateSmallCompanyFallback(
            req.body.company,
            req.body.contact,
            req.body.intel
        ));
    }
};

// Fallback específico para pequeñas empresas
function generateSmallCompanyFallback(company, contact, intel) {
    const employees = company?.estimated_num_employees || 50;
    const hasProblems = intel?.insights?.key_pain_points > 0;
    const hasExpansion = intel?.insights?.expansion_signals > 0;
    const opportunityScore = intel?.insights?.opportunity_score || 0;
    
    // Scoring ajustado para PME
    const scores = {
        pain: hasProblems ? Math.min(9, 5 + intel.insights.key_pain_points * 2) : 
              employees < 100 ? 6 : 5, // PME pequeña = más dolor proporcionalmente
        
        power: (() => {
            const title = (contact?.title || '').toLowerCase();
            const seniority = (contact?.seniority || '').toLowerCase();
            // En PME, TODOS tienen más poder
            if (seniority === 'owner' || title.includes('owner') || title.includes('ceo') || title.includes('proprietário')) return 10;
            if (title.includes('diretor') || title.includes('director')) return 9;
            if (title.includes('gerente') || title.includes('manager')) return 8;
            if (title.includes('coordenador') || title.includes('coordinator')) return 6;
            return 5;
        })(),
        
        vision: (() => {
            const title = (contact?.title || '').toLowerCase();
            // En PME, la visión es más directa
            if (title.includes('owner') || title.includes('ceo')) return 10;
            if (title.includes('operaç') || title.includes('logística') || title.includes('operations')) return 9;
            if (title.includes('gerente') || title.includes('manager')) return 7;
            return 6;
        })(),
        
        value: employees > 200 ? 8 : employees > 100 ? 7 : employees > 50 ? 6 : 5,
        
        control: hasProblems ? 9 : hasExpansion ? 8 : 5, // PME necesita soluciones YA
        
        compras: employees < 100 ? 10 : employees < 300 ? 9 : 7 // PME = PROCESO RÁPIDO!
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0) / 6;
    const priority = opportunityScore > 60 || scores.power >= 9 ? 'HOT' : 
                     opportunityScore > 30 || scores.power >= 7 ? 'WARM' : 'COLD';
    
    const isOwner = (contact?.title || '').toLowerCase().includes('owner') || 
                    (contact?.title || '').toLowerCase().includes('proprietário') ||
                    (contact?.title || '').toLowerCase().includes('ceo');
    
    return {
        scores,
        total_score: total.toFixed(1),
        priority,
        justification: isOwner ? 
            `OWNER DIRETO - Decisão rápida, empresa ${employees} func, ${hasProblems ? 'COM problemas identificados' : 'potencial baseado em porte'}` :
            `PME ${employees} func, ${hasProblems ? intel.insights.key_pain_points + ' problemas encontrados' : 'prospecção baseada em fit'}`,
        approach: isOwner ?
            "Abordagem direta para owner: ROI claro em R$ e tempo de implementação rápido" :
            "Mostrar case PME similar e agendar call de 15min para diagnóstico",
        estimated_boxes_day: Math.round(employees / 3), // PME tem proporção maior de expedição
        key_hook: hasProblems ? 
            `${intel.insights.key_pain_points} problemas logísticos - solução em 2 semanas` :
            `Empresas similares economizam R$5-15k/mês com nossa solução`,
        first_message: isOwner ?
            `Olá ${contact?.name?.split(' ')[0]}, como proprietário da ${company?.name}, imagino que violação de embalagens te preocupa. Nossos clientes PME economizam R$8-12k/mês. 15min de call?` :
            `Olá ${contact?.name?.split(' ')[0]}, vi a ${company?.name} e temos solução que reduziu 85% violações em empresas similares. Podemos conversar 15min?`,
        objection_handling: "Preço alto? ROI em 10 meses, implementação em 2 semanas, sem parar operação",
        next_steps: [
            isOwner ? "Call com owner em 24-48h (não deixar esfriar)" : "Enviar case PME do mesmo setor",
            "Demo presencial rápida (30min on-site)",
            "Proposta com ROI calculado específico"
        ],
        pme_advantages: [
            `Implementação RÁPIDA: 2 semanas vs 3-6 meses em grandes empresas`,
            `Decisão ÁGIL: ${isOwner ? 'Owner decide na hora' : 'Processo simplificado'}`,
            `ROI proporcionalmente MELHOR: impacto direto no resultado`
        ],
        estimated_close_time: isOwner ? "1-2 semanas" : "2-4 semanas"
    };
}
