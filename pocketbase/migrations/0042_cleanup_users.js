migrate(
  (app) => {
    const PROTECTED_EMAIL = 'eduardo.morais@idcorp.com.br'
    const PROTECTED_NAMES = ['rodrigo silva', 'rogrigo silva']

    let protectedIds = []

    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', PROTECTED_EMAIL)
      if (admin) protectedIds.push(admin.id)
    } catch (_) {}

    const allUsers = app.findRecordsByFilter('_pb_users_auth_', 'id != ""', '', 500, 0)
    for (const u of allUsers) {
      const name = (u.getString('name') || '').trim().toLowerCase()
      if (PROTECTED_NAMES.includes(name) && !protectedIds.includes(u.id)) {
        protectedIds.push(u.id)
      }
    }

    for (const u of allUsers) {
      if (protectedIds.includes(u.id)) continue
      try {
        app.delete(u)
      } catch (_) {}
    }
  },
  (app) => {
    // Non-reversible: deleted records cannot be restored.
  },
)
