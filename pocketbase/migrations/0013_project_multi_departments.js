/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const projCol = app.findCollectionByNameOrId('projects')
    if (!projCol.fields.getByName('associated_departments')) {
      projCol.fields.add(
        new RelationField({
          name: 'associated_departments',
          collectionId: app.findCollectionByNameOrId('departments').id,
          maxSelect: 999,
        }),
      )
    }
    app.save(projCol)
  },
  (app) => {
    const projCol = app.findCollectionByNameOrId('projects')
    projCol.fields.removeByName('associated_departments')
    app.save(projCol)
  },
)
