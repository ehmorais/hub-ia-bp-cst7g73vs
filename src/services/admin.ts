import pb from '@/lib/pocketbase/client'

export const getAuditLogs = () =>
  pb.collection('audit_logs').getFullList({ expand: 'user', sort: '-created' })

export const getIaTools = () => pb.collection('ia_tools').getFullList({ sort: '-created' })

export const getUsers = () => pb.collection('users').getFullList({ sort: '-created' })

export const getDepartments = () => pb.collection('departments').getFullList({ sort: 'name' })

export const createDepartment = (data: { name: string; description?: string }) =>
  pb.collection('departments').create(data)

export const updateDepartment = (
  id: string,
  data: Partial<{ name: string; description: string }>,
) => pb.collection('departments').update(id, data)

export const deleteDepartment = (id: string) => pb.collection('departments').delete(id)

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
