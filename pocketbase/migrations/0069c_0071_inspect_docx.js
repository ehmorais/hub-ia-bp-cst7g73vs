/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      // Store result in an audit log or temp table so we can read it via db_query!
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)

      let info = {
        status: res.statusCode,
        headers: res.headers,
        bodyType: typeof res.body,
      }

      // Try reading docx with $documents.toMarkdown if possible
      // res.raw / res.body
      record.set('action', 'INSPECT_DOCX_RESULT')
      record.set('details', JSON.stringify(info))
      app.save(record)
    } catch (err) {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)
      record.set('action', 'INSPECT_DOCX_ERROR')
      record.set('details', String(err) + ' - ' + (err.stack || ''))
      app.save(record)
    }
  },
  (app) => {},
)
