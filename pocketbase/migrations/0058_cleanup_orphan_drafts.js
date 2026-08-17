// 0058_cleanup_orphan_drafts.js
//
// Root-cause fix for the spurious "Violação de Regra — Dia 20/09:
// Efetivo abaixo do mínimo (0/5)" message shown in Gestão de Escalas.
//
// Background: five schedule_drafts were created on 2026-08-17 for the
// "Ciclo Outubro 2026" (h4it2dk7pabwyz9) + UTI ADULTO sector
// (e8knxl3jy0s5ql5) by the deterministic fallback. All five have NO
// linked shifts and an empty generation_run — they are orphan drafts.
// Their persisted schedule_validation_issues (mostly "Efetivo abaixo do
// ideal" warnings) were being surfaced by the frontend as if they were
// live coverage failures, polluting the escalation dashboard.
//
// This migration is IDEMPOTENT: it only acts on drafts whose status is
// still 'draft' and issues that are still unresolved. It NEVER deletes
// records — it only changes status and marks issues resolved.

migrate(
  (app) => {
    var ORPHAN_DRAFT_IDS = [
      'woobjvxx9d14pfx',
      'e6gcdhwzpv5vy92',
      '19n3pxdx8ny2a98',
      'fsetn4azutmwktk',
      'qtpaxmeenpeicus',
    ]

    var RESOLUTION_MSG = 'Rascunho órfão sem shifts substituído.'
    var DRAFT_RESOLUTION = 'Rascunho órfão sem shifts — substituído por limpeza automática.'

    // --- 1. Supersede the orphan drafts (only if still 'draft') ---
    var draftsCol = app.findCollectionByNameOrId('schedule_drafts')
    for (var i = 0; i < ORPHAN_DRAFT_IDS.length; i++) {
      var draftId = ORPHAN_DRAFT_IDS[i]
      try {
        var rec = app.findRecordById('schedule_drafts', draftId)
      } catch (_) {
        // draft no longer exists — nothing to do
        continue
      }
      if (rec.getString('status') !== 'draft') {
        // already superseded/published/rejected — leave as is
        continue
      }

      rec.set('status', 'superseded')

      // Merge the resolution note into the existing validation_summary JSON
      // without dropping the historical warnings already stored there.
      var existingSummary = {}
      try {
        var raw = rec.get('validation_summary')
        if (raw) {
          existingSummary = typeof raw === 'object' ? raw : JSON.parse(String(raw))
        }
      } catch (_) {
        existingSummary = {}
      }
      existingSummary.resolution = DRAFT_RESOLUTION
      existingSummary.cleanup_migration = '0058'
      rec.set('validation_summary', existingSummary)

      app.saveNoValidate(rec)
    }

    // --- 2. Resolve every schedule_validation_issue linked to these drafts ---
    //     (only those still unresolved). Uses a per-draft filter so we only
    //     touch issues that actually belong to the orphan drafts.
    var issuesCol = app.findCollectionByNameOrId('schedule_validation_issues')
    for (var d = 0; d < ORPHAN_DRAFT_IDS.length; d++) {
      var dId = ORPHAN_DRAFT_IDS[d]
      var linked = []
      try {
        linked = app.findRecordsByFilter(
          'schedule_validation_issues',
          'draft={:d} && resolved=false',
          '-created',
          10000,
          0,
          { d: dId },
        )
      } catch (_) {
        linked = []
      }
      for (var j = 0; j < linked.length; j++) {
        var issue = linked[j]
        issue.set('resolved', true)
        issue.set('resolution', RESOLUTION_MSG)
        app.saveNoValidate(issue)
      }
    }
  },
  (app) => {
    // Revert: restore the orphan drafts to 'draft' and reopen their issues.
    // Only reverts records that carry our cleanup marker / resolution text,
    // so a re-apply of the migration remains safe.
    var ORPHAN_DRAFT_IDS = [
      'woobjvxx9d14pfx',
      'e6gcdhwzpv5vy92',
      '19n3pxdx8ny2a98',
      'fsetn4azutmwktk',
      'qtpaxmeenpeicus',
    ]

    for (var i = 0; i < ORPHAN_DRAFT_IDS.length; i++) {
      try {
        var rec = app.findRecordById('schedule_drafts', ORPHAN_DRAFT_IDS[i])
      } catch (_) {
        continue
      }
      if (rec.getString('status') !== 'superseded') continue

      var summary = {}
      try {
        var raw = rec.get('validation_summary')
        if (raw) summary = typeof raw === 'object' ? raw : JSON.parse(String(raw))
      } catch (_) {
        summary = {}
      }
      if (!summary.cleanup_migration) continue

      rec.set('status', 'draft')
      delete summary.resolution
      delete summary.cleanup_migration
      rec.set('validation_summary', summary)
      app.saveNoValidate(rec)
    }

    var RESOLUTION_MSG = 'Rascunho órfão sem shifts substituído.'
    for (var d = 0; d < ORPHAN_DRAFT_IDS.length; d++) {
      var linked = []
      try {
        linked = app.findRecordsByFilter(
          'schedule_validation_issues',
          'draft={:d} && resolved=true && resolution={:r}',
          '-created',
          10000,
          0,
          { d: ORPHAN_DRAFT_IDS[d], r: RESOLUTION_MSG },
        )
      } catch (_) {
        linked = []
      }
      for (var j = 0; j < linked.length; j++) {
        var issue = linked[j]
        issue.set('resolved', false)
        issue.set('resolution', '')
        app.saveNoValidate(issue)
      }
    }
  },
)
