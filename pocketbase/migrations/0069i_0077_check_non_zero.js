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

      const raw = res.raw
      let nonZeroCount = 0
      let firstNonZeroIndex = -1
      let firstNonZeroByte = null
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] !== 0) {
          nonZeroCount++
          if (firstNonZeroIndex === -1) {
            firstNonZeroIndex = i
            firstNonZeroByte = raw[i]
          }
        }
      }

      record.set('action', 'INSPECT_DOCX_NONZERO')
      record.set(
        'details',
        JSON.stringify({
          len: raw.length,
          nonZeroCount: nonZeroCount,
          firstNonZeroIndex: firstNonZeroIndex,
          firstNonZeroByte: firstNonZeroByte,
        }),
      )
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_NONZERO_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
