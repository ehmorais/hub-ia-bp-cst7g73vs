import {
  Activity,
  HeartPulse,
  Pill,
  Stethoscope,
  Microscope,
  FileText,
  ScanHeart,
} from 'lucide-react'

export const DEPARTMENTS = [
  {
    id: 'radiologia',
    name: 'Radiologia e Diagnóstico',
    description: 'Modelos de IA para análise de imagens e laudos.',
    icon: ScanHeart,
    modelsActive: 4,
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'enfermagem',
    name: 'Enfermagem',
    description: 'Assistência à beira de leito e triagem de pacientes.',
    icon: Activity,
    modelsActive: 2,
    color: 'bg-green-100 text-green-700',
  },
  {
    id: 'farmacia',
    name: 'Farmácia Clínica',
    description: 'Interações medicamentosas e farmacovigilância.',
    icon: Pill,
    modelsActive: 3,
    color: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'oncologia',
    name: 'Oncologia',
    description: 'Análise de protocolos e estudos de caso.',
    icon: HeartPulse,
    modelsActive: 1,
    color: 'bg-rose-100 text-rose-700',
  },
  {
    id: 'patologia',
    name: 'Patologia',
    description: 'Análise de lâminas e emissão de pareceres.',
    icon: Microscope,
    modelsActive: 2,
    color: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'auditoria',
    name: 'Auditoria Médica',
    description: 'Revisão de prontuários e faturamento.',
    icon: FileText,
    modelsActive: 5,
    color: 'bg-slate-100 text-slate-700',
  },
]

export const TOOLS = [
  {
    id: 'assistente-laudos',
    departmentId: 'radiologia',
    name: 'Assistente de Laudos (Raio-X/TC)',
    status: 'Ativo',
    model: 'Claude 3.5 Sonnet',
    description: 'Auxilia na estruturação e revisão de laudos radiológicos preliminares.',
    usageData: [
      { day: 'Seg', calls: 120 },
      { day: 'Ter', calls: 150 },
      { day: 'Qua', calls: 180 },
      { day: 'Qui', calls: 140 },
      { day: 'Sex', calls: 200 },
      { day: 'Sab', calls: 90 },
      { day: 'Dom', calls: 70 },
    ],
  },
  {
    id: 'analise-interacao',
    departmentId: 'farmacia',
    name: 'Análise de Interações',
    status: 'Ativo',
    model: 'GPT-4o',
    description: 'Verifica riscos de interações medicamentosas complexas em prescrições.',
    usageData: [
      { day: 'Seg', calls: 40 },
      { day: 'Ter', calls: 60 },
      { day: 'Qua', calls: 85 },
      { day: 'Qui', calls: 70 },
      { day: 'Sex', calls: 90 },
      { day: 'Sab', calls: 30 },
      { day: 'Dom', calls: 25 },
    ],
  },
  {
    id: 'triagem-inteligente',
    departmentId: 'enfermagem',
    name: 'Triagem Inteligente',
    status: 'Em Homologação',
    model: 'Llama 3',
    description: 'Sugere classificação de risco baseada em sintomas relatados.',
    usageData: [
      { day: 'Seg', calls: 10 },
      { day: 'Ter', calls: 15 },
      { day: 'Qua', calls: 20 },
      { day: 'Qui', calls: 18 },
      { day: 'Sex', calls: 25 },
      { day: 'Sab', calls: 30 },
      { day: 'Dom', calls: 22 },
    ],
  },
]

export const RECENT_HISTORY = [
  {
    id: '1',
    date: '2023-10-27T14:30:00Z',
    tool: 'Assistente de Laudos',
    summary: 'TC Crânio - Paciente 45a trauma...',
  },
  {
    id: '2',
    date: '2023-10-27T10:15:00Z',
    tool: 'Análise de Interações',
    summary: 'Varfarina + Amiodarona consulta...',
  },
  {
    id: '3',
    date: '2023-10-26T16:45:00Z',
    tool: 'Assistente de Laudos',
    summary: 'RX Tórax - Suspeita pneumonia...',
  },
]

export const AUDIT_LOGS = [
  {
    id: 'LOG-001',
    timestamp: '2023-10-27 14:30:22',
    user: 'Dr. Carlos Silva',
    role: 'Médico',
    department: 'Radiologia',
    action: 'Geração de Laudo',
    tokens: 1250,
  },
  {
    id: 'LOG-002',
    timestamp: '2023-10-27 14:15:10',
    user: 'Enf. Marina Costa',
    role: 'Enfermeiro Sênior',
    department: 'Enfermagem',
    action: 'Consulta Triagem',
    tokens: 450,
  },
  {
    id: 'LOG-003',
    timestamp: '2023-10-27 13:50:05',
    user: 'Farm. Roberto Dias',
    role: 'Farmacêutico',
    department: 'Farmácia',
    action: 'Análise Prescrição',
    tokens: 890,
  },
  {
    id: 'LOG-004',
    timestamp: '2023-10-27 11:20:00',
    user: 'Dra. Ana Paula',
    role: 'Médico',
    department: 'Oncologia',
    action: 'Revisão Protocolo',
    tokens: 2100,
  },
]

export const USERS = [
  {
    id: 'U1',
    name: 'Dr. Carlos Silva',
    email: 'carlos.silva@bp.org.br',
    role: 'Operador',
    department: 'Radiologia',
  },
  {
    id: 'U2',
    name: 'Enf. Marina Costa',
    email: 'marina.costa@bp.org.br',
    role: 'Gerente',
    department: 'Enfermagem',
  },
  { id: 'U3', name: 'Admin TI', email: 'admin.ti@bp.org.br', role: 'Admin', department: 'TI' },
]
