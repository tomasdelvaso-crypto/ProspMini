🎯 Ventapel SC - Prospector Pequeñas Empresas
Sistema de prospección B2B optimizado para pequeñas empresas (10-500 empleados) en Santa Catarina, Brasil.
🎯 Diferencias vs Prospector Original
FeatureProspector OriginalProspector SC PMETamaño objetivo1000+ empleados10-500 empleadosGeografíaTodo BrasilSanta Catarina específicoDecisoresC-Suite, DirectorsOwners, CEOs, GerentesIndustriasGrandes logísticaE-com, distribuidoras, 3PL localesScoring ComprasMás bajo (burocracia)Más alto (decisión rápida)Scoring PowerRestrictivoAmplio (gerentes tienen poder)Tiempo cierre3-6 meses1-4 semanas
📋 Características
Filtros Específicos

Prefeituras prioritarias: Balneário Camboriú, Itajaí, Joinville, Blumenau, Brusque, Jaraguá do Sul, Tubarão
Industrias locales:

E-commerce / Loja Online
Distribuidoras (Autopeças, Alimentos)
Fábricas (Autopeças, Móveis)
3PL / Fulfillment
Revendedores de Embalagens



Búsqueda Inteligente

Prioriza empresas con owners/CEOs identificados (decisión más rápida)
Filtra por ciudad dentro de SC
Ordena resultados: ciudades prioritarias primero
Muestra hasta 8 contactos por empresa priorizados por poder de decisión

Enrichment Selectivo

Ver LinkedIn ANTES de gastar créditos
Botón "Enriquecer Datos" solo cuando se necesita
Prioriza contactos con móvil para WhatsApp

🚀 Deployment en Vercel
1. Crear repositorio en GitHub
bash# Crear nuevo repo vacío en GitHub (ventapel-sc-pequenas)
# Luego en tu computadora:

cd ventapel-sc-pequenas
git init
git add .
git commit -m "Initial commit - Ventapel SC PME"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/ventapel-sc-pequenas.git
git push -u origin main
2. Conectar con Vercel

Ve a vercel.com
Click en "New Project"
Importa tu repositorio ventapel-sc-pequenas
Vercel detectará automáticamente la configuración

3. Variables de Entorno
En Vercel Dashboard > Settings > Environment Variables, agrega:
APOLLO_API_KEY=tu_apollo_key
LUSHA_API_KEY=tu_lusha_key
SERPER_API_KEY=tu_serper_key
CLAUDE_API_KEY=tu_claude_key (opcional)
4. Deploy
bash# Vercel deployará automáticamente
# O manualmente:
vercel --prod
Tu app estará en: https://ventapel-sc-pequenas.vercel.app
📁 Estructura de Archivos
ventapel-sc-pequenas/
├── index.html                          # Frontend
├── api/
│   ├── 1-search-small-companies.js    # Búsqueda PMEs SC
│   ├── 3-enrich-apollo.js             # Enrichment Apollo
│   ├── 3-enrich-lusha.js              # Enrichment Lusha
│   ├── 3-intel-serper.js              # Inteligencia de mercado
│   └── 4-analyze-claude.js            # Análisis PPVVC para PMEs
├── vercel.json                         # Config Vercel
├── package.json                        # Dependencias
└── README.md                           # Este archivo
🎯 Uso
1. Búsqueda Básica

Seleccionar Prefeitura (opcional, o "Todas Santa Catarina")
Seleccionar Indústria (recomendado)
Seleccionar Tamanho (default: 10-500 funcionários)
Click "Buscar Empresas"

2. Revisar Resultados

⭐ Empresas con fondo amarillo = Ciudad prioritaria
🔴 Círculo rojo = Owner/CEO (máxima prioridad)
🟡 Círculo amarillo = Director/Gerente (alta prioridad)
🔵 Círculo azul = Coordinador/Supervisor (media prioridad)

3. Estrategia de Enrichment (Ahorrar Créditos)
Paso 1: Ver LinkedIn
Click "Ver no LinkedIn" → Revisar perfil manualmente
¿Es el decisor correcto? ¿Empresa interesante?
Paso 2: Enrichment Selectivo
Solo si el prospect vale la pena → Click "Enriquecer Datos"
Esto gastará créditos de Lusha/Apollo
💡 Tips de Prospección PME
Priorizar Estos Contactos:

