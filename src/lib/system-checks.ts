import pb from '@/lib/pocketbase/client'

export interface CheckItem {
  id: string
  label: string
  status: 'pass' | 'fail' | 'loading'
  message?: string
}

export const INITIAL_CHECKS: CheckItem[] = [
  { id: 'db', label: 'Banco de Dados', status: 'loading' },
  { id: 'db_integrity', label: 'Integridade e Disponibilidade do Banco', status: 'loading' },
  { id: 'tools', label: 'Ferramentas de IA', status: 'loading' },
  { id: 'cycles', label: 'Ciclos de Escala', status: 'loading' },
  { id: 'users', label: 'Usuários', status: 'loading' },
  { id: 'contracts', label: 'Contratos de Staff', status: 'loading' },
  { id: 'departments', label: 'Departamentos', status: 'loading' },
  { id: 'projects', label: 'Projetos', status: 'loading' },
]

const TIMEOUT_MS = 15000

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
  ])
}

export type UpdateCheckFn = (id: string, status: 'pass' | 'fail', message?: string) => void

export async function runSystemChecks(update: UpdateCheckFn): Promise<void> {
  try {
    await withTimeout(pb.health.check())
    update('db', 'pass')
  } catch {
    update('db', 'fail', 'Backend indisponível ou tempo limite excedido')
  }

  try {
    const cols = [
      'ia_tools',
      'shift_cycles',
      'users',
      'staff_contracts',
      'departments',
      'projects',
      'hospital_sectors',
      'shift_types',
      'staff_profiles',
      'shift_rules',
      'shifts',
      'timeoff_requests',
      'audit_logs',
      'staff_roles',
    ]
    const results = await withTimeout(
      Promise.allSettled(cols.map((c) => pb.collection(c).getList(1, 1))),
    )
    const failed = results
      .map((r, i) => (r.status === 'rejected' ? cols[i] : null))
      .filter(Boolean) as string[]
    if (failed.length === 0) {
      update('db_integrity', 'pass')
    } else {
      update('db_integrity', 'fail', `Coleções inacessíveis: ${failed.join(', ')}`)
    }
  } catch {
    update('db_integrity', 'fail', 'Tempo limite ao validar integridade das coleções')
  }

  try {
    const t = await withTimeout(
      pb.collection('ia_tools').getList(1, 1, { filter: 'status = "active"' }),
    )
    update(
      'tools',
      t.items.length > 0 ? 'pass' : 'fail',
      t.items.length === 0 ? 'Nenhuma ferramenta ativa' : undefined,
    )
  } catch {
    update('tools', 'fail', 'Erro ao acessar ferramentas de IA')
  }

  try {
    const c = await withTimeout(
      pb.collection('shift_cycles').getList(1, 1, { filter: 'status = "active"' }),
    )
    update(
      'cycles',
      c.items.length > 0 ? 'pass' : 'fail',
      c.items.length === 0 ? 'Nenhum ciclo ativo' : undefined,
    )
  } catch {
    update('cycles', 'fail', 'Erro ao acessar ciclos de escala')
  }

  try {
    await withTimeout(pb.collection('users').getList(1, 1))
    update('users', 'pass')
  } catch {
    update('users', 'fail', 'Erro ao acessar usuários')
  }

  try {
    await withTimeout(pb.collection('staff_contracts').getList(1, 1))
    update('contracts', 'pass')
  } catch {
    update('contracts', 'fail', 'Erro ao acessar contratos')
  }

  try {
    await withTimeout(pb.collection('departments').getList(1, 1))
    update('departments', 'pass')
  } catch {
    update('departments', 'fail', 'Erro ao acessar departamentos')
  }

  try {
    await withTimeout(pb.collection('projects').getList(1, 1))
    update('projects', 'pass')
  } catch {
    update('projects', 'fail', 'Erro ao acessar projetos')
  }
}
