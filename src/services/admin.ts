import pb from '@/lib/pocketbase/client'

export const getAuditLogs = () =>
  pb.collection('audit_logs').getFullList({ expand: 'user', sort: '-created' })

export const getIaTools = () => pb.collection('ia_tools').getFullList({ sort: '-created' })

export const getUsers = () => pb.collection('users').getFullList({ sort: '-created' })

export const getDepartments = () =>
  pb.collection('departments').getFullList({ sort: 'sort_order,name' })

export const createDepartment = (data: {
  name: string
  description?: string
  sort_order?: number
}) => pb.collection('departments').create(data)

export const updateDepartment = (
  id: string,
  data: Partial<{ name: string; description: string; sort_order: number }>,
) => pb.collection('departments').update(id, data)

export const deleteDepartment = (id: string) => pb.collection('departments').delete(id)

export const getProjects = () =>
  pb.collection('projects').getFullList({ expand: 'department', sort: 'sort_order,name' })

export const createProject = (data: any) => pb.collection('projects').create(data)

export const updateProject = (id: string, data: any) => pb.collection('projects').update(id, data)

export const deleteProject = (id: string) => pb.collection('projects').delete(id)

export const createIaTool = (data: {
  name: string
  description?: string
  model_alias: string
  status: string
  version?: string
}) => pb.collection('ia_tools').create(data)

export const updateIaTool = (
  id: string,
  data: Partial<{
    name: string
    description: string
    model_alias: string
    status: string
    version: string
  }>,
) => pb.collection('ia_tools').update(id, data)
