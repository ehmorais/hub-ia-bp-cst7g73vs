import pb from '@/lib/pocketbase/client'

// Shift Cycles
export const getShiftCycles = () =>
  pb.collection('shift_cycles').getFullList({ sort: '-start_date' })
export const createShiftCycle = (data: any) => pb.collection('shift_cycles').create(data)
export const updateShiftCycle = (id: string, data: any) =>
  pb.collection('shift_cycles').update(id, data)
export const deleteShiftCycle = (id: string) => pb.collection('shift_cycles').delete(id)

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

// Staff Roles
export const getStaffRoles = () =>
  pb.collection('staff_roles').getFullList({ sort: '-hierarchy_rank' })
export const createStaffRole = (data: any) => pb.collection('staff_roles').create(data)
export const updateStaffRole = (id: string, data: any) =>
  pb.collection('staff_roles').update(id, data)
export const deleteStaffRole = (id: string) => pb.collection('staff_roles').delete(id)

// Staff Profiles
export const getStaffProfiles = () => pb.collection('staff_profiles').getFullList({ sort: 'name' })
export const createStaffProfile = (data: any) => pb.collection('staff_profiles').create(data)
export const updateStaffProfile = (id: string, data: any) =>
  pb.collection('staff_profiles').update(id, data)
export const deleteStaffProfile = (id: string) => pb.collection('staff_profiles').delete(id)

// Staff Contracts
export const getStaffContracts = () =>
  pb.collection('staff_contracts').getFullList({ expand: 'user,shift_type' })
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
  const opts: any = { sort: 'start_time', expand: 'user,sector' }
  if (cycleId) opts.filter = `cycle="${cycleId}"`
  return pb.collection('shifts').getFullList(opts)
}
export const generateShifts = (cycleId: string, departmentId: string, sectorId?: string) =>
  pb.send('/backend/v1/escala/generate', {
    method: 'POST',
    body: JSON.stringify({ cycle_id: cycleId, department_id: departmentId, sector_id: sectorId }),
    headers: { 'Content-Type': 'application/json' },
  })

// Timeoff Requests
export const getTimeoffRequests = () =>
  pb.collection('timeoff_requests').getFullList({ expand: 'user,cycle', sort: '-created' })
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
