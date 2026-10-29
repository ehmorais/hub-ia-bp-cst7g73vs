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

      // res.raw is string or byte array.
      // In Go PocketBase $http.send, res.raw can be converted or accessed.
      // Let's inspect res.raw type and constructor
      const type = typeof res.raw
      const isArr = Array.isArray(res.raw)

      // What if we send res.raw in base64?
      // Does $security have a base64 encode or can we chunk it?
      // Let's check $security methods!
      const secKeys = Object.keys($security)

      record.set('action', 'INSPECT_DOCX_SEC')
      record.set('details', JSON.stringify({ type, isArr, secKeys }))
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_SEC_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
