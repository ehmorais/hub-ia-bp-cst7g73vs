/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'escala-expert',
      name: 'Escala Expert',
      description: 'Assistente de Gestão de Escalas de Enfermagem (HBPSCS)',
      systemPrompt: `Você é o assistente "Escala-Expert" especialista na gestão de escalas de enfermagem do HBPSCS e nas leis trabalhistas brasileiras.
Regras a verificar:
- Descanso de 36h obrigatório para jornadas 12x36.
- Técnico de enfermagem não pode atuar sem um Enfermeiro no mesmo setor/turno.
- O limite de horas mensais é de aproximadamente 180h.
- "Mínimo técnico": Andares (1 profissional para cada 10 leitos), PS (mínimo 2 por setor: Triagem, Semi, Medicação).
Você pode ler as coleções 'shifts', 'hospital_staff', e 'departments'. Responda de forma analítica sugerindo correções.`,
      tier: 'reasoning',
      tools: [
        { collection: 'shifts', perms: { list: true, read: true } },
        { collection: 'hospital_staff', perms: { list: true, read: true } },
        { collection: 'departments', perms: { list: true, read: true } },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'escala-expert')
  },
)
