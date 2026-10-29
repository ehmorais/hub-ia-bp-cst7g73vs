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

      // Check raw data
      const raw = res.raw // byte array
      const len = raw ? raw.length : 0
      let hex = ''
      for (let i = 0; i < Math.min(len, 64); i++) {
        let h = (raw[i] & 0xff).toString(16)
        if (h.length === 1) h = '0' + h
        hex += h + ' '
      }

      record.set('action', 'INSPECT_DOCX_RAW')
      record.set(
        'details',
        JSON.stringify({
          len: len,
          hexHeader: hex,
          bodyPreview: typeof res.body === 'string' ? res.body.slice(0, 100) : 'not string',
        }),
      )
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_RAW_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
