/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const toolsCol = app.findCollectionByNameOrId('ia_tools')

    if (!toolsCol.fields.getByName('associated_departments')) {
      toolsCol.fields.add(
        new RelationField({
          name: 'associated_departments',
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 999,
        }),
      )
    }

    toolsCol.createRule = "@request.auth.role = 'Admin'"
    toolsCol.updateRule = "@request.auth.role = 'Admin'"
    toolsCol.deleteRule = "@request.auth.role = 'Admin'"

    app.save(toolsCol)
  },
  (app) => {
    const toolsCol = app.findCollectionByNameOrId('ia_tools')

    toolsCol.fields.removeByName('associated_departments')

    toolsCol.createRule = "@request.auth.id != ''"
    toolsCol.updateRule = "@request.auth.id != ''"
    toolsCol.deleteRule = "@request.auth.id != ''"

    app.save(toolsCol)
  },
)
