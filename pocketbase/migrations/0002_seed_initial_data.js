migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'eduardo.morais@idcorp.com.br')
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('eduardo.morais@idcorp.com.br')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Admin')
      app.save(adminUser)
    }

    const tools = app.findCollectionByNameOrId('ia_tools')
    const iaToolsData = [
      {
        name: 'Assistente Jurídico',
        description: 'Análise de contratos e peças jurídicas',
        model_alias: 'reasoning',
        status: 'active',
        version: 'v1.0.0',
      },
      {
        name: 'Resumo de Prontuários',
        description: 'Sintetização de histórico clínico',
        model_alias: 'fast',
        status: 'active',
        version: 'v1.2.0',
      },
      {
        name: 'Análise de Sentimento',
        description: 'Classificação de feedback de pacientes',
        model_alias: 'fast',
        status: 'draft',
        version: 'v0.9.0',
      },
    ]

    for (const t of iaToolsData) {
      try {
        app.findFirstRecordByData('ia_tools', 'name', t.name)
      } catch (_) {
        const record = new Record(tools)
        record.set('name', t.name)
        record.set('description', t.description)
        record.set('model_alias', t.model_alias)
        record.set('status', t.status)
        record.set('version', t.version)
        app.save(record)
      }
    }

    const logs = app.findCollectionByNameOrId('audit_logs')
    const logsData = [
      { action: 'Login', department: 'TI', token_usage: 0, details: 'User login' },
      {
        action: 'Resumo de Prontuários',
        department: 'Medicina',
        token_usage: 1250,
        details: 'Paciente 123',
      },
      {
        action: 'Análise de Sentimento',
        department: 'Qualidade',
        token_usage: 450,
        details: 'Feedback 456',
      },
    ]

    const existingLogs = app.findRecordsByFilter('audit_logs', "action = 'Login'", '', 1, 0)
    if (existingLogs.length === 0) {
      for (const l of logsData) {
        const record = new Record(logs)
        record.set('user', adminUser.id)
        record.set('action', l.action)
        record.set('department', l.department)
        record.set('token_usage', l.token_usage)
        record.set('details', l.details)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'eduardo.morais@idcorp.com.br')
      app.delete(adminUser)
    } catch (_) {}

    try {
      app
        .db()
        .newQuery(
          "DELETE FROM ia_tools WHERE name IN ('Assistente Jurídico', 'Resumo de Prontuários', 'Análise de Sentimento')",
        )
        .execute()
    } catch (_) {}
    try {
      app.db().newQuery('DELETE FROM audit_logs').execute()
    } catch (_) {}
  },
)
