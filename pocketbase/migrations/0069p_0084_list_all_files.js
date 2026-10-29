/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      // Pure JS inflate implementation!
      // Since docx uses standard Deflate (compression method 8), we can implement or use a minimal puff/inflate in JS.
      // Or even simpler: can we search for plaintext strings or XML tokens in raw compressed data?
      // In deflate, literals and huffman codes can be decoded.
      // Let's implement a minimal inflate algorithm in JS!

      // Minimal Deflate Decompressor:
      function Inflator(bytes) {
        this.bytes = bytes
        this.bytePos = 0
        this.bitBuf = 0
        this.bitCnt = 0
      }
      Inflator.prototype.getBits = function (n) {
        while (this.bitCnt < n) {
          if (this.bytePos >= this.bytes.length) return -1
          this.bitBuf |= (this.bytes[this.bytePos++] & 0xff) << this.bitCnt
          this.bitCnt += 8
        }
        var mask = (1 << n) - 1
        var val = this.bitBuf & mask
        this.bitBuf >>= n
        this.bitCnt -= n
        return val
      }
      // ...
      // Let's see if we can decode word/document.xml, header1.xml, header2.xml, footer1.xml, footer2.xml, word/media/
      // Let's first inspect ALL file names and check if any word/media/ exists:
      const str = res.raw
      let cdPos = 0
      let files = []
      let mediaFiles = []
      while ((cdPos = str.indexOf('PK\x01\x02', cdPos)) !== -1) {
        let fnLen = str.charCodeAt(cdPos + 28) | (str.charCodeAt(cdPos + 29) << 8)
        let fn = str.substr(cdPos + 46, fnLen)
        let compMethod = str.charCodeAt(cdPos + 10) | (str.charCodeAt(cdPos + 11) << 8)
        let compSize =
          (str.charCodeAt(cdPos + 20) |
            (str.charCodeAt(cdPos + 21) << 8) |
            (str.charCodeAt(cdPos + 22) << 16) |
            (str.charCodeAt(cdPos + 23) << 24)) >>>
          0
        let uncompSize =
          (str.charCodeAt(cdPos + 24) |
            (str.charCodeAt(cdPos + 25) << 8) |
            (str.charCodeAt(cdPos + 26) << 16) |
            (str.charCodeAt(cdPos + 27) << 24)) >>>
          0
        let localOffset =
          (str.charCodeAt(cdPos + 42) |
            (str.charCodeAt(cdPos + 43) << 8) |
            (str.charCodeAt(cdPos + 44) << 16) |
            (str.charCodeAt(cdPos + 45) << 24)) >>>
          0

        files.push({ name: fn, compMethod, compSize, uncompSize, localOffset })
        if (
          fn.indexOf('media') !== -1 ||
          fn.indexOf('.png') !== -1 ||
          fn.indexOf('.jpg') !== -1 ||
          fn.indexOf('.jpeg') !== -1
        ) {
          mediaFiles.push(fn)
        }
        cdPos += 46 + fnLen
      }

      const rec = new Record(auditCol)
      rec.set('action', 'DOCX_DETAILS_ALL')
      rec.set(
        'details',
        JSON.stringify({
          files: files.map((f) => f.name + ' (' + f.uncompSize + 'b)'),
          mediaFiles: mediaFiles,
        }),
      )
      app.save(rec)
    } catch (err) {
      const rec = new Record(auditCol)
      rec.set('action', 'DOCX_DETAILS_ERR')
      rec.set('details', String(err))
      app.save(rec)
    }
  },
  (app) => {},
)
