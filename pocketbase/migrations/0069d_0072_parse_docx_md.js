/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      // Create a temporary file and use $documents.toMarkdown
      const tempFile = $filesystem.fileFromBytes(res.raw, 'template.docx')
      const { markdown, truncated } = $documents.toMarkdown({ file: tempFile })

      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)
      record.set('action', 'INSPECT_DOCX_MD')
      record.set('details', JSON.stringify({ markdown, truncated }))
      app.save(record)
    } catch (err) {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const record = new Record(auditCol)
      record.set('action', 'INSPECT_DOCX_MD_ERR')
      record.set('details', String(err) + ' : ' + (err.stack || ''))
      app.save(record)
    }
  },
  (app) => {},
)
