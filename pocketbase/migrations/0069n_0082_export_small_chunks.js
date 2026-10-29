/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      // In Go PocketBase, chars in res.raw might be unicode runes if decoded as UTF-8 string or raw bytes
      // Let's check max charCode in res.raw:
      const str = res.raw
      let maxChar = 0
      let over255 = 0
      for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i)
        if (code > maxChar) maxChar = code
        if (code > 255) over255++
      }

      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      let b64 = ''
      let i = 0
      while (i < str.length) {
        let b0 = str.charCodeAt(i++) & 0xff
        let b1 = i < str.length ? str.charCodeAt(i++) & 0xff : NaN
        let b2 = i < str.length ? str.charCodeAt(i++) & 0xff : NaN

        let n = (b0 << 16) | (isNaN(b1) ? 0 : b1 << 8) | (isNaN(b2) ? 0 : b2)
        b64 += chars.charAt((n >> 18) & 63)
        b64 += chars.charAt((n >> 12) & 63)
        b64 += isNaN(b1) ? '=' : chars.charAt((n >> 6) & 63)
        b64 += isNaN(b2) ? '=' : chars.charAt(n & 63)
      }

      // Save base64 in 3000-char chunks
      const chunkSize = 3000
      const totalChunks = Math.ceil(b64.length / chunkSize)
      for (let c = 0; c < totalChunks; c++) {
        const rec = new Record(auditCol)
        rec.set('action', 'DOCXB64_' + String(c).padStart(2, '0'))
        rec.set(
          'details',
          JSON.stringify({
            c: c,
            tot: totalChunks,
            len: str.length,
            maxChar: maxChar,
            over255: over255,
            d: b64.substr(c * chunkSize, chunkSize),
          }),
        )
        app.save(rec)
      }
    } catch (err) {
      const rec = new Record(auditCol)
      rec.set('action', 'DOCXB64_ERR')
      rec.set('details', String(err))
      app.save(rec)
    }
  },
  (app) => {},
)
