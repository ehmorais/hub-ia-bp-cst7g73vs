/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      // In Go PocketBase, if res.raw is a string, chars are UTF-8 or Latin1.
      // Let's convert to base64 in chunks:
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const str = res.raw
      let b64 = ''
      let i = 0
      while (i < str.length) {
        let b0 = str.charCodeAt(i++)
        let b1 = i < str.length ? str.charCodeAt(i++) : NaN
        let b2 = i < str.length ? str.charCodeAt(i++) : NaN

        let n = (b0 << 16) | (isNaN(b1) ? 0 : b1 << 8) | (isNaN(b2) ? 0 : b2)
        b64 += chars.charAt((n >> 18) & 63)
        b64 += chars.charAt((n >> 12) & 63)
        b64 += isNaN(b1) ? '=' : chars.charAt((n >> 6) & 63)
        b64 += isNaN(b2) ? '=' : chars.charAt(n & 63)
      }

      // Save base64 in 10KB chunks across audit_log records
      const chunkSize = 10000
      const totalChunks = Math.ceil(b64.length / chunkSize)
      for (let c = 0; c < totalChunks; c++) {
        const rec = new Record(auditCol)
        rec.set('action', 'DOCX_CHUNK_' + c)
        rec.set(
          'details',
          JSON.stringify({
            chunkIndex: c,
            totalChunks: totalChunks,
            totalLen: b64.length,
            data: b64.substr(c * chunkSize, chunkSize),
          }),
        )
        app.save(rec)
      }
    } catch (err) {
      const rec = new Record(auditCol)
      rec.set('action', 'DOCX_CHUNK_ERR')
      rec.set('details', String(err))
      app.save(rec)
    }
  },
  (app) => {},
)
