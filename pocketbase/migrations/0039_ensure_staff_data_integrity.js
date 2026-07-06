migrate(
  (app) => {
    var enfermeiroRoleId = ''
    try {
      var role = app.findFirstRecordByData('staff_roles', 'name', 'Enfermeiro')
      enfermeiroRoleId = role.id
    } catch (_) {
      var rolesCol = app.findCollectionByNameOrId('staff_roles')
      var newRole = new Record(rolesCol)
      newRole.set('name', 'Enfermeiro')
      newRole.set('hierarchy_rank', 2)
      newRole.set('requires_supervision', false)
      app.save(newRole)
      enfermeiroRoleId = newRole.id
    }

    var users = app.findRecordsByFilter('users', '', '', 10000, 0)
    var contractsCol = app.findCollectionByNameOrId('staff_contracts')

    users.forEach(function (u) {
      var currentRoleId = u.getString('staff_role')
      if (!currentRoleId) {
        u.set('staff_role', enfermeiroRoleId)
        app.save(u)
      }

      try {
        app.findFirstRecordByFilter('staff_contracts', "user='" + u.id + "'")
      } catch (_) {
        var contract = new Record(contractsCol)
        contract.set('user', u.id)
        contract.set('contract_type', 'CLT 180h')
        contract.set('monthly_hour_limit', 180)
        app.save(contract)
      }
    })
  },
  (app) => {
    // Non-destructive down migration: contracts created here are left in place
    // since they may have been edited by the user after creation.
  },
)
