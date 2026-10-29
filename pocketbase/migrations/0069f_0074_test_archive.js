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

      // Check $archive or zip methods, or $security
      const available = []
      if (typeof $archive !== 'undefined') available.push('$archive')
      if (typeof $zip !== 'undefined') available.push('$zip')

      // Or we can write a tiny zip parser in JS!
      // A docx is a standard ZIP file. Let's see if we can unpack it in pure JS with inflate!
      // Does PocketBase JSVM have any decompression or inflate?
      // Let's check what globals exist on this JSVM:
      const g = Object.getOwnPropertyNames(this || globalThis || {})

      record.set('action', 'INSPECT_DOCX_ENV')
      record.set(
        'details',
        JSON.stringify({ available, globals: g.filter((k) => k.startsWith('$')) }),
      )
      app.save(record)
    } catch (err) {
      record.set('action', 'INSPECT_DOCX_ENV_ERR')
      record.set('details', String(err))
      app.save(record)
    }
  },
  (app) => {},
)
