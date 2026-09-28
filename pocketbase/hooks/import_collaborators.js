routerAdd(
  'POST',
  '/backend/v1/escala/import',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem importar colaboradores.')
    }

    const body = e.requestInfo().body || {}
    if (!body.sheets || !Array.isArray(body.sheets)) {
      return e.badRequestError('Nenhuma planilha enviada')
    }

    const summary = {
      sheets: [],
      rolesCreated: 0,
      profilesCreated: 0,
      profilesUpdated: 0,
      profilesSkipped: 0,
      sectorAssignments: 0,
      sectorCleared: 0,
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

    var skipNames = [
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

    function normalizeRoleName(funcName) {
      var u = funcName
        .toUpperCase()
        .replace(/[^A-ZÀ-Ü]/g, '')
        .trim()

      if (u === 'ENF' || u === 'ENFERMEIRO') return 'Enfermeiro'
      if (u === 'TE' || u === 'TÉCNICODEENFERMAGEM' || u === 'TECNICODEENFERMAGEM') {
        return 'Técnico de Enfermagem'
      }
      if (u === 'AE' || u === 'AUXILIARDEENFERMAGEM') return 'Auxiliar de Enfermagem'
      if (u === 'GERENF' || u === 'GERENTEDEENFERMAGEM') return 'Gerente de Enfermagem'
      if (u === 'SUPENF' || u === 'SUPERVISORDEENFERMAGEM') return 'Supervisor de Enfermagem'

      return funcName.trim()
    }

    function getRank(funcName) {
      var u = funcName.toUpperCase().trim()
      if (u === 'GERENTE DE ENFERMAGEM') return 5
      if (u === 'SUPERVISOR DE ENFERMAGEM') return 4
      if (u === 'ENFERMEIRO') return 3
      if (u === 'TÉCNICO DE ENFERMAGEM') return 2
      if (u === 'AUXILIAR DE ENFERMAGEM') return 1
      return 0
    }

    function requiresSupervision(funcName) {
      var u = funcName.toUpperCase().trim()
      return u === 'TÉCNICO DE ENFERMAGEM' || u === 'AUXILIAR DE ENFERMAGEM'
    }

    function shouldSkip(name) {
      var u = name.toUpperCase().trim()
      return skipNames.some(function (s) {
        return u.indexOf(s) >= 0
      })
    }

    function normalizeSectorText(value) {
      return String(value || '')
        .toUpperCase()
        .replace(/[ÁÀÂÃÄ]/g, 'A')
        .replace(/[ÉÈÊË]/g, 'E')
        .replace(/[ÍÌÎÏ]/g, 'I')
        .replace(/[ÓÒÔÕÖ]/g, 'O')
        .replace(/[ÚÙÛÜ]/g, 'U')
        .replace(/Ç/g, 'C')
        .replace(/[º°]/g, ' ')
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
    }

    function findSectorIdByName(sectorName) {
      var wanted = normalizeSectorText(sectorName)
      for (var i = 0; i < sectors.length; i++) {
        if (normalizeSectorText(sectors[i].getString('name')) === wanted) return sectors[i].id
      }
      return ''
    }

    function detectSection(sheetName, row) {
      var rawText = ''
      for (var i = 0; i < row.length; i++) {
        if (row[i] !== null && row[i] !== undefined && String(row[i]).trim()) {
          rawText += ' ' + String(row[i])
        }
      }
      var text = normalizeSectorText(rawText)
      var normalizedSheet = normalizeSectorText(sheetName)

      if (text.indexOf('GERENCIA') >= 0 || text.indexOf('SUPERVISAO') >= 0) {
        return { action: 'clear', label: 'GERÊNCIA / SUPERVISÃO' }
      }
      if (text.indexOf('PRONTO SOCORRO ADULTO') >= 0) {
        return {
          action: 'set',
          label: 'PRONTO SOCORRO ADULTO (RIO / RESPIRATÓRIO)',
          sectorName: 'PS ADULTO',
          note: 'A escala agrupa Rio e Respiratório; foi usada a categoria principal PS ADULTO.',
        }
      }
      if (text.indexOf('PRONTO SOCORRO INFANTIL') >= 0) {
        return { action: 'set', label: 'PRONTO SOCORRO INFANTIL', sectorName: 'PSI' }
      }
      if (text.indexOf('2 ANDAR') >= 0) {
        return { action: 'set', label: '2º ANDAR', sectorName: '2º ANDAR' }
      }
      if (text.indexOf('3 ANDAR') >= 0) {
        return { action: 'set', label: '3º ANDAR', sectorName: '3º ANDAR' }
      }
      if (text.indexOf('4 ANDAR') >= 0) {
        return { action: 'set', label: '4º ANDAR', sectorName: '4º ANDAR' }
      }
      if (text.indexOf('5 ANDAR') >= 0) {
        return { action: 'set', label: '5º ANDAR', sectorName: '5º ANDAR' }
      }
      if (text.indexOf('UTI PEDIATRICA') >= 0 || text.indexOf('UTI PEDIATRICO') >= 0) {
        return { action: 'set', label: 'UTI PEDIÁTRICA', sectorName: 'UTI - INFANTIL' }
      }
      if (text.indexOf('BERCARIO') >= 0) {
        return { action: 'set', label: 'BERÇÁRIO', sectorName: 'UTI PED / BERÇARIO' }
      }
      if (text.indexOf('AMBULATORIO RIO') >= 0) {
        return {
          action: 'set',
          label: 'AMBULATÓRIO RIO / ENDOSCOPIA',
          sectorName: 'AMBULATÓRIO RIO JANEIRO - ENDOSCOPIA',
        }
      }
      if (text.indexOf('PRE FATURAMENTO') >= 0) {
        return { action: 'set', label: 'PRÉ-FATURAMENTO', sectorName: 'PRÉ-FATURAMENTO' }
      }
      if (
        normalizedSheet.indexOf('IMAGENS') >= 0 &&
        (text.indexOf('ENFERMEIROS') >= 0 || text.indexOf('SETOR IMAGEM') >= 0)
      ) {
        return { action: 'set', label: 'SETOR DE IMAGENS', sectorName: 'SETOR DE IMAGENS' }
      }
      return null
    }

    for (var si = 0; si < body.sheets.length; si++) {
      var sheet = body.sheets[si]
      var sheetName = sheet.name || ''
      var rows = sheet.rows || []
      var sheetInfo = {
        name: sheetName,
        rowsProcessed: 0,
        sectorMatched: null,
        sectorAssignedRows: 0,
        sectorClearedRows: 0,
        unmappedSections: [],
        ambiguousSections: [],
      }
      var headerIdx = -1,
        nameCol = -1,
        corenCol = -1,
        funcCol = -1
      for (var i = 0; i < Math.min(rows.length, 10); i++) {
        var row = rows[i]
        if (!row) continue
        for (var j = 0; j < row.length; j++) {
          var val = String(row[j] || '')
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

      var currentSectorAction = 'keep'
      var currentSectorId = ''

      for (var i = headerIdx + 1; i < rows.length; i++) {
        var row = rows[i]
        if (!row) continue

        var detectedSection = detectSection(sheetName, row)
        if (detectedSection) {
          currentSectorAction = detectedSection.action
          currentSectorId = ''

          if (
            detectedSection.note &&
            sheetInfo.ambiguousSections.indexOf(detectedSection.note) === -1
          ) {
            sheetInfo.ambiguousSections.push(detectedSection.note)
          }
          if (
            detectedSection.unmapped &&
            sheetInfo.unmappedSections.indexOf(detectedSection.label) === -1
          ) {
            sheetInfo.unmappedSections.push(detectedSection.label)
          }

          if (detectedSection.action === 'set') {
            currentSectorId = findSectorIdByName(detectedSection.sectorName)
            if (currentSectorId) {
              sheetInfo.sectorMatched = detectedSection.sectorName
            } else {
              currentSectorAction = 'keep'
              sheetInfo.unmappedSections.push(
                detectedSection.label +
                  ' (setor ' +
                  detectedSection.sectorName +
                  ' não encontrado)',
              )
            }
          }
        }

        var name = String(row[nameCol] || '').trim()
        if (!name || shouldSkip(name)) continue

        var rawCoren = String(row[corenCol] || '').trim()
        var coren = rawCoren === 'cursando' || rawCoren === '' ? '' : rawCoren
        var funcName = normalizeRoleName(String(row[funcCol] || '').trim())
        if (!funcName) continue

        var funcKey = funcName.toUpperCase().trim()
        if (!roleMap[funcKey]) {
          try {
            var roleCol = $app.findCollectionByNameOrId('staff_roles')
            var role = new Record(roleCol)
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

        var roleId = roleMap[funcKey] || ''
        var rowSectorAction = currentSectorAction
        var rowSectorId = currentSectorId
        if (rowSectorAction === 'set') {
          summary.sectorAssignments++
          sheetInfo.sectorAssignedRows++
        } else if (rowSectorAction === 'clear') {
          summary.sectorCleared++
          sheetInfo.sectorClearedRows++
        }

        if (coren) {
          if (profileMap[coren]) {
            try {
              var profile = $app.findRecordById('staff_profiles', profileMap[coren])
              var changed = false
              if (profile.getString('name') !== name) {
                profile.set('name', name)
                changed = true
              }
              if (roleId && profile.getString('staff_role') !== roleId) {
                profile.set('staff_role', roleId)
                changed = true
              }
              var desiredSectorId = rowSectorAction === 'set' ? rowSectorId : ''
              if (
                (rowSectorAction === 'set' || rowSectorAction === 'clear') &&
                profile.getString('default_sector') !== desiredSectorId
              ) {
                profile.set('default_sector', desiredSectorId)
                changed = true
              }
              if (profile.get('active') === false) {
                profile.set('active', true)
                changed = true
              }
              if (changed) {
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
              var pCol = $app.findCollectionByNameOrId('staff_profiles')
              var profile = new Record(pCol)
              profile.set('name', name)
              profile.set('professional_id', coren)
              if (roleId) profile.set('staff_role', roleId)
              if (rowSectorAction === 'set' && rowSectorId)
                profile.set('default_sector', rowSectorId)
              profile.set('active', true)
              $app.save(profile)
              profileMap[coren] = profile.id
              summary.profilesCreated++
            } catch (err) {
              summary.errors.push("Erro ao criar '" + name + "': " + err.message)
            }
          }
        } else {
          var existingProfile = null
          try {
            existingProfile = $app.findFirstRecordByData('staff_profiles', 'name', name)
          } catch (_) {}
          if (!existingProfile) {
            try {
              var pCol = $app.findCollectionByNameOrId('staff_profiles')
              var profile = new Record(pCol)
              profile.set('name', name)
              if (roleId) profile.set('staff_role', roleId)
              if (rowSectorAction === 'set' && rowSectorId)
                profile.set('default_sector', rowSectorId)
              else if (rowSectorAction === 'clear') profile.set('default_sector', '')
              profile.set('active', true)
              $app.save(profile)
              summary.profilesCreated++
            } catch (err) {
              summary.errors.push("Erro ao criar '" + name + "': " + err.message)
            }
          } else if (
            (roleId && existingProfile.getString('staff_role') !== roleId) ||
            ((rowSectorAction === 'set' || rowSectorAction === 'clear') &&
              existingProfile.getString('default_sector') !==
                (rowSectorAction === 'set' ? rowSectorId : '')) ||
            existingProfile.get('active') === false
          ) {
            try {
              if (roleId) existingProfile.set('staff_role', roleId)
              if (rowSectorAction === 'set' && rowSectorId) {
                existingProfile.set('default_sector', rowSectorId)
              } else if (rowSectorAction === 'clear') {
                existingProfile.set('default_sector', '')
              }
              existingProfile.set('active', true)
              $app.save(existingProfile)
              summary.profilesUpdated++
            } catch (err) {
              summary.errors.push("Erro ao atualizar '" + name + "': " + err.message)
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
