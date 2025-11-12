const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const lushaKey = process.env.LUSHA_API_KEY;
        
        if (!lushaKey) {
            return res.status(500).json({ 
                success: false,
                error: 'Lusha API key not configured' 
            });
        }

        const { contact } = req.body;
        
        if (!contact || !contact.name) {
            return res.status(400).json({
                success: false,
                error: 'Contact data required (name, company, etc.)'
            });
        }

        console.log(`💰 USING LUSHA CREDIT for: ${contact.name} at ${contact.company}`);

        // Lusha Person Enrichment API
        const lushaPayload = {
            data: {
                company: contact.company,
                first_name: contact.name.split(' ')[0],
                last_name: contact.name.split(' ').slice(1).join(' ') || contact.name.split(' ')[0],
                linkedin_url: contact.linkedin_url || undefined
            },
            property: ['emailAddress', 'phoneNumber']
        };

        const lushaResponse = await axios.post(
            'https://api.lusha.com/person',
            lushaPayload,
            {
                headers: {
                    'api_key': lushaKey,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        const enrichedData = lushaResponse.data?.data || {};

        console.log(`✅ Lusha enrichment complete for ${contact.name}`);

        res.status(200).json({
            success: true,
            contact_id: contact.id,
            enriched_data: {
                email: enrichedData.emailAddress?.value || null,
                email_confidence: enrichedData.emailAddress?.accuracy || null,
                phone: enrichedData.phoneNumber?.internationalNumber || null,
                phone_type: enrichedData.phoneNumber?.type || null
            },
            lusha_credit_used: true,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Lusha error:', error.response?.data || error.message);
        
        // Si Lusha falla, no perder el crédito
        res.status(500).json({
            success: false,
            error: 'Lusha enrichment failed',
            details: error.response?.data || error.message,
            lusha_credit_used: false
        });
    }
};