Owners/Proprietários/Sócios → Decisión en 1 reunión
CEOs → Decisión en 2-3 reuniones
Gerente Operações/Logística → Influencia alta, ciclo 2-4 semanas
Diretores → Buena influencia en PME

Abordagem:

Direto y sin vueltas: PME no tiene tiempo para enroladas
ROI en R$: "Economiza R$8-12k/mês"
Tiempo de implementación: "Implementação em 2 semanas"
Case PME: Usa ejemplos de empresas similares en tamaño

Timing:

Owner/CEO: Contactar en 24h (no dejar enfriar)
Gerente: Contactar en 48-72h
WhatsApp > Email para PME

📊 Scoring PPVVC Adaptado para PME
PAIN (0-10)

PME tiene más dolor proporcionalmente por violaciones
Menos recursos para remediar problemas
Score típico: 6-9 (vs 4-7 en grandes)

POWER (0-10) ⭐ CRÍTICO EN PME

Owner/CEO: 10 puntos (decide en 1 reunión!)
Gerente: 7-8 puntos (más poder que en grandes)
Coordinador: 5-6 puntos (aún tiene voz)

VISION (0-10)

PME ve ROI más directo
Owner entiende impacto inmediato en resultado
Score típico: 7-10 (vs 5-8 en grandes)

VALUE (0-10)

ROI proporcionalmente mejor en PME
Implementación más rápida = valor antes
Score típico: 6-9

CONTROL (0-10)

PME decide RÁPIDO cuando hay urgencia
Menos recursos = más presión
Score típico: 7-10 cuando hay problemas

COMPRAS (0-10 invertido) ⭐ VENTAJA PME

<100 func: 9-10 puntos (decisión en 1-2 reuniones)
100-300: 7-9 puntos (proceso simple)
Owner direto: 10 puntos (fecha na hora!)

🎯 KPIs de Éxito
Métricas por Búsqueda

Target: 15-20 empresas por búsqueda
% con Owners identificados: >30%
% ciudades prioritarias: >50%

Métricas de Conversión

Tiempo de respuesta: <24h para Owners
Ciclo de venta: 2-4 semanas (vs 3-6 meses grandes)
Tasa de cierre: Mayor en PME (menos burocracia)

🔧 Troubleshooting
Pocos resultados

✅ Quitar filtro de Prefeitura
✅ Cambiar a industria más amplia
✅ Verificar que Apollo tiene cobertura en SC

No aparecen contactos

✅ Empresas muy pequeñas tienen menos datos en Apollo
✅ Intentar búsqueda manual en LinkedIn
✅ Usar Serper para buscar noticias de la empresa

Créditos gastándose rápido

✅ SIEMPRE ver LinkedIn antes de enriquecer
✅ Solo enriquecer prospects con Owner/CEO
✅ Priorizar empresas de ciudades prioritarias

📞 Workflow Recomendado
1. BUSCAR
   └─ Prefeitura prioritaria + Industria específica
   
2. FILTRAR MENTAL
   └─ ¿Tiene Owner/CEO? ¿Ciudad prioritaria? → Sí → Continuar
   
3. VER LINKEDIN
   └─ Validar que es el decisor correcto
   
4. ENRICHMENT SELECTIVO
   └─ Solo si vale la pena gastar créditos
   
5. CONTACTO RÁPIDO
   └─ WhatsApp/Email en <24h para Owners
   └─ Mensaje directo: ROI en R$ + tiempo implementación
   
6. FOLLOW-UP ÁGIL
   └─ Demo on-site 30min
   └─ Propuesta con ROI calculado
   └─ Close en 2-4 semanas
🎯 Ventajas Competitivas vs Sistema Original

Foco geográfico: SC específico = menos ruido
Scoring ajustado: Refleja realidad de PME (más poder en gerentes, menos burocracia)
Enrichment selectivo: Ahorra créditos críticos
Priorización automática: Owners primero, ciudades prioritarias primero
Tiempo de cierre real: 2-4 semanas vs 3-6 meses


Desarrollado para Ventapel Brasil por Claude & Tomás
🎯 Foco: PMEs de Santa Catarina | ⚡ Decisión rápida | 💰 ROI directo
