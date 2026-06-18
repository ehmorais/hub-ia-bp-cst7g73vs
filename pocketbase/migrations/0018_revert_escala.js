migrate(
  (app) => {
    try {
      $ai.agents.delete(app, 'escala-expert')
    } catch (_) {}

    try {
      const tool = app.findFirstRecordByData('ia_tools', 'name', 'Escala Expert HBPSCS')
      app.delete(tool)
    } catch (_) {}

    try {
      app.delete(app.findCollectionByNameOrId('staff_absences'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('hospital_scales'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('hospital_staff'))
    } catch (_) {}
  },
  (app) => {},
)
