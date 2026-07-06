// @deps xlsx@0.18.5
routerAdd(
  'POST',
  '/backend/v1/escala/import',
  (e) => {
    const XLSX = require('xlsx')

    const body = e.requestInfo().body || {}
    if (!body.file) return e.badRequestError('Nenhum arquivo enviado')

    let workbook
    try {
      workbook = XLSX.read(body.file, { type: 'base64' })
    } catch (err) {
      return e.badRequestError('Falha ao ler arquivo Excel: ' + err.message)
    }

    const summary = {
      sheets: [],
      rolesCreated: 0,
      profilesCreated: 0,
      profilesUpdated: 0,
      profilesSkipped: 0,
      errors: [],
    }

    let existingRoles = []
    try {
      existingRoles = $app.findRecordsByFilter('staff_roles', "id != ''", '-hierarchy_rank', 0, 0)
    } catch (_) {}
    const roleMap = {}
    for (const r of existingRoles) {
      roleMap[r.getString('name').toUpperCase().trim()] = r.id
    }

    const profileMap = {}
    try {
      const existingProfiles = $app.findRecordsByFilter('staff_profiles', "id != ''", 'name', 0, 0)
      for (const p of existingProfiles) {
        const pid = p.getString('professional_id')
        if (pid) profileMap[pid] = p.id
      }
    } catch (_) {}

    let sectors = []
    try {
      sectors = $app.findRecordsByFilter('hospital_sectors', "id != ''", 'name', 0, 0)
    } catch (_) {}

    const skipNames = [
      'NOME',
      'LEGENDA',
      'SUPERVISÃO',
      'GERÊNCIA',
      'ENFERMEIROS',
      'TEC/AUX',
      'AG REPOSIÇÃO',
      'JULHO',
      'AGOSTO',
    ]

    function getRank(funcName) {
      const u = funcName.toUpperCase().trim()
      if (u.indexOf('GER') >= 0) return 5
      if (u.indexOf('SUP') >= 0) return 4
      if (u === 'ENF') return 3
      if (u === 'TE') return 2
      if (u === 'AE') return 1
      return 0
    }

    function requiresSupervision(funcName) {
      const u = funcName.toUpperCase().trim()
      return u === 'TE' || u === 'AE' || u === 'MAQ'
    }

    function shouldSkip(name) {
      const u = name.toUpperCase().trim()
      return skipNames.some(function (s) {
        return u.indexOf(s) >= 0
      })
    }

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })

      const sheetInfo = { name: sheetName, rowsProcessed: 0, sectorMatched: null }
      const normName = sheetName
        .replace(/^ESC\.?\s*/i, '')
        .replace(/^ESC\s*/i, '')
        .trim()
      for (const s of sectors) {
        const sn = s.getString('name').toUpperCase()
        if (sn.indexOf(normName.toUpperCase()) >= 0 || normName.toUpperCase().indexOf(sn) >= 0) {
          sheetInfo.sectorMatched = s.getString('name')
          break
        }
      }

      let headerIdx = -1,
        nameCol = -1,
        corenCol = -1,
        funcCol = -1
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i]
        if (!row) continue
        for (let j = 0; j < row.length; j++) {
          const val = String(row[j] || '')
            .toUpperCase()
            .trim()
          if (val === 'NOME' && nameCol === -1) {
            headerIdx = i
            nameCol = j
          }
          if (val === 'COREN') corenCol = j
          if (val === 'FUNÇÃO' || val === 'FUNCAO') funcCol = j
        }
      }

      if (headerIdx === -1 || nameCol === -1) {
        summary.errors.push("Planilha '" + sheetName + "': coluna NOME não encontrada")
        summary.sheets.push(sheetInfo)
        continue
      }
      if (corenCol === -1) corenCol = nameCol + 1
      if (funcCol === -1) funcCol = nameCol + 2

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        const name = String(row[nameCol] || '').trim()
        if (!name || shouldSkip(name)) continue

        const rawCoren = String(row[corenCol] || '').trim()
        const coren = rawCoren === 'cursando' || rawCoren === '' ? '' : rawCoren
        const funcName = String(row[funcCol] || '').trim()
        if (!funcName) continue

        const funcKey = funcName.toUpperCase().trim()
        if (!roleMap[funcKey]) {
          try {
            const roleCol = $app.findCollectionByNameOrId('staff_roles')
            const role = new Record(roleCol)
            role.set('name', funcName)
            role.set('hierarchy_rank', getRank(funcName))
            role.set('requires_supervision', requiresSupervision(funcName))
            $app.save(role)
            roleMap[funcKey] = role.id
            summary.rolesCreated++
          } catch (err) {
            summary.errors.push("Erro ao criar função '" + funcName + "': " + err.message)
          }
        }

        if (coren) {
          if (profileMap[coren]) {
            try {
              const profile = $app.findRecordById('staff_profiles', profileMap[coren])
              if (profile.getString('name') !== name) {
                profile.set('name', name)
                $app.save(profile)
                summary.profilesUpdated++
              } else {
                summary.profilesSkipped++
              }
            } catch (err) {
              summary.errors.push("Erro ao atualizar '" + name + "': " + err.message)
            }
          } else {
            try {
              const pCol = $app.findCollectionByNameOrId('staff_profiles')
              const profile = new Record(pCol)
              profile.set('name', name)
              profile.set('professional_id', coren)
              $app.save(profile)
              profileMap[coren] = profile.id
              summary.profilesCreated++
            } catch (err) {
              summary.errors.push("Erro ao criar '" + name + "': " + err.message)
            }
          }
        } else {
          let exists = false
          try {
            $app.findFirstRecordByData('staff_profiles', 'name', name)
            exists = true
          } catch (_) {}
          if (!exists) {
            try {
              const pCol = $app.findCollectionByNameOrId('staff_profiles')
              const profile = new Record(pCol)
              profile.set('name', name)
              $app.save(profile)
              summary.profilesCreated++
            } catch (err) {
              summary.errors.push("Erro ao criar '" + name + "': " + err.message)
            }
          } else {
            summary.profilesSkipped++
          }
        }
        sheetInfo.rowsProcessed++
      }
      summary.sheets.push(sheetInfo)
    }

    return e.json(200, summary)
  },
  $apis.requireAuth(),
  $apis.bodyLimit(32 * 1024 * 1024),
)
