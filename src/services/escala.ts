import pb from '@/lib/pocketbase/client'

export const getShiftCycles = () =>
  pb.collection('shift_cycles').getFullList({ sort: '-start_date' })
export const createShiftCycle = (data: any) => pb.collection('shift_cycles').create(data)
export const updateShiftCycle = (id: string, data: any) =>
  pb.collection('shift_cycles').update(id, data)

export const getHospitalSectors = () =>
  pb.collection('hospital_sectors').getFullList({ sort: 'name', expand: 'department' })
export const createHospitalSector = (data: any) => pb.collection('hospital_sectors').create(data)
export const updateHospitalSector = (id: string, data: any) =>
  pb.collection('hospital_sectors').update(id, data)

export const getStaffRoles = () =>
  pb.collection('staff_roles').getFullList({ sort: '-hierarchy_rank' })
export const getStaffContracts = () =>
  pb.collection('staff_contracts').getFullList({ expand: 'user' })
export const getTimeoffRequests = () =>
  pb.collection('timeoff_requests').getFullList({ expand: 'user,cycle' })
