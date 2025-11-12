const axios = require('axios');

module.exports = async (req, res) => {
    // CORS headers
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

        // Build location filter - Santa Catarina específico
        let locationFilter = ['Santa Catarina, Brazil'];
        
        // Si hay ciudad específica, agregarla
        if (filters.city) {
            locationFilter = [`${filters.city}, Santa Catarina, Brazil`];
        }

        // STEP 1: Get companies - OPTIMIZADO PARA PEQUEÑAS EMPRESAS
        const apolloPayload = {
            page: page,
            per_page: 25,
            organization_locations: locationFilter,
            organization_num_employees_ranges: filters.size ? [filters.size] : ['1,500'], // 1-500 empleados
            q_organization_keyword_tags: filters.keywords && filters.keywords.length > 0 
                ? filters.keywords 
                : [
                    'ecommerce', 'e-commerce', 'loja online', 'varejo',
                    'distributor', 'distribuidora', 'distribuição',
                    'fulfillment', '3pl', 'logistics', 'logística',
                    'manufacturer', 'fabricante', 'indústria',
                    'autopeças', 'auto parts',
                    'móveis', 'furniture',
                    'embalagens', 'packaging',
                    'alimentos', 'food'
                ]
        };

        console.log('🔍 Searching small companies in SC:', JSON.stringify(apolloPayload, null, 2));

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
        
        console.log(`✅ Apollo returned ${organizations.length} companies`);

        if (organizations.length === 0) {
            return res.status(200).json({
                success: true,
                organizations: [],
                total: 0,
                page: 1,
                total_pages: 1,
                message: 'Nenhuma empresa encontrada com esses filtros'
            });
        }

        // FILTRO MÍNIMO: Solo verificar que sea Brasil (confiar en Apollo para SC)
        const scCompanies = organizations.filter(org => {
            const country = (org.country || '').toLowerCase();
            // Si Apollo devolvió la empresa con nuestro filtro de location, confiar
            return country === 'brazil' || country === 'brasil' || !country;
        });

        console.log(`🎯 Verified ${scCompanies.length} Brazilian companies (from ${organizations.length} total)`);

        if (scCompanies.length === 0) {
            return res.status(200).json({
                success: true,
                organizations: [],
                total: 0,
                page: 1,
                total_pages: 1,
                message: 'Nenhuma empresa brasileira encontrada'
            });
        }

        // Extract company IDs
        const companyIds = scCompanies.map(org => org.id).filter(Boolean);

        // STEP 2: Get contacts - PRIORIDAD PARA PEQUEÑAS EMPRESAS
        const contactsPayload = {
            page: 1,
            per_page: 100,
            organization_ids: companyIds,
            // PRIORIDAD: Owners/CEOs primeiro, depois gerentes
            person_seniorities: ["owner", "c_suite", "vp", "director", "manager", "senior"],
            person_titles: [
                // TIER 1: OWNERS & CEOs (máxima prioridad)
                "Owner", "Co-owner", "Proprietário", "Sócio",
                "CEO", "Founder", "Co-founder",
                "Diretor Geral", "Diretor Executivo",
                
                // TIER 2: GERENTES (alta prioridad)
                "Gerente de Operações", "Operations Manager",
                "Gerente de Logística", "Logistics Manager",
                "Gerente de Qualidade", "Quality Manager",
                "Gerente de Produção", "Production Manager",
                "Gerente Geral", "General Manager",
                "Gerente Comercial", "Commercial Manager",
                "Gerente de Compras", "Purchasing Manager",
                
                // TIER 3: COORDENADORES & SUPERVISORES
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
        console.log(`✅ Retrieved ${allContacts.length} total contacts`);

        // STEP 3: Map contacts to companies with SMART PRIORITIZATION
        const companiesWithContacts = scCompanies.map(company => {
            const companyContacts = allContacts.filter(contact => 
                contact.organization_id === company.id || 
                contact.organization?.id === company.id
            );
            
            // Ordenar por TIER de prioridad
            const prioritizedContacts = companyContacts
                .sort((a, b) => {
                    const getPriority = (title, seniority) => {
                        if (!title) return 999;
                        const titleLower = title.toLowerCase();
                        const seniorityLower = (seniority || '').toLowerCase();
                        
                        // TIER 1: Owners & CEOs
                        if (seniorityLower === 'owner' || 
                            titleLower.includes('owner') || 
                            titleLower.includes('proprietário') ||
                            titleLower.includes('sócio') ||
                            titleLower.includes('ceo') || 
                            titleLower.includes('founder')) {
                            return 1;
                        }
                        
                        // TIER 2: Diretores
                        if (titleLower.includes('diretor') || 
                            titleLower.includes('director')) {
                            return 2;
                        }
                        
                        // TIER 3: Gerentes
                        if (titleLower.includes('gerente') || 
                            titleLower.includes('manager')) {
                            return 3;
                        }
                        
                        // TIER 4: Coordenadores
                        if (titleLower.includes('coordenador') || 
                            titleLower.includes('coordinator')) {
                            return 4;
                        }
                        
                        return 10;
                    };
                    
                    return getPriority(a.title, a.seniority) - getPriority(b.title, b.seniority);
                })
                .slice(0, 8); // Top 8 contacts por empresa

            return {
                ...company,
                contacts: prioritizedContacts
            };
        });

        // Ordenar empresas: primero las que tienen owners/CEOs
        companiesWithContacts.sort((a, b) => {
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
            
            return (b.estimated_num_employees || 0) - (a.estimated_num_employees || 0);
        });

        console.log('✅ Successfully processed SC small companies and contacts');

        res.status(200).json({
            success: true,
            organizations: companiesWithContacts,
            total: pagination.total_entries || companiesWithContacts.length,
            page: pagination.page || 1,
            per_page: pagination.per_page || 25,
            total_pages: pagination.total_pages || 1,
            total_contacts_found: allContacts.length,
            api_calls_used: 2,
            filter_summary: {
                location: locationFilter[0],
                size_range: filters.size || '1-500 employees',
                industries: filters.keywords?.join(', ') || 'multiple'
            }
        });

    } catch (error) {
        console.error('❌ Apollo search error:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch small companies in SC',
            details: error.response?.data?.error || error.message
        });
    }
};
