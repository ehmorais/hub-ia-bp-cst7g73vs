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

      // res.raw is a Go []byte or Goja string/array
      // Let's get bytes cleanly:
      const raw = res.raw
      const getByte = (idx) => {
        const v = raw[idx]
        return typeof v === 'number' ? v : typeof v === 'string' ? v.charCodeAt(0) & 0xff : 0
      }

      let foundFiles = []
      // Find PK\x01\x02
      for (let i = 0; i < raw.length - 46; i++) {
        if (
          getByte(i) === 0x50 &&
          getByte(i + 1) === 0x4b &&
          getByte(i + 2) === 0x01 &&
          getByte(i + 3) === 0x02
        ) {
          let fnLen = getByte(i + 28) | (getByte(i + 29) << 8)
          let compMethod = getByte(i + 10) | (getByte(i + 11) << 8)
          let compSize =
            (getByte(i + 20) |
              (getByte(i + 21) << 8) |
              (getByte(i + 22) << 16) |
              (getByte(i + 23) << 24)) >>>
            0
          let uncompSize =
            (getByte(i + 24) |
              (getByte(i + 25) << 8) |
              (getByte(i + 26) << 16) |
              (getByte(i + 27) << 24)) >>>
            0
          let localHeaderOffset =
            (getByte(i + 42) |
              (getByte(i + 43) << 8) |
              (getByte(i + 44) << 16) |
              (getByte(i + 45) << 24)) >>>
            0

          let fn = ''
          for (let j = 0; j < fnLen; j++) {
            fn += String.fromCharCode(getByte(i + 46 + j))
          }
          foundFiles.push({ name: fn, compMethod, compSize, uncompSize, localHeaderOffset })
        }
      }

      record.set('action', 'INSPECT_DOCX_LIST')
      record.set(
        'details',
        JSON.stringify({
          fileCount: foundFiles.length,
          files: foundFiles,
        }),
      )
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_LIST_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
