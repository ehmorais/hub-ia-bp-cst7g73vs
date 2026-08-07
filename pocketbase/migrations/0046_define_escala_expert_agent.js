/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'escala-expert',
      name: 'Escala Expert',
      description:
        'Assistente especialista em gestão de escalas de enfermagem do Hospital da Beneficência Portuguesa de São Caetano do Sul (HBPSCS).',
      systemPrompt: `Você é o "Escala Expert", assistente especialista em gestão de escalas de enfermagem do Hospital da Beneficência Portuguesa de São Caetano do Sul (HBPSCS).

Você se comunica em português brasileiro, com um tom profissional, objetivo e prestativo, direcionado a administradores e operadores do portal.

Seu escopo é exclusivamente a gestão de escalas (plantões) hospitalares, incluindo:
- Planejamento de escalas e ciclos de plantão
- Regras de escalonamento (dimensionamento mínimo, máximo de consecutivos, mix profissional, limite de horas, descanso mínimo)
- Tipos de turno e suas configurações (carga horária, horas de descanso, horários de início/fim)
- Setores hospitalares e seus parâmetros de dimensionamento (leitos, ratio, mínimo/ideal, criticidade)
- Disponibilidade de colaboradores e contratos
- Solicitações de folga e suas prioridades
- Perfis de staff e regras associadas

Diretrizes de comportamento:
1. Sempre responda com base nos dados disponíveis nas coleções e na base de conhecimento fornecida.
2. Cite a fonte da informação — mencione a regra específica, o tipo de turno, o setor ou a coleção consultada.
3. Quando não houver dados suficientes, indique claramente o que falta e como obter.
4. Recuse educadamente perguntas fora do escopo de gestão de escalas ou que envolvam criar, alterar ou excluir registros no banco de dados.
5. Para solicitudes ambíguas, peça esclarecimento antes de responder.
6. Você é somente leitura — nunca cria, atualiza ou exclui registros. Se um usuário pedir para modificar dados, explique que isso deve ser feito pela interface apropriada do sistema.`,
      tier: 'fast',
      tools: [
        { collection: 'shift_cycles', perms: { list: true, read: true } },
        { collection: 'hospital_sectors', perms: { list: true, read: true } },
        { collection: 'staff_roles', perms: { list: true, read: true } },
        { collection: 'staff_contracts', perms: { list: true, read: true } },
        { collection: 'timeoff_requests', perms: { list: true, read: true } },
        { collection: 'shift_rules', perms: { list: true, read: true } },
        { collection: 'shifts', perms: { list: true, read: true } },
        { collection: 'shift_types', perms: { list: true, read: true } },
        { collection: 'staff_profiles', perms: { list: true, read: true } },
        { collection: 'departments', perms: { list: true, read: true } },
        { collection: 'users', perms: { list: true, read: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: `REGRAS DE ESCALONAMENTO (shift_rules)

Tipos de regra (rule_type):
- min_staff: Dimensionamento mínimo de profissionais por setor. O campo "value" indica o número mínimo.
- max_consecutive: Número máximo de plantões consecutivos permitidos para um mesmo colaborador.
- professional_mix: Exige a presença de profissionais de diferentes hierarquias no mesmo turno/setor (ex: um Enfermeiro deve estar presente quando há Técnicos de Enfermagem).
- max_hours: Limite máximo de horas que um colaborador pode trabalhar no ciclo/mês. O campo "value" indica o limite em horas.
- min_rest_hours: Horas mínimas de descanso entre plantões consecutivos. O campo "value" indica as horas.
- other: Regras adicionais específicas do departamento.
- custom_prompt: Regras customizadas interpretadas pela IA — o campo "prompt" contém instruções que devem ser seguidas precisamente.

Cada regra está associada a um departamento (campo "department"). Regras individuais podem ser atribuídas a perfis de staff (staff_profiles → rules) e sobrepõem as regras gerais do departamento para aquele profissional específico.`,
          },
        },
        {
          type: 'text',
          payload: {
            text: `TIPOS DE TURNO (shift_types)

Cada tipo de turno possui:
- name: Nome do tipo (ex: "Plantão 12x36 Diurno")
- code: Código identificador (ex: "P12D")
- work_hours: Carga horária do turno em horas (ex: 12)
- rest_hours: Horas de descanso obrigatório após o turno (ex: 36)
- is_administrative: Indica se é um turno administrativo (não clínico)
- start_time: Horário de início do turno (formato texto, ex: "07:00")
- end_time: Horário de fim do turno (formato texto, ex: "19:00")

O tipo de turno 12x36 é o padrão hospitalar: 12 horas de trabalho seguidas de 36 horas de descanso, totalizando um ciclo de 48 horas. O descanso de 36h é obrigatório por lei para este tipo de jornada.`,
          },
        },
        {
          type: 'text',
          payload: {
            text: `SETORES HOSPITALARES (hospital_sectors)

Cada setor possui:
- name: Nome do setor (ex: "PS - Pronto Socorro", "Andar 1 - Clínica Médica")
- department: Departamento ao qual o setor pertence
- bed_capacity: Capacidade de leitos do setor
- staffing_ratio: Proporção de profissionais por leitos (ex: 1 profissional para cada 10 leitos)
- min_staffing: Número mínimo de profissionais para funcionamento
- ideal_staffing: Número ideal de profissionais para qualidade do atendimento
- is_critical: Indica se o setor é crítico (ex: Pronto Socorro, UTI) — setores críticos devem priorizar atingir o staffing ideal

Dimensionamento:
- Andares não críticos: mínimo de 1 profissional para cada "staffing_ratio" leitos, com no mínimo 2 profissionais.
- Setores críticos: devem priorizar atingir o "ideal_staffing".
- Proporcionais à capacidade de leitos.`,
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Como funciona o prazo de solicitação de folga por ciclo?',
                answer:
                  'Cada ciclo de plantão (shift_cycles) possui um campo "request_deadline" que define a data limite para os colaboradores enviarem suas solicitações de folga. Após essa data, o ciclo pode ser fechado para novas solicitações. O gestor deve gerar a escala respeitando as folgas solicitadas dentro do prazo.',
              },
              {
                question: 'Como funciona a prioridade de folgas (priority_weight)?',
                answer:
                  'As solicitações de folga (timeoff_requests) têm um campo "priority_weight" que define a prioridade da solicitação. Maior peso = maior prioridade. Durante a geração de escalas, o sistema tenta respeitar todas as folgas, mas em caso de conflito, as de maior peso têm precedência. O status pode ser "pending" (pendente), "fulfilled" (atendida) ou "not_fulfilled" (não atendida).',
              },
              {
                question: 'Como funcionam os contratos de staff e os limites de horas?',
                answer:
                  'Os contratos (staff_contracts) definem o tipo de contratação (CLT 180h, PJ, Autônomo) e o limite mensal de horas ("monthly_hour_limit"). O tipo de turno associado ao contrato (shift_type) determina as horas de trabalho e descanso por plantão. O total de horas trabalhadas no ciclo não deve exceder o limite mensal do contrato.',
              },
              {
                question: 'O que significa cada tipo de regra de escalonamento?',
                answer:
                  'min_staff: mínimo de profissionais por turno. max_consecutive: máximo de plantões seguidos. professional_mix: mistura obrigatória de hierarquias (ex: Enfermeiro + Técnico). max_hours: limite de horas no ciclo. min_rest_hours: descanso mínimo entre plantões. custom_prompt: regra customizada com instrução em linguagem natural no campo "prompt".',
              },
              {
                question: 'Como funciona a hierarquia de profissionais?',
                answer:
                  'Os cargos (staff_roles) têm um campo "hierarchy_rank" que define a hierarquia (maior número = maior hierarquia). O campo "requires_supervision" indica se o profissional precisa de supervisão de um hierarquicamente superior. Por exemplo, um Técnico de Enfermagem não pode atuar sozinho — deve haver um Enfermeiro no mesmo setor/turno.',
              },
              {
                question: 'O que são perfis de staff (staff_profiles)?',
                answer:
                  'Staff profiles associam um colaborador a regras específicas (campo "rules" → shift_rules) e um ID profissional ("professional_id"). Regras atribuídas ao perfil sobrepõem as regras gerais do departamento para aquele profissional específico.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'escala-expert')
  },
)
