import pb from '@/lib/pocketbase/client'

// Shift Cycles
export const getShiftCycles = () =>
  pb.collection('shift_cycles').getFullList({ sort: '-start_date' })
export const createShiftCycle = (data: any) => pb.collection('shift_cycles').create(data)
export const updateShiftCycle = (id: string, data: any) =>
  pb.collection('shift_cycles').update(id, data)
export const deleteShiftCycle = (id: string) => pb.collection('shift_cycles').delete(id)

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

// Staff Contracts
export const getStaffContracts = () =>
  pb.collection('staff_contracts').getFullList({ expand: 'user' })
export const createStaffContract = (data: any) => pb.collection('staff_contracts').create(data)
export const updateStaffContract = (id: string, data: any) =>
  pb.collection('staff_contracts').update(id, data)

// Timeoff Requests
export const getTimeoffRequests = () =>
  pb.collection('timeoff_requests').getFullList({ expand: 'user,cycle', sort: '-created' })
export const updateTimeoffRequest = (id: string, data: any) =>
  pb.collection('timeoff_requests').update(id, data)

// Users
export const getUsers = () =>
  pb.collection('users').getFullList({ sort: 'name', expand: 'staff_role' })
export const updateUser = (id: string, data: any) => pb.collection('users').update(id, data)
