import pb from '@/lib/pocketbase/client'

export const getAuditLogs = () =>
  pb.collection('audit_logs').getFullList({ sort: '-created', expand: 'user' })
export const getIaTools = () => pb.collection('ia_tools').getFullList({ sort: 'name' })
export const getUsers = () => pb.collection('users').getFullList({ sort: 'name' })
export const getDepartments = () =>
  pb.collection('departments').getFullList({ sort: 'sort_order,name' })

export const createDepartment = (data: any, userId?: string) =>
  pb.collection('departments').create(data)
export const updateDepartment = (id: string, data: any, userId?: string) =>
  pb.collection('departments').update(id, data)
export const deleteDepartment = (id: string, name: string, userId?: string) =>
  pb.collection('departments').delete(id)

export const getProjects = () =>
  pb.collection('projects').getFullList({
    sort: 'sort_order,name',
    expand: 'department,associated_departments,members',
  })
export const createProject = (data: any, userId?: string, depName?: string) =>
  pb.collection('projects').create(data)
export const updateProject = (id: string, data: any, userId?: string, depName?: string) =>
  pb.collection('projects').update(id, data)
export const deleteProject = (id: string, name: string, userId?: string, depName?: string) =>
  pb.collection('projects').delete(id)

export const createIaTool = (data: any) => pb.collection('ia_tools').create(data)
export const updateIaTool = (id: string, data: any) => pb.collection('ia_tools').update(id, data)
