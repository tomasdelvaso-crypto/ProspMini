const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const apiKey = process.env.APOLLO_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ 
                success: false,
                error: 'Apollo API key not configured' 
            });
        }

        const { filters = {}, page = 1 } = req.body;

        // Build location filter
        let locationFilter = ['Santa Catarina, Brazil'];
        if (filters.city) {
            locationFilter = [`${filters.city}, Santa Catarina, Brazil`];
        }

        // FIXED: Construcción del payload Apollo
        const apolloPayload = {
            page: page,
            per_page: 25,
            organization_locations: locationFilter,
            organization_num_employees_ranges: filters.size ? [filters.size] : ['1,500']
        };

        // FIXED: Solo agregar keywords si el usuario seleccionó algo
        if (filters.keywords && filters.keywords.length > 0) {
            apolloPayload.q_organization_keyword_tags = filters.keywords;
        }

        console.log('🔍 Apollo search:', JSON.stringify(apolloPayload, null, 2));

        const companiesResponse = await axios.post(
            'https://api.apollo.io/api/v1/mixed_companies/search',
            apolloPayload,
            {
                headers: {
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const organizations = companiesResponse.data?.organizations || [];
        const pagination = companiesResponse.data?.pagination || {};
        
        console.log(`✅ Apollo: ${organizations.length} companies found`);

        if (organizations.length === 0) {
            return res.status(200).json({
                success: true,
                organizations: [],
                total: 0,
                page: 1,
                total_pages: 1,
                message: 'Nenhuma empresa encontrada'
            });
        }

        // Filtro mínimo
        const validCompanies = organizations.filter(org => {
            const country = (org.country || '').toLowerCase();
            return country === 'brazil' || country === 'brasil' || !country;
        });

        console.log(`🎯 ${validCompanies.length} valid companies`);

        const companyIds = validCompanies.map(org => org.id).filter(Boolean);

        // STEP 2: Get contacts
        const contactsPayload = {
            page: 1,
            per_page: 100,
            organization_ids: companyIds,
            person_seniorities: ["owner", "c_suite", "vp", "director", "manager", "senior"],
            person_titles: [
                "Owner", "Co-owner", "Proprietário", "Sócio",
                "CEO", "Founder", "Co-founder",
                "Diretor Geral", "Diretor Executivo",
                "Gerente de Operações", "Operations Manager",
                "Gerente de Logística", "Logistics Manager",
                "Gerente de Qualidade", "Quality Manager",
                "Gerente de Produção", "Production Manager",
                "Gerente Geral", "General Manager",
                "Gerente Comercial", "Commercial Manager",
                "Gerente de Compras", "Purchasing Manager",
                "Coordenador de Logística", "Logistics Coordinator",
                "Coordenador de Operações", "Operations Coordinator",
                "Supervisor de Produção", "Production Supervisor"
            ]
        };

        console.log(`📞 Fetching contacts for ${companyIds.length} companies...`);

        const contactsResponse = await axios.post(
            'https://api.apollo.io/api/v1/mixed_people/search',
            contactsPayload,
            {
                headers: {
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const allContacts = contactsResponse.data?.people || [];
        console.log(`✅ Retrieved ${allContacts.length} contacts`);

        // STEP 3: Map contacts to companies
        const companiesWithContacts = validCompanies.map(company => {
            const companyContacts = allContacts.filter(contact => 
                contact.organization_id === company.id || 
                contact.organization?.id === company.id
            );
            
            const prioritizedContacts = companyContacts
                .map(contact => ({
                    id: contact.id,
                    name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
                    title: contact.title,
                    seniority: contact.seniority,
                    linkedin_url: contact.linkedin_url,
                    email_apollo: contact.email || null,
                    phone_apollo: contact.phone_numbers?.[0]?.sanitized_number || null,
                    email_status: contact.email_status || 'unknown',
                    needs_enrichment: !contact.email || contact.email_status !== 'verified',
                    enriched: false
                }))
                .sort((a, b) => {
                    const getPriority = (title, seniority) => {
                        if (!title) return 999;
                        const titleLower = title.toLowerCase();
                        const seniorityLower = (seniority || '').toLowerCase();
                        
                        if (seniorityLower === 'owner' || 
                            titleLower.includes('owner') || 
                            titleLower.includes('proprietário') ||
                            titleLower.includes('sócio') ||
                            titleLower.includes('ceo') || 
                            titleLower.includes('founder')) return 1;
                        
                        if (titleLower.includes('diretor') || titleLower.includes('director')) return 2;
                        if (titleLower.includes('gerente') || titleLower.includes('manager')) return 3;
                        if (titleLower.includes('coordenador') || titleLower.includes('coordinator')) return 4;
                        
                        return 10;
                    };
                    
                    return getPriority(a.title, a.seniority) - getPriority(b.title, b.seniority);
                })
                .slice(0, 8);

            // FIXED: Extraer TODAS las redes sociales y website
            return {
                id: company.id,
                name: company.name,
                
                // WEBSITES
                website: company.website_url || company.primary_domain || null,
                domain: company.primary_domain,
                
                // REDES SOCIALES
                linkedin: company.linkedin_url || null,
                facebook: company.facebook_url || null,
                twitter: company.twitter_url || null,
                instagram: company.instagram_url || null, // Apollo puede tener este campo
                
                // LOCATION
                city: company.city,
                state: company.state,
                country: company.country,
                
                // COMPANY INFO
                employees: company.estimated_num_employees,
                industry: company.industry,
                phone: company.phone || company.primary_phone?.number,
                founded_year: company.founded_year,
                
                // CONTACTS
                contacts: prioritizedContacts,
                
                // METADATA
                has_website: !!(company.website_url || company.primary_domain),
                has_decision_makers: prioritizedContacts.length > 0,
                top_decision_maker: prioritizedContacts[0] || null
            };
        });

        // Ordenar
        companiesWithContacts.sort((a, b) => {
            if (a.has_website && !b.has_website) return -1;
            if (!a.has_website && b.has_website) return 1;
            
            if (a.has_decision_makers && !b.has_decision_makers) return -1;
            if (!a.has_decision_makers && b.has_decision_makers) return 1;
            
            const hasOwnerA = a.contacts.some(c => 
                (c.title || '').toLowerCase().includes('owner') || 
                (c.title || '').toLowerCase().includes('ceo') ||
                (c.title || '').toLowerCase().includes('proprietário')
            );
            const hasOwnerB = b.contacts.some(c => 
                (c.title || '').toLowerCase().includes('owner') || 
                (c.title || '').toLowerCase().includes('ceo') ||
                (c.title || '').toLowerCase().includes('proprietário')
            );
            
            if (hasOwnerA && !hasOwnerB) return -1;
            if (!hasOwnerA && hasOwnerB) return 1;
            
            return (b.employees || 0) - (a.employees || 0);
        });

        console.log('✅ Success - NO Lusha credits used yet');

        res.status(200).json({
            success: true,
            organizations: companiesWithContacts,
            total: pagination.total_entries || companiesWithContacts.length,
            page: pagination.page || 1,
            per_page: pagination.per_page || 25,
            total_pages: pagination.total_pages || 1,
            total_contacts_found: allContacts.length,
            apollo_credits_used: 2,
            lusha_credits_used: 0,
            filter_summary: {
                location: locationFilter[0],
                size_range: filters.size || '1-500 employees',
                industries: filters.keywords?.join(', ') || 'todas'
            }
        });

    } catch (error) {
        console.error('❌ Apollo error:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch companies',
            details: error.response?.data?.error || error.message
        });
    }
};
