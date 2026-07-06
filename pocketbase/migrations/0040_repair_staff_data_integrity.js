migrate(
  (app) => {
    var staffRoleId = ''
    try {
      var existingRole = app.findFirstRecordByData('staff_roles', 'name', 'Staff')
      staffRoleId = existingRole.id
    } catch (_) {
      var rolesCol = app.findCollectionByNameOrId('staff_roles')
      var newRole = new Record(rolesCol)
      newRole.set('name', 'Staff')
      newRole.set('hierarchy_rank', 1)
      newRole.set('requires_supervision', true)
      app.save(newRole)
      staffRoleId = newRole.id
    }

    var enfermeiroRoleId = ''
    try {
      var enfRole = app.findFirstRecordByData('staff_roles', 'name', 'Enfermeiro')
      enfermeiroRoleId = enfRole.id
    } catch (_) {}

    var users = app.findRecordsByFilter('users', '', '', 10000, 0)
    var contractsCol = app.findCollectionByNameOrId('staff_contracts')
    var fixedRoles = 0
    var fixedContracts = 0

    users.forEach(function (u) {
      var currentRoleId = u.getString('staff_role')
      var userRole = u.getString('role')

      if (!currentRoleId) {
        var assignRoleId = staffRoleId
        if (userRole === 'Admin' && enfermeiroRoleId) {
          assignRoleId = enfermeiroRoleId
        }
        u.set('staff_role', assignRoleId)
        app.save(u)
        fixedRoles++
      }

      var hasContract = false
      try {
        app.findFirstRecordByFilter('staff_contracts', "user='" + u.id + "'")
        hasContract = true
      } catch (_) {}

      if (!hasContract) {
        var contract = new Record(contractsCol)
        contract.set('user', u.id)
        contract.set('contract_type', 'PJ')
        contract.set('monthly_hour_limit', 180)
        app.save(contract)
        fixedContracts++
      }
    })

    var auditCol = app.findCollectionByNameOrId('audit_logs')
    var audit = new Record(auditCol)
    audit.set('action', 'MIGRATION_0040_STAFF_REPAIR')
    audit.set(
      'details',
      JSON.stringify({
        fixed_roles: fixedRoles,
        fixed_contracts: fixedContracts,
        total_users: users.length,
      }),
    )
    app.saveNoValidate(audit)
  },
  (app) => {
    // Non-destructive down migration
  },
)
