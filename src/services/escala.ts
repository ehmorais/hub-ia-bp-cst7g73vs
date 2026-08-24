import pb from '@/lib/pocketbase/client'

// Shift Cycles
export const getShiftCycles = () =>
  pb.collection('shift_cycles').getFullList({ sort: '-start_date' })
export const createShiftCycle = (data: any) => pb.collection('shift_cycles').create(data)
export const updateShiftCycle = (id: string, data: any) =>
  pb.collection('shift_cycles').update(id, data)
export const deleteShiftCycle = (id: string) => pb.collection('shift_cycles').delete(id)
export const submitCycleToHR = (cycleId: string) =>
  pb.send('/backend/v1/escala/submit-hr', {
    method: 'POST',
    body: JSON.stringify({ cycle_id: cycleId }),
    headers: { 'Content-Type': 'application/json' },
  })

// Shift Types
export const getShiftTypes = () => pb.collection('shift_types').getFullList({ sort: 'name' })
export const createShiftType = (data: any) => pb.collection('shift_types').create(data)
export const updateShiftType = (id: string, data: any) =>
  pb.collection('shift_types').update(id, data)
export const deleteShiftType = (id: string) => pb.collection('shift_types').delete(id)

// Hospital Sectors
export const getHospitalSectors = (departmentId?: string) => {
  const opts: any = { sort: 'name', expand: 'department' }
  if (departmentId) {
    opts.filter = `department="${departmentId}"`
  }
  return pb.collection('hospital_sectors').getFullList(opts)
}
export const createHospitalSector = (data: any) => pb.collection('hospital_sectors').create(data)
export const updateHospitalSector = (id: string, data: any) =>
  pb.collection('hospital_sectors').update(id, data)
export const deleteHospitalSector = (id: string) => pb.collection('hospital_sectors').delete(id)

/**
 * Setor ↔ referências: conta, de forma performática (1 item por coleção),
 * quantos registros dependem de um setor. Usado como preflight de exclusão:
 * se houver QUALQUER vínculo, a exclusão física será bloqueada pelo PocketBase
 * (erro 400 "required relation reference") e o usuário deve desativar o setor.
 */
export async function checkSectorReferences(sectorId: string): Promise<{
  staffProfiles: number
  shifts: number
  drafts: number
  runs: number
  total: number
}> {
  const [staffProfiles, shifts, drafts, runs] = await Promise.all([
    pb.collection('staff_profiles').getList(1, 1, { filter: `default_sector="${sectorId}"` }),
    pb.collection('shifts').getList(1, 1, { filter: `sector="${sectorId}"` }),
    pb.collection('schedule_drafts').getList(1, 1, { filter: `sector="${sectorId}"` }),
    pb.collection('schedule_generation_runs').getList(1, 1, { filter: `sector="${sectorId}"` }),
  ])
  const counts = {
    staffProfiles: staffProfiles.totalItems,
    shifts: shifts.totalItems,
    drafts: drafts.totalItems,
    runs: runs.totalItems,
  }
  return {
    ...counts,
    total: counts.staffProfiles + counts.shifts + counts.drafts + counts.runs,
  }
}

// Staff Roles
export const getStaffRoles = () =>
  pb.collection('staff_roles').getFullList({ sort: '-hierarchy_rank' })
export const createStaffRole = (data: any) => pb.collection('staff_roles').create(data)
export const updateStaffRole = (id: string, data: any) =>
  pb.collection('staff_roles').update(id, data)
export const deleteStaffRole = (id: string) => pb.collection('staff_roles').delete(id)

// Staff Profiles
export const getStaffProfiles = () =>
  pb.collection('staff_profiles').getFullList({
    sort: 'name',
    expand: 'staff_role,default_sector,rules,staff_contracts',
  })
export const createStaffProfile = (data: any) => pb.collection('staff_profiles').create(data)
export const updateStaffProfile = (id: string, data: any) =>
  pb.collection('staff_profiles').update(id, data)
export const deleteStaffProfile = (id: string) => pb.collection('staff_profiles').delete(id)

// Staff Contracts
export const getStaffContracts = () =>
  pb
    .collection('staff_contracts')
    .getFullList({ expand: 'staff_profile,staff_profile.default_sector,user,shift_type' })
export const createStaffContract = (data: any) => pb.collection('staff_contracts').create(data)
export const updateStaffContract = (id: string, data: any) =>
  pb.collection('staff_contracts').update(id, data)
export const deleteStaffContract = (id: string) => pb.collection('staff_contracts').delete(id)

// Shift Rules
export const getShiftRules = (departmentId?: string) => {
  const opts: any = { sort: '-created' }
  if (departmentId) opts.filter = `department="${departmentId}"`
  return pb.collection('shift_rules').getFullList(opts)
}
export const createShiftRule = (data: any) => pb.collection('shift_rules').create(data)
export const updateShiftRule = (id: string, data: any) =>
  pb.collection('shift_rules').update(id, data)
export const deleteShiftRule = (id: string) => pb.collection('shift_rules').delete(id)

