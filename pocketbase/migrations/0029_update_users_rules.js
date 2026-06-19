migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    users.updateRule = "@request.auth.id != ''"
    users.deleteRule = "@request.auth.id != ''"
    app.save(users)

    const timeoff = app.findCollectionByNameOrId('timeoff_requests')
    timeoff.listRule = "@request.auth.id != ''"
    timeoff.viewRule = "@request.auth.id != ''"
    timeoff.createRule = "@request.auth.id != ''"
    timeoff.updateRule = "@request.auth.id != ''"
    timeoff.deleteRule = "@request.auth.id != ''"
    app.save(timeoff)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
