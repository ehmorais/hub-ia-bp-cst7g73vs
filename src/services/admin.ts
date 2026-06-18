import pb from '@/lib/pocketbase/client'

export const getAuditLogs = () =>
  pb.collection('audit_logs').getFullList({ sort: '-created', expand: 'user' })
export const getIaTools = () => pb.collection('ia_tools').getFullList({ sort: 'name' })
export const getUsers = () => pb.collection('users').getFullList({ sort: 'name' })
export const getDepartments = () => pb.collection('departments').getFullList({ sort: 'sort_order' })

export const createDepartment = async (data: any, userId?: string) => {
  const res = await pb.collection('departments').create(data)
  if (userId) {
    await pb.collection('audit_logs').create({
      user: userId,
      action: `Created department: ${data.name}`,
      department: data.name,
      details: 'Department creation',
      token_usage: 0,
    })
  }
  return res
}

export const updateDepartment = async (id: string, data: any, userId?: string) => {
  const res = await pb.collection('departments').update(id, data)
  if (userId) {
    await pb.collection('audit_logs').create({
      user: userId,
      action: `Updated department: ${data.name}`,
      department: data.name,
      details: 'Department update',
      token_usage: 0,
    })
  }
  return res
}

export const deleteDepartment = async (id: string, name: string, userId?: string) => {
  await pb.collection('departments').delete(id)
  if (userId) {
    await pb.collection('audit_logs').create({
      user: userId,
      action: `Deleted department: ${name}`,
      department: name,
      details: 'Department deletion',
      token_usage: 0,
    })
  }
}

export const getProjects = () =>
  pb.collection('projects').getFullList({ sort: 'sort_order', expand: 'department,members' })

export const createProject = async (data: any, userId?: string, depName?: string) => {
  const res = await pb.collection('projects').create(data)
  if (userId) {
    await pb.collection('audit_logs').create({
      user: userId,
      action: `Created project: ${data.name}`,
      department: depName || '-',
      details: 'Project creation',
      token_usage: 0,
    })
  }
  return res
}

export const updateProject = async (id: string, data: any, userId?: string, depName?: string) => {
  const res = await pb.collection('projects').update(id, data)
  if (userId) {
    await pb.collection('audit_logs').create({
      user: userId,
      action: `Updated project: ${data.name}`,
      department: depName || '-',
      details: 'Project update',
      token_usage: 0,
    })
  }
  return res
}

export const deleteProject = async (
  id: string,
  name: string,
  userId?: string,
  depName?: string,
) => {
  await pb.collection('projects').delete(id)
  if (userId) {
    await pb.collection('audit_logs').create({
      user: userId,
      action: `Deleted project: ${name}`,
      department: depName || '-',
      details: 'Project deletion',
      token_usage: 0,
    })
  }
}

export const createIaTool = (data: any) => pb.collection('ia_tools').create(data)
export const updateIaTool = (id: string, data: any) => pb.collection('ia_tools').update(id, data)
