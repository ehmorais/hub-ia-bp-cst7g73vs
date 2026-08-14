migrate(
  (app) => {
    const rules = {
      users: {
        listRule: "@request.auth.role = 'Admin' || id = @request.auth.id",
        viewRule: "@request.auth.role = 'Admin' || id = @request.auth.id",
        createRule: "@request.auth.role = 'Admin'",
        updateRule:
          "@request.auth.role = 'Admin' || (id = @request.auth.id && @request.body.role:changed = false && @request.body.email:changed = false && @request.body.verified:changed = false && @request.body.password:changed = false)",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      audit_logs: {
        listRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        viewRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        createRule: null,
        updateRule: null,
        deleteRule: null,
      },
      ia_tools: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      departments: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      projects: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      shift_cycles: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      hospital_sectors: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      staff_roles: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      staff_contracts: {
        listRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        viewRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      timeoff_requests: {
        listRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        viewRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        createRule:
          "@request.auth.role = 'Admin' || (@request.auth.id != '' && @request.body.user = @request.auth.id && @request.body.status = 'pending')",
        updateRule:
          "@request.auth.role = 'Admin' || (@request.auth.id != '' && user = @request.auth.id && status = 'pending' && @request.body.user:changed = false && @request.body.status:changed = false)",
        deleteRule:
          "@request.auth.role = 'Admin' || (@request.auth.id != '' && user = @request.auth.id && status = 'pending')",
      },
      shift_rules: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      shifts: {
        listRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        viewRule: "@request.auth.role = 'Admin' || user = @request.auth.id",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      shift_types: {
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
      staff_profiles: {
        listRule: "@request.auth.role = 'Admin'",
        viewRule: "@request.auth.role = 'Admin'",
        createRule: "@request.auth.role = 'Admin'",
        updateRule: "@request.auth.role = 'Admin'",
        deleteRule: "@request.auth.role = 'Admin'",
      },
    }

    Object.keys(rules).forEach((name) => {
      const collection = app.findCollectionByNameOrId(name)
      const next = rules[name]
      collection.listRule = next.listRule
      collection.viewRule = next.viewRule
      collection.createRule = next.createRule
      collection.updateRule = next.updateRule
      collection.deleteRule = next.deleteRule
      app.save(collection)
    })
  },
  (app) => {
    const previous = {
      users: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        '',
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      audit_logs: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      ia_tools: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
      ],
      departments: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
      ],
      projects: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
      ],
      shift_cycles: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      hospital_sectors: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      staff_roles: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      staff_contracts: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      timeoff_requests: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      shift_rules: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      shifts: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      shift_types: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.id != ''",
      ],
      staff_profiles: [
        "@request.auth.id != ''",
        "@request.auth.id != ''",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
        "@request.auth.role = 'Admin'",
      ],
    }

    Object.keys(previous).forEach((name) => {
      const collection = app.findCollectionByNameOrId(name)
      const rules = previous[name]
      collection.listRule = rules[0]
      collection.viewRule = rules[1]
      collection.createRule = rules[2]
      collection.updateRule = rules[3]
      collection.deleteRule = rules[4]
      app.save(collection)
    })
  },
)
