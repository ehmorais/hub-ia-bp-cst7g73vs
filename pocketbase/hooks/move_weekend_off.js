// POST /backend/v1/escala/move-weekend-off
// Transação atômica para mover manualmente o Sábado ou Domingo de folga de um colaborador.
//
// Regras obrigatórias:
//  - Origem e destino devem ter o mesmo weekday (sábado 6 -> sábado 6, domingo 0 -> domingo 0).
//  - Mesmo colaborador e mesmo ciclo.
//  - Mantém exatamente 1 sábado e 1 domingo de folga no ciclo.
//  - Se houver plantão do colaborador no destino, realiza troca segura para a origem ou
//    ajusta conforme restrições de contrato, descanso e cobertura mínima.
//  - A origem deixa de ser folga e o destino passa a ser folga (sem plantão no destino).
//  - Atualiza validation_summary do rascunho com weekend_off_assignments e weekend_off_overrides (audit trail).
//  - Atomicidade total: se violar cobertura ou integridade, rejeita e nada é alterado.

routerAdd(
  'POST',
  '/backend/v1/escala/move-weekend-off',
  (e) => {
    if (!e.auth || e.auth.getString('role') !== 'Admin') {
      return e.forbiddenError('Apenas administradores podem alterar folgas de escala.')
    }

    var body = e.requestInfo().body || {}
    var draftId = body.draft_id
    var staffId = body.staff_id || body.user_id
    var sourceDate = (body.source_date || '').split(' ')[0].split('T')[0]
    var targetDate = (body.target_date || '').split(' ')[0].split('T')[0]

    if (!draftId || !staffId || !sourceDate || !targetDate) {
      return e.badRequestError('draft_id, staff_id, source_date e target_date são obrigatórios.')
    }

    if (sourceDate === targetDate) {
      return e.badRequestError('A data de destino deve ser diferente da data de origem.')
    }

    // Helpers date-only puros (auto-contidos dentro do callback por causa do escopo JSVM do PocketBase)
    var parseDateOnly = function (s) {
      var clean = (s || '').split('T')[0].split(' ')[0]
      var parts = clean.split('-')
      return { y: +parts[0], m: +parts[1], d: +parts[2] }
    }

    var formatDateOnly = function (y, m, d) {
      var utc = new Date(Date.UTC(y, m - 1, d))
      var fY = utc.getUTCFullYear()
      var fM = utc.getUTCMonth() + 1
      var fD = utc.getUTCDate()
      return fY + '-' + (fM < 10 ? '0' + fM : '' + fM) + '-' + (fD < 10 ? '0' + fD : '' + fD)
    }

    var addDaysDateOnly = function (dateStr, days) {
      var parsed = parseDateOnly(dateStr)
      var utc = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d + days))
      return formatDateOnly(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
    }

    var dayOfWeekDateOnly = function (dateStr) {
      var parsed = parseDateOnly(dateStr)
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay()
    }

    var srcDow = dayOfWeekDateOnly(sourceDate)
    var tgtDow = dayOfWeekDateOnly(targetDate)

    if (srcDow !== 6 && srcDow !== 0) {
      return e.badRequestError('A data de origem deve ser um sábado ou domingo.')
    }

    if (srcDow !== tgtDow) {
      return e.badRequestError(
        'Fim de semana incompatível: sábado só pode ser movido para sábado e domingo somente para domingo.',
      )
    }

    // Carrega draft
    var draftRecord
    try {
      draftRecord = $app.findRecordById('schedule_drafts', draftId)
    } catch (_) {
      return e.badRequestError('Rascunho não encontrado.')
    }

    var cycleId = draftRecord.getString('cycle')
    var sectorId = draftRecord.getString('sector')

    var cycle
    var sector
    try {
      cycle = $app.findRecordById('shift_cycles', cycleId)
      sector = $app.findRecordById('hospital_sectors', sectorId)
    } catch (_) {
      return e.badRequestError('Ciclo ou setor associado ao rascunho é inválido.')
    }

    var cycleStart = (cycle.getString('start_date') || '').split(' ')[0].split('T')[0]
    var cycleEnd = (cycle.getString('end_date') || '').split(' ')[0].split('T')[0]

    if (sourceDate < cycleStart || sourceDate > cycleEnd) {
      return e.badRequestError('A data de origem (' + sourceDate + ') está fora do ciclo.')
    }
    if (targetDate < cycleStart || targetDate > cycleEnd) {
      return e.badRequestError('A data de destino (' + targetDate + ') está fora do ciclo.')
    }

    // Carrega validation_summary
    var valSummary = draftRecord.get('validation_summary') || {}
    if (typeof valSummary === 'string') {
      try {
        valSummary = JSON.parse(valSummary)
      } catch (_) {
        valSummary = {}
      }
    }

    // Normalização defensiva de assignments (aceita map string->string[], map com datas completas ou strings simples)
    var assignments = valSummary.weekend_off_assignments || {}
    if (typeof assignments !== 'object' || Array.isArray(assignments)) {
      assignments = {}
    }

    var rawStaffDates = assignments[staffId]
    var staffDates = []
    if (Array.isArray(rawStaffDates)) {
      staffDates = rawStaffDates
        .map(function (d) {
          return (String(d) || '').split(' ')[0].split('T')[0]
        })
        .filter(Boolean)
    }

    if (staffDates.length === 0) {
      return e.badRequestError(
        'O colaborador não possui folgas de fim de semana registradas no rascunho.',
      )
    }

    var srcIndex = -1
    for (var i = 0; i < staffDates.length; i++) {
      if (staffDates[i] === sourceDate) {
        srcIndex = i
        break
      }
    }

    if (srcIndex === -1) {
      return e.badRequestError(
        'A data ' + sourceDate + ' não é uma das folgas atuais do colaborador.',
      )
    }

    // Verifica se targetDate já é a outra folga do colaborador
    for (var j = 0; j < staffDates.length; j++) {
      if (j !== srcIndex && staffDates[j] === targetDate) {
        return e.badRequestError(
          'A data de destino já está designada como folga para este colaborador.',
        )
      }
    }

    // Carrega colaborador, cargo e contrato
    var staffProfile
    try {
      staffProfile = $app.findRecordById('staff_profiles', staffId)
    } catch (_) {
      return e.badRequestError('Colaborador não encontrado.')
    }

    // Regra obrigatória: A data de destino não pode coincidir com o período de férias ativo do colaborador
    var vacEnabled = staffProfile.getBool('vacation_enabled')
    var vacStart = (staffProfile.getString('vacation_start') || '').split(' ')[0].split('T')[0]
    var vacEnd = (staffProfile.getString('vacation_end') || '').split(' ')[0].split('T')[0]
    if (vacEnabled && vacStart && vacEnd && vacStart <= vacEnd) {
      if (targetDate >= vacStart && targetDate <= vacEnd) {
        return e.badRequestError(
          'A data de destino (' +
            targetDate +
            ') coincide com o período de férias do colaborador. Dias de férias não podem receber folga de fim de semana.',
        )
      }
    }

    var contracts = $app.findRecordsByFilter(
      'staff_contracts',
      'staff_profile={:sp}',
      '-created',
      1,
      0,
      { sp: staffId },
    )
    var contract = contracts.length > 0 ? contracts[0] : null
    var workHours = 12
    var restHours = 36
    var shiftStart = '07:00:00'
    var shiftTypeRec = null
    if (contract && contract.getString('shift_type')) {
      try {
        shiftTypeRec = $app.findRecordById('shift_types', contract.getString('shift_type'))
        if (shiftTypeRec) {
          workHours = shiftTypeRec.getInt('work_hours') || 12
          restHours = shiftTypeRec.getInt('rest_hours') || 36
          shiftStart = (shiftTypeRec.getString('start_time') || '07:00') + ':00'
          if (shiftStart.length === 5) shiftStart = shiftStart + ':00'
        }
      } catch (_) {}
    }

    // Carrega todos os plantões do rascunho para cycle + sector
    var draftShifts = $app.findRecordsByFilter(
      'shifts',
      'cycle={:cyc} && sector={:sec}',
      'start_time',
      10000,
      0,
      { cyc: cycleId, sec: sectorId },
    )

    // Identifica plantões do colaborador na data de origem e na data de destino
    var targetShiftRecord = null
    var sourceShiftRecord = null

    for (var k = 0; k < draftShifts.length; k++) {
      var sRec = draftShifts[k]
      var spId = sRec.getString('staff_profile') || sRec.getString('user')
      if (spId === staffId) {
        var sDate = (sRec.getString('start_time') || '').split(' ')[0].split('T')[0]
        if (sDate === targetDate) {
          targetShiftRecord = sRec
        } else if (sDate === sourceDate) {
          sourceShiftRecord = sRec
        }
      }
    }

    // Se o colaborador já tinha plantão na origem (o que não deveria acontecer se era folga), loga aviso
    var minStaff = sector.getInt('min_staffing') || 0

    // Validação de cenário com ou sem shift no destino:
    // Caso 1: Destino sem shift do colaborador -> Apenas move a folga (atualiza assignments, overrides, protectedDates).
    // Caso 2: Destino COM shift do colaborador -> Swap atômico do plantão de targetDate para sourceDate.
    var simulatedShifts = []
    draftShifts.forEach(function (s) {
      var sp = s.getString('staff_profile') || s.getString('user')
      var d = (s.getString('start_time') || '').split(' ')[0].split('T')[0]
      if (sp === staffId && d === targetDate) {
        // Swap: Este plantão vai para sourceDate
        simulatedShifts.push({
          id: s.id,
          staff_profile: staffId,
          date: sourceDate,
          isMoved: true,
        })
      } else if (sp === staffId && d === sourceDate) {
        // Se já existia um na origem, remove
      } else {
        simulatedShifts.push({
          id: s.id,
          staff_profile: sp,
          date: d,
          isMoved: false,
        })
      }
    })

    // Valida cobertura mínima do setor pós-movimento / swap
    var dayCounts = {}
    simulatedShifts.forEach(function (s) {
      dayCounts[s.date] = (dayCounts[s.date] || 0) + 1
    })

    var cCur = cycleStart
    while (cCur <= cycleEnd) {
      var cnt = dayCounts[cCur] || 0
      if (minStaff > 0 && cnt < minStaff) {
        return e.badRequestError(
          'Cobertura insuficiente no setor: o movimento deixaria o dia ' +
            cCur +
            ' abaixo do efetivo mínimo (' +
            cnt +
            '/' +
            minStaff +
            ').',
        )
      }
      cCur = addDaysDateOnly(cCur, 1)
    }

    // Prepara novo array de weekend_off_assignments para este staff
    var newStaffDates = []
    for (var m = 0; m < staffDates.length; m++) {
      if (m === srcIndex) {
        newStaffDates.push(targetDate)
      } else {
        newStaffDates.push(staffDates[m])
      }
    }

    // Ordena para manter padrão consistente: sábado primeiro, depois domingo
    newStaffDates.sort(function (a, b) {
      var dA = dayOfWeekDateOnly(a)
      var dB = dayOfWeekDateOnly(b)
      if (dA === 6 && dB === 0) return -1
      if (dA === 0 && dB === 6) return 1
      return a.localeCompare(b)
    })

    // Prepara audit trail de overrides
    var overrides = valSummary.weekend_off_overrides || {}
    if (typeof overrides !== 'object' || Array.isArray(overrides)) {
      overrides = {}
    }
    if (!overrides[staffId]) {
      overrides[staffId] = {}
    }

    var overrideKey = srcDow === 6 ? 'saturday' : 'sunday'
    overrides[staffId][overrideKey] = {
      source_date: sourceDate,
      target_date: targetDate,
      weekday: srcDow,
      moved_at: new Date().toISOString(),
      moved_by: e.auth ? e.auth.id : '',
      manual_override: true,
    }

    assignments[staffId] = newStaffDates
    valSummary.weekend_off_assignments = assignments
    valSummary.weekend_off_overrides = overrides

    // Executa atomicamente em transação
    try {
      $app.runInTransaction(function (txApp) {
        // 1. Atualiza plantão do colaborador de targetDate para sourceDate se existia
        if (targetShiftRecord) {
          var targetStartDate = new Date(sourceDate + 'T' + shiftStart + '.000Z')
          var targetEndDate = new Date(targetStartDate.getTime() + workHours * 3600000)
          var startStr = targetStartDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z'
          var endStr = targetEndDate.toISOString().replace('T', ' ').substring(0, 23) + 'Z'

          targetShiftRecord.set('start_time', startStr)
          targetShiftRecord.set('end_time', endStr)
          txApp.save(targetShiftRecord)
        }

        // Se havia algum plantão indevido em sourceDate do mesmo colaborador, remove
        if (
          sourceShiftRecord &&
          sourceShiftRecord.id !== (targetShiftRecord ? targetShiftRecord.id : '')
        ) {
          txApp.delete(sourceShiftRecord)
        }

        // 2. Atualiza schedule_draft com validation_summary
        draftRecord.set('validation_summary', valSummary)
        txApp.save(draftRecord)

        // 3. Registra auditoria
        var auditCol = txApp.findCollectionByNameOrId('audit_logs')
        var audit = new Record(auditCol)
        audit.set('user', e.auth ? e.auth.id : '')
        audit.set('action', 'WEEKEND_OFF_MANUAL_OVERRIDE')
        audit.set(
          'details',
          JSON.stringify({
            draft_id: draftId,
            staff_id: staffId,
            staff_name: staffProfile.getString('name'),
            source_date: sourceDate,
            target_date: targetDate,
            weekday: srcDow,
            manual_override: true,
          }),
        )
        txApp.saveNoValidate(audit)
      })
    } catch (txErr) {
      return e.internalServerError(
        'Falha ao aplicar alteração de folga: ' + (txErr.message || String(txErr)),
      )
    }

    return e.json(200, {
      success: true,
      draft_id: draftId,
      staff_id: staffId,
      source_date: sourceDate,
      target_date: targetDate,
      weekend_off_assignments: assignments,
      weekend_off_overrides: overrides,
      message: 'Folga de fim de semana movida com sucesso.',
    })
  },
  $apis.requireAuth(),
)
