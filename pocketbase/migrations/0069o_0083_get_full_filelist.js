/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_logs')

    try {
      const res = $http.send({
        url: 'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/f5690371-290d-40ce-9bbe-0308a241c06b/template-pdf-71be3.docx',
        method: 'GET',
      })

      const str = res.raw
      let cdPos = 0
      let files = []
      while ((cdPos = str.indexOf('PK\x01\x02', cdPos)) !== -1) {
        let fnLen = str.charCodeAt(cdPos + 28) | (str.charCodeAt(cdPos + 29) << 8)
        let fn = str.substr(cdPos + 46, fnLen)
        files.push(fn)
        cdPos += 46 + fnLen
      }

      const rec = new Record(auditCol)
      rec.set('action', 'DOCX_INSPECT_CD')
      rec.set('details', JSON.stringify({ files }))
      app.save(rec)
    } catch (err) {
      const rec = new Record(auditCol)
      rec.set('action', 'DOCX_INSPECT_CD_ERR')
      rec.set('details', String(err))
      app.save(rec)
    }
  },
  (app) => {},
)
