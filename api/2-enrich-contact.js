const axios = require('axios');
const lushaCache = require('./_lusha-cache');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const apiKey = process.env.LUSHA_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ 
                success: false,
                error: 'Lusha API key not configured' 
            });
        }

        const { contact } = req.body;
        
        if (!contact) {
            return res.status(400).json({
                success: false,
                error: 'Contact data required'
            });
        }

        console.log(`💰 Lusha enrichment: ${contact.name}`);

        // Construir parámetros
        const params = {
            revealPhones: "true",
            revealEmails: "true"
        };
        
        if (contact.linkedin_url) params.linkedinUrl = contact.linkedin_url;
        if (contact.name) {
            const nameParts = contact.name.split(' ');
            params.firstName = nameParts[0];
            if (nameParts.length > 1) {
                params.lastName = nameParts.slice(1).join(' ');
            }
        }
        if (contact.company) params.companyName = contact.company;
        
        console.log('Lusha params:', params);

        // Intentar cache primero — shared entre vendedores, TTL 30 días
        const cached = await lushaCache.tryGet(params);
        if (cached.hit) {
            const d = cached.data;

            // Normalizar al shape ProspMini por si el cache vino del PROSPECTOR grande.
            let enriched_data = d.enriched_data;
            if (!enriched_data) {
                const emails = (d.all_emails || []).map(e => typeof e === 'string' ? e : e.email);
                const phones_detailed = (d.all_phones || []).map(p => ({
                    number: typeof p === 'string' ? p : p.number,
                    type: p.type || 'unknown'
                }));
                enriched_data = {
                    emails,
                    phones: phones_detailed.map(p => p.number),
                    phones_detailed,
                    primary_email: emails[0] || null,
                    primary_phone: phones_detailed[0]?.number || null,
                    phone_summary: {
                        total: phones_detailed.length,
                        mobile: phones_detailed.filter(p => p.type === 'mobile').length,
                        direct: phones_detailed.filter(p => p.type === 'direct').length,
                        work: phones_detailed.filter(p => p.type === 'work').length
                    }
                };
            }

            return res.status(200).json({
                success: true,
                contact_id: req.body.contact?.id,
                enriched_data,
                from_cache: true,
                lusha_credit_used: false,  // NO quemar crédito si vino del cache
                timestamp: new Date().toISOString()
            });
        }

        const response = await axios({
            method: 'GET',
            url: 'https://api.lusha.com/v2/person',
            headers: {
                'api_key': apiKey,
                'Content-Type': 'application/json'
            },
            params: params,
            timeout: 20000,
            validateStatus: (status) => status < 500
        });
        
        console.log('Lusha status:', response.status);
        
        // Buscar datos en diferentes estructuras
        let personData = null;
        
        if (response.data?.contact?.data) {
            personData = response.data.contact.data;
        } else if (response.data?.data) {
            personData = response.data.data;
        } else if (response.data && response.data.phoneNumbers) {
            personData = response.data;
        }
        
        if (!personData) {
            console.log('⚠️ No data found in Lusha');
            return res.status(200).json({
                success: true,
                contact_id: contact.id,
                enriched_data: {
                    emails: [],
                    phones: [],
                    primary_email: null,
                    primary_phone: null
                },
                lusha_credit_used: true,
                message: 'Contato não encontrado',
                timestamp: new Date().toISOString()
            });
        }
        
        // PROCESAR TODOS LOS TELÉFONOS
        const phones = [];
        if (personData.phoneNumbers && Array.isArray(personData.phoneNumbers)) {
            personData.phoneNumbers.forEach(phone => {
                if (phone && phone.number) {
                    phones.push({
                        number: phone.internationalNumber || phone.number,
                        type: phone.phoneType || 'unknown',
                        formatted: phone.internationalNumber || phone.number
                    });
                }
            });
        }
        
        // PROCESAR TODOS LOS EMAILS
        const emails = [];
        if (personData.emailAddresses && Array.isArray(personData.emailAddresses)) {
            personData.emailAddresses.forEach(email => {
                if (email && email.email) {
                    emails.push(email.email);
                }
            });
        }
        
        console.log(`✅ Lusha: ${emails.length} emails, ${phones.length} phones`);

        const responsePayload = {
            success: true,
            contact_id: contact.id,
            enriched_data: {
                emails: emails,
                phones: phones.map(p => p.number),
                phones_detailed: phones,
                primary_email: emails[0] || null,
                primary_phone: phones[0]?.number || null,
                phone_summary: {
                    total: phones.length,
                    mobile: phones.filter(p => p.type === 'mobile').length,
                    direct: phones.filter(p => p.type === 'direct').length,
                    work: phones.filter(p => p.type === 'work').length
                }
            },
            lusha_credit_used: true,
            from_cache: false,
            timestamp: new Date().toISOString()
        };

        // Guardar en cache — el helper filtra resultados vacíos internamente
        await lushaCache.set(cached.cacheKey, params, responsePayload, null);

        res.status(200).json(responsePayload);

    } catch (error) {
        console.error('❌ Lusha error:', error.message);
        console.error('Response:', error.response?.data);
        
        if (error.response?.status === 404) {
            return res.status(200).json({
                success: true,
                contact_id: req.body.contact?.id,
                enriched_data: {
                    emails: [],
                    phones: [],
                    primary_email: null,
                    primary_phone: null
                },
                lusha_credit_used: true,
                message: 'Pessoa não encontrada no Lusha',
                timestamp: new Date().toISOString()
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Lusha enrichment failed',
            details: error.response?.data || error.message,
            lusha_credit_used: false
        });
    }
};
