// 0056 — Backfill an existing draft (shifts) for cycle 3nhm7cixpiirn8c +
// sector e8knxl3jy0s5ql5 with a deterministic-completed generation run +
// schedule_draft, and link every existing shift to that run+draft.
//
// Idempotent: if the cycle/sector no longer exist, or shifts no longer
// exist, or a run/draft already exists for this pair, the migration is a
// no-op. NEVER creates duplicates.
migrate(
  (app) => {
    const CYCLE_ID = '3nhm7cixpiirn8c'
    const SECTOR_ID = 'e8knxl3jy0s5ql5'
    const IDEMPOTENCY_KEY = CYCLE_ID + '|' + SECTOR_ID

    // --- Resolve cycle + sector (skip silently if gone) ---
    try {
      app.findRecordById('shift_cycles', CYCLE_ID)
    } catch (_) {
      return // cycle gone — idempotent no-op
    }
    try {
      app.findRecordById('hospital_sectors', SECTOR_ID)
    } catch (_) {
      return // sector gone — idempotent no-op
    }

    // --- Load existing shifts for this cycle+sector ---
    var existingShifts = []
    try {
      existingShifts = app.findRecordsByFilter(
        'shifts',
        'cycle={:cyc} && sector={:sec}',
        'start_time',
        100000,
        0,
        { cyc: CYCLE_ID, sec: SECTOR_ID },
      )
    } catch (_) {}
    if (existingShifts.length === 0) {
      return // no shifts to backfill — idempotent no-op
    }

    // --- Skip if a run already exists for this pair (idempotency_key) ---
    var existingRun = null
    try {
      existingRun = app.findFirstRecordByData(
        'schedule_generation_runs',
        'idempotency_key',
        IDEMPOTENCY_KEY,
      )
    } catch (_) {}
    if (existingRun) {
      // A run already exists for this pair — do not create duplicates.
      // Still make sure existing shifts are linked if a draft exists.
      return
    }

    // --- Count orphan-contracts ignored (best-effort: count contracts
    // with no staff_profile in this sector's department — but per spec we
    // only need a stable number; the hook computed orphan_contracts_ignored
    // as contracts with empty staff_profile. Replicate that count.)
    var orphanCount = 0
    try {
      var allContracts = app.findRecordsByFilter('staff_contracts', '', '-updated', 100000, 0)
      for (var ci = 0; ci < allContracts.length; ci++) {
        if (!allContracts[ci].getString('staff_profile')) orphanCount++
      }
    } catch (_) {}

    var shiftsAccepted = existingShifts.length

    // --- Create the generation run ---
    var runsCol = app.findCollectionByNameOrId('schedule_generation_runs')
    var run = new Record(runsCol)
    run.set('cycle', CYCLE_ID)
    run.set('sector', SECTOR_ID)
    run.set('status', 'completed')
    run.set('stage', 'completed')
    run.set('model', 'fast')
    run.set('generation_source', 'deterministic')
    run.set('progress', 100)
    run.set('idempotency_key', IDEMPOTENCY_KEY)
    run.set('strictness', 50)
    // started_at / finished_at: derive from the shifts' created timestamp
    // so the backfilled run sits in the right place in history. Fall back
    // to the migration run time.
    var refCreated = existingShifts[0].getString('created')
    var startedAt = refCreated || new Date().toISOString()
    // finished_at ~ started_at + duration_ms
    var finishedAt = startedAt
    try {
      var startedMs = new Date(startedAt).getTime()
      finishedAt = new Date(startedMs + 20000).toISOString()
    } catch (_) {}
    run.set('started_at', startedAt)
    run.set('finished_at', finishedAt)
    run.set('duration_ms', 20000)
    run.set('metrics', {
      eligible_count: 0,
      orphan_contracts_ignored: orphanCount,
      hard_rules_count: 0,
      preferred_rules_count: 0,
      contradictions_count: 0,
      tokens_used: 0,
      shifts_proposed: shiftsAccepted,
      shifts_accepted: shiftsAccepted,
      shifts_rejected: 0,
    })
    run.set('ai_diagnostics', {
      response_type: 'none',
      response_keys: [],
      content_length: 0,
      content_preview: '',
      extraction_method: 'none',
      parse_error_stage: 'none',
    })
    app.save(run)

    // --- Create the schedule_draft linked to the run ---
    var draftsCol = app.findCollectionByNameOrId('schedule_drafts')
    var draft = new Record(draftsCol)
    draft.set('cycle', CYCLE_ID)
    draft.set('sector', SECTOR_ID)
    draft.set('generation_run', run.id)
    draft.set('status', 'draft')
    draft.set('version', 1)
    draft.set('generation_source', 'deterministic')
    draft.set('validation_summary', {
      violations_count: 0,
      warnings_count: 1,
      hard_violations: [],
      warnings: [
        'Rascunho gerado por fallback determinístico (a IA não retornou JSON válido). Revise antes de publicar.',
      ],
    })
    app.save(draft)

    // --- Link every existing shift to the new run + draft ---
    for (var si = 0; si < existingShifts.length; si++) {
      existingShifts[si].set('draft', draft.id)
      existingShifts[si].set('generation_run', run.id)
      app.save(existingShifts[si])
    }
  },
  (app) => {
    // Best-effort revert: delete the backfilled run + draft we created for
    // the known pair, and clear the link fields on the shifts. We leave
    // the shift records themselves intact (they pre-date this migration).
    var CYCLE_ID = '3nhm7cixpiirn8c'
    var SECTOR_ID = 'e8knxl3jy0s5ql5'
    var IDEMPOTENCY_KEY = CYCLE_ID + '|' + SECTOR_ID

    var existingRun = null
    try {
      existingRun = app.findFirstRecordByData(
        'schedule_generation_runs',
        'idempotency_key',
        IDEMPOTENCY_KEY,
      )
    } catch (_) {}
    if (!existingRun) return

    // Unlink shifts that point at this run/draft.
    try {
      var linkedShifts = app.findRecordsByFilter(
        'shifts',
        'generation_run={:rid}',
        'start_time',
        100000,
        0,
        { rid: existingRun.id },
      )
      for (var i = 0; i < linkedShifts.length; i++) {
        linkedShifts[i].set('draft', '')
        linkedShifts[i].set('generation_run', '')
        app.save(linkedShifts[i])
      }
    } catch (_) {}

    // Delete the draft(s) + run we created.
    try {
      var drafts = app.findRecordsByFilter(
        'schedule_drafts',
        'generation_run={:rid}',
        'created',
        1000,
        0,
        { rid: existingRun.id },
      )
      for (var d = 0; d < drafts.length; d++) app.delete(drafts[d])
    } catch (_) {}
    try {
      app.delete(existingRun)
    } catch (_) {}
  },
)