// Shifts
export const getShifts = (cycleId?: string) => {
  const opts: any = {
    sort: 'start_time',
    expand: 'staff_profile,staff_profile.staff_role,user,sector',
  }
  if (cycleId) opts.filter = `cycle="${cycleId}"`
  return pb.collection('shifts').getFullList(opts)
}
export const generateShifts = (
  cycleId: string,
  sectorIds: string[],
  rules?: string,
  priority?: string,
  strictness?: number,
) =>
  pb.send('/backend/v1/escala/generate', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: cycleId,
      sector_ids: sectorIds,
      rules: rules || '',
      priority: priority || 'staffing',
      strictness: strictness ?? 50,
    }),
    headers: { 'Content-Type': 'application/json' },
  })

// Structured response returned by the AI draft generation endpoint. Includes
// the run_id + draft_id used to track the generation run and the persisted
// schedule_draft (for metrics/issues inspection in the UI).
export type GenerateDraftResponse = {
  success?: boolean
  draft_exists?: boolean
  existing_count?: number
  existing_run_id?: string
  existing_draft_id?: string
  run_id?: string
  draft_id?: string
  source?: 'ai' | 'fallback'
  draft?: any[]
  warnings?: string[]
  diagnostics?: any
  cycle_id?: string
  sector_id?: string
  error?: string
  violations?: string[]
  suggestion?: string
  stage?: string
  detail?: string
  message?: string
}

export const generateDraftShifts = (
  cycleId: string,
  sectorId: string,
  context: any,
  additionalPrompt?: string,
  currentDraft?: any[],
  replace = false,
): Promise<GenerateDraftResponse> => {
  // Extract priority/strictness onto the top level of the payload — the hook
  // reads them there. The nested context.ai_settings shape is also still
  // accepted by the hook as a fallback, but sending them at the top is the
  // authoritative contract.
  const aiSettings = context?.ai_settings || {}
  return pb.send('/backend/v1/escala/draft', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: cycleId,
      sector_id: sectorId,
      priority: aiSettings.priority || 'timeoff',
      strictness: aiSettings.strictness ?? 50,
      additional_prompt: additionalPrompt || '',
      current_draft: currentDraft || null,
      replace: replace || false,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

// --- Schedule generation tracking accessors ---

// Fetch a generation run by id (includes status, stage, progress, metrics,
// ai_diagnostics — the full rastreability record).
export const getGenerationRun = (id: string) => pb.collection('schedule_generation_runs').getOne(id)

// Fetch a schedule draft by id, expanding its cycle/sector/run relations.
export const getDraft = (id: string) =>
  pb.collection('schedule_drafts').getOne(id, { expand: 'cycle,sector,generation_run' })

// Fetch all validation issues attached to a draft (violations + warnings).
export const getDraftIssues = (draftId: string) =>
  pb
    .collection('schedule_validation_issues')
    .getFullList({ filter: `draft="${draftId}"`, sort: '-severity' })

// Fetch all validation issues attached to a run (used when a run failed
// validation and no draft was persisted).
export const getRunIssues = (runId: string) =>
  pb
    .collection('schedule_validation_issues')
    .getFullList({ filter: `run="${runId}"`, sort: '-severity' })

// Draft shifts persisted for a given cycle + sector (read-only fetch).
export const getDraftShifts = (cycleId: string, sectorId: string) =>
  pb.collection('shifts').getFullList({
    filter: `cycle="${cycleId}" && sector="${sectorId}"`,
    expand: 'staff_profile,sector,cycle',
    sort: 'start_time',
  })

export const commitShiftSchedule = (
  cycleId: string,
  sectorId: string,
  shifts: any[],
  publish = false,
  draftId?: string,
) =>
  pb.send('/backend/v1/escala/commit', {
    method: 'POST',
    body: JSON.stringify({
      cycle_id: cycleId,
      sector_id: sectorId,
      shifts,
      publish,
      draft_id: draftId,
    }),
    headers: { 'Content-Type': 'application/json' },
  })

export const moveWeekendOff = (
  draftId: string,
  staffId: string,
  sourceDate: string,
  targetDate: string,
) =>
  pb.send('/backend/v1/escala/move-weekend-off', {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draftId,
      staff_id: staffId,
      source_date: sourceDate,
      target_date: targetDate,
    }),
    headers: { 'Content-Type': 'application/json' },
  })

// Timeoff Requests
export const getTimeoffRequests = () =>
  pb
    .collection('timeoff_requests')
    .getFullList({ expand: 'staff_profile,user,cycle', sort: '-created' })
export const createTimeoffRequest = (data: any) => pb.collection('timeoff_requests').create(data)
export const updateTimeoffRequest = (id: string, data: any) =>
  pb.collection('timeoff_requests').update(id, data)
export const deleteTimeoffRequest = (id: string) => pb.collection('timeoff_requests').delete(id)

// Users
export const getUsers = () =>
  pb
    .collection('users')
    .getFullList({ sort: 'name', expand: 'staff_role,default_sector,assigned_rules,staff_profile' })
export const createUser = (data: any) => pb.collection('users').create(data)
export const updateUser = (id: string, data: any) => pb.collection('users').update(id, data)
export const deleteUser = (id: string) => pb.collection('users').delete(id)

// Collaborator Import (Excel)
export const importCollaborators = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
  }
  const base64 = btoa(binary)
  return pb.send('/backend/v1/escala/import', {
    method: 'POST',
    body: JSON.stringify({ file: base64, filename: file.name }),
    headers: { 'Content-Type': 'application/json' },
  })
}
