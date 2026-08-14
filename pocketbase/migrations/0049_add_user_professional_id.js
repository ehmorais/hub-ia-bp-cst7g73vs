migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('professional_id')) {
      users.fields.add(
        new TextField({
          name: 'professional_id',
          max: 100,
          required: false,
        }),
      )
    }

    users.updateRule =
      "@request.auth.role = 'Admin' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.email:changed = false && @request.body.verified:changed = false && @request.body.password:changed = false && @request.body.professional_id:changed = false)"

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (users.fields.getByName('professional_id')) {
      users.fields.removeByName('professional_id')
    }

    users.updateRule =
      "@request.auth.role = 'Admin' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.email:changed = false && @request.body.verified:changed = false && @request.body.password:changed = false)"

    app.save(users)
  },
)
