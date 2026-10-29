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

      // Check available globals:
      const available = []
      if (typeof $os !== 'undefined') available.push('$os')
      if (typeof $documents !== 'undefined') available.push('$documents')
      if (typeof $filesystem !== 'undefined') available.push('$filesystem')
      if (typeof $files !== 'undefined') available.push('$files')

      let docKeys = []
      if (typeof $documents !== 'undefined') {
        docKeys = Object.keys($documents)
      }

      record.set('action', 'INSPECT_DOCX_GLOBALS')
      record.set(
        'details',
        JSON.stringify({ available, docKeys, resLen: res.raw ? res.raw.length : 0 }),
      )
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_GLOBALS_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
