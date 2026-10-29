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

      // res.raw elements in Goja might be characters or byte objects
      const raw = res.raw
      let sample = []
      for (let i = 0; i < Math.min(raw.length, 30); i++) {
        sample.push(typeof raw[i] === 'string' ? raw[i].charCodeAt(0) : raw[i])
      }

      let charSample = ''
      for (let i = 0; i < Math.min(raw.length, 30); i++) {
        charSample += typeof raw[i] === 'string' ? raw[i] : String.fromCharCode(raw[i])
      }

      // Check ZIP Central Directory at the end of the file!
      // A zip file has End of Central Directory record starting with signature 0x06054b50 ("PK\x05\x06")
      // Let's find entries in Central Directory!
      let foundFiles = []
      let str = ''
      for (let i = 0; i < raw.length; i++) {
        str += typeof raw[i] === 'string' ? raw[i] : String.fromCharCode(raw[i])
      }

      // Search for "PK\x01\x02" which is central directory file header!
      let cdPos = 0
      while ((cdPos = str.indexOf('PK\x01\x02', cdPos)) !== -1) {
        // Filename length is at offset 28 (2 bytes little endian)
        let fnLen = str.charCodeAt(cdPos + 28) | (str.charCodeAt(cdPos + 29) << 8)
        let fn = str.substr(cdPos + 46, fnLen)
        let compSize =
          str.charCodeAt(cdPos + 20) |
          (str.charCodeAt(cdPos + 21) << 8) |
          (str.charCodeAt(cdPos + 22) << 16) |
          (str.charCodeAt(cdPos + 23) << 24)
        let uncompSize =
          str.charCodeAt(cdPos + 24) |
          (str.charCodeAt(cdPos + 25) << 8) |
          (str.charCodeAt(cdPos + 26) << 16) |
          (str.charCodeAt(cdPos + 27) << 24)
        let compMethod = str.charCodeAt(cdPos + 10) | (str.charCodeAt(cdPos + 11) << 8)
        foundFiles.push({ name: fn, compMethod, compSize, uncompSize })
        cdPos += 46 + fnLen
      }

      record.set('action', 'INSPECT_DOCX_FILES')
      record.set(
        'details',
        JSON.stringify({
          sampleCodes: sample,
          charSample: charSample,
          fileCount: foundFiles.length,
          files: foundFiles,
        }),
      )
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_FILES_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
