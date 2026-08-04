import pb from '@/lib/pocketbase/client'

export type CheckStatus = 'loading' | 'pass' | 'fail'

export interface CheckItem {
  id: string
  label: string
  status: CheckStatus
  message?: string
}

export const INITIAL_CHECKS: CheckItem[] = [
  { id: 'backend-connectivity', label: 'Conectividade com o servidor', status: 'loading' },
  { id: 'database-integrity', label: 'Integridade do banco de dados', status: 'loading' },
  { id: 'ia-tools', label: 'Ferramentas de IA ativas', status: 'loading' },
  { id: 'shift-cycles', label: 'Ciclos de escala ativos', status: 'loading' },
  { id: 'users-access', label: 'Acesso a dados de usuários', status: 'loading' },
  { id: 'staff-contracts', label: 'Contratos de colaboradores', status: 'loading' },
]

type UpdateFn = (id: string, status: 'pass' | 'fail', message?: string) => void

async function checkBackendConnectivity(update: UpdateFn) {
  try {
    await pb.collection('users').getList(1, 1)
    update('backend-connectivity', 'pass')
  } catch (err) {
    update('backend-connectivity', 'fail', 'Servidor indisponível')
  }
}

const ESSENTIAL_COLLECTIONS = [
  'users',
  'departments',
  'ia_tools',
  'shift_cycles',
  'hospital_sectors',
  'staff_contracts',
  'staff_profiles',
  'shifts',
] as const

async function checkDatabaseIntegrity(update: UpdateFn) {
  try {
    await pb.collection('users').getList(1, 1)

    const results = await Promise.allSettled(
      ESSENTIAL_COLLECTIONS.map((col) => pb.collection(col).getList(1, 1)),
    )

    const failedCollections: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        failedCollections.push(ESSENTIAL_COLLECTIONS[i])
      }
    })

    if (failedCollections.length === 0) {
      update('database-integrity', 'pass')
    } else {
      const message =
        failedCollections.length === ESSENTIAL_COLLECTIONS.length
          ? 'Banco de dados inacessível — todas as coleções essenciais falharam'
          : `Coleções com falha: ${failedCollections.join(', ')}`
      update('database-integrity', 'fail', message)
    }
  } catch (err) {
    update(
      'database-integrity',
      'fail',
      'Não foi possível verificar a integridade do banco de dados',
    )
  }
}

async function checkIaTools(update: UpdateFn) {
  try {
    const result = await pb.collection('ia_tools').getList(1, 1, { filter: 'status = "active"' })
    if (result.items.length > 0) {
      update('ia-tools', 'pass')
    } else {
      update('ia-tools', 'fail', 'Nenhuma ferramenta de IA ativa encontrada')
    }
  } catch {
    update('ia-tools', 'fail', 'Não foi possível verificar as ferramentas de IA')
  }
}

async function checkShiftCycles(update: UpdateFn) {
  try {
    const result = await pb
      .collection('shift_cycles')
      .getList(1, 1, { filter: 'status = "active"' })
    if (result.items.length > 0) {
      update('shift-cycles', 'pass')
    } else {
      update('shift-cycles', 'fail', 'Nenhum ciclo de escala ativo encontrado')
    }
  } catch {
    update('shift-cycles', 'fail', 'Não foi possível verificar os ciclos de escala')
  }
}

async function checkUsersAccess(update: UpdateFn) {
  try {
    await pb.collection('users').getList(1, 1)
    update('users-access', 'pass')
  } catch {
    update('users-access', 'fail', 'Não foi possível acessar os dados de usuários')
  }
}

async function checkStaffContracts(update: UpdateFn) {
  try {
    const result = await pb.collection('staff_contracts').getList(1, 1)
    if (result.items.length > 0) {
      update('staff-contracts', 'pass')
    } else {
      update('staff-contracts', 'fail', 'Nenhum contrato de colaborador encontrado')
    }
  } catch {
    update('staff-contracts', 'fail', 'Não foi possível acessar os contratos')
  }
}

export async function runSystemChecks(update: UpdateFn): Promise<void> {
  await Promise.all([
    checkBackendConnectivity(update),
    checkDatabaseIntegrity(update),
    checkIaTools(update),
    checkShiftCycles(update),
    checkUsersAccess(update),
    checkStaffContracts(update),
  ])
}
