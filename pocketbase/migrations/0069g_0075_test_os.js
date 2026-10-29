/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_logs')
    const record = new Record(auditCol)

    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      // Save file to pb_data or tmp
      // In Go PocketBase, $os or ioutil or os
      // Let's see what methods $os has:
      const osKeys = Object.keys($os)
      record.set('action', 'INSPECT_DOCX_OS')
      record.set('details', JSON.stringify({ osKeys }))
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_OS_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
