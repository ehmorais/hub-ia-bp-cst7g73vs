/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      $ai.agents.delete(app, 'escala-expert')
    } catch (e) {
      // Ignore if not found
    }

    const collectionsToRemove = ['off_day_requests', 'shifts', 'hospital_staff']
    for (const name of collectionsToRemove) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (e) {
        // Ignore if not found
      }
    }
  },
  (app) => {
    // Revert not possible without re-creating all schemas.
  },
)
