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
        
        if (!contact || !contact.linkedin_url) {
            return res.status(400).json({
                success: false,
                error: 'LinkedIn URL required for enrichment'
            });
        }

        console.log(`💰 USING LUSHA CREDIT for: ${contact.name}`);

        // Lusha API v2 - Person Enrichment by LinkedIn
        const lushaResponse = await axios.post(
            'https://api.lusha.com/enrichment',
            {
                properties: ['emailAddresses', 'phoneNumbers'],
                person: {
                    linkedInUrl: contact.linkedin_url
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${lushaKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        const enrichedData = lushaResponse.data || {};
        
        // Extraer emails
        const emails = enrichedData.emailAddresses || [];
        const phones = enrichedData.phoneNumbers || [];

        console.log(`✅ Lusha: ${emails.length} emails, ${phones.length} phones`);

        res.status(200).json({
            success: true,
            contact_id: contact.id,
            enriched_data: {
                emails: emails.map(e => e.email || e),
                phones: phones.map(p => p.number || p),
                primary_email: emails[0]?.email || emails[0] || null,
                primary_phone: phones[0]?.number || phones[0] || null
            },
            lusha_credit_used: true,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Lusha error:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Lusha enrichment failed',
            details: error.response?.data || error.message,
            lusha_credit_used: false
        });
    }
};
