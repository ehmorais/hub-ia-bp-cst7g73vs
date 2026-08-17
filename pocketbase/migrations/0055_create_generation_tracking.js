// 0055 — Schedule generation tracking: run, draft, validation_issues
// collections + new relation fields on `shifts`. Adds the rastreability
// layer for AI/deterministic schedule generation without touching any
// existing staff/contract/rule/timeoff/shift_type/cycle/sector records.
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const cyclesId = app.findCollectionByNameOrId('shift_cycles').id
    const sectorsId = app.findCollectionByNameOrId('hospital_sectors').id
    const profilesId = app.findCollectionByNameOrId('staff_profiles').id

    // 1A. schedule_generation_runs
    // NOTE: `schedule_drafts` is created in the same migration, but a run
    // does NOT reference drafts (the link is draft -> run), so the runs
    // collection can be defined fully up-front.
    const runs = new Collection({
      name: 'schedule_generation_runs',
      type: 'base',
      // Admin/RH (role Admin) can create/read/update; Operador only reads.
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        {
          name: 'cycle',
          type: 'relation',
          required: true,
          collectionId: cyclesId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'sector',
          type: 'relation',
          required: true,
          collectionId: sectorsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'requested_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          values: [
            'queued',
            'validating',
            'generating',
            'fallback',
            'saving',
            'completed',
            'failed',
            'cancelled',
          ],
          maxSelect: 1,
        },
        { name: 'stage', type: 'text', max: 255 },
        { name: 'progress', type: 'number', min: 0, max: 100 },
        { name: 'model', type: 'text', max: 100 },
        {
          name: 'generation_source',
          type: 'select',
          values: ['ai', 'deterministic', 'hybrid'],
          maxSelect: 1,
        },
        { name: 'priority', type: 'text', max: 100 },
        { name: 'strictness', type: 'number', min: 0, max: 100 },
        { name: 'idempotency_key', type: 'text', max: 255 },
        { name: 'started_at', type: 'date' },
        { name: 'finished_at', type: 'date' },
        { name: 'duration_ms', type: 'number', min: 0 },
        { name: 'error_code', type: 'text', max: 100 },
        { name: 'error_detail', type: 'text', max: 500 },
        // Structured generation metrics (sanitized — no PII).
        { name: 'metrics', type: 'json' },
        // AI response diagnostics (sanitized — never the full prompt or
        // collaborator names; only structural metadata + short preview).
        { name: 'ai_diagnostics', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // Unique on idempotency_key so a concurrent re-submit for the same
        // cycle+sector pair cannot create duplicate in-flight runs.
        'CREATE UNIQUE INDEX idx_run_idempotency ON schedule_generation_runs (idempotency_key)',
      ],
    })
    app.save(runs)

    // 1B. schedule_drafts
    const drafts = new Collection({
      name: 'schedule_drafts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        {
          name: 'cycle',
          type: 'relation',
          required: true,
          collectionId: cyclesId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'sector',
          type: 'relation',
          required: true,
          collectionId: sectorsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'generation_run',
          type: 'relation',
          collectionId: runs.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          values: ['draft', 'validated', 'published', 'rejected', 'superseded'],
          maxSelect: 1,
        },
        { name: 'version', type: 'number', min: 1 },
        {
          name: 'generated_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'generation_source',
          type: 'select',
          values: ['ai', 'deterministic', 'hybrid'],
          maxSelect: 1,
        },
        { name: 'validation_summary', type: 'json' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'validated_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'published_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'validated_at', type: 'date' },
        { name: 'published_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      // NOTE: a partial unique index "WHERE status != 'superseded'" is the
      // ideal constraint, but PocketBase/SQLite here rejects CREATE INDEX
      // with a WHERE referencing a non-system column reliably across
      // versions, and a plain UNIQUE index over (cycle, sector) would
      // wrongly forbid more than one *superseded* draft. We therefore
      // create a NON-unique index here and enforce "only one active draft
      // per cycle+sector" in the generation hook (schedule_drafts lifecycle).
      indexes: ['CREATE INDEX idx_draft_cycle_sector_active ON schedule_drafts (cycle, sector)'],
    })
    app.save(drafts)

    // 1C. schedule_validation_issues
    const issues = new Collection({
      name: 'schedule_validation_issues',
      type: 'base',
      // Everyone authenticated can read; only Admin/RH can create/update.
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.role = 'Admin'",
      updateRule: "@request.auth.role = 'Admin'",
      deleteRule: "@request.auth.role = 'Admin'",
      fields: [
        {
          name: 'draft',
          type: 'relation',
          collectionId: drafts.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'run', type: 'relation', collectionId: runs.id, maxSelect: 1, cascadeDelete: true },
        { name: 'rule_name', type: 'text', max: 255 },
        {
          name: 'severity',
          type: 'select',
          values: ['hard', 'preference', 'info'],
          maxSelect: 1,
        },
        { name: 'code', type: 'text', max: 100 },
        { name: 'message', type: 'text', max: 500 },
        { name: 'issue_date', type: 'date' },
        {
          name: 'staff_profile',
          type: 'relation',
          collectionId: profilesId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'resolved', type: 'bool' },
        { name: 'resolution', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_issues_draft ON schedule_validation_issues (draft)',
        'CREATE INDEX idx_issues_severity ON schedule_validation_issues (severity)',
        'CREATE INDEX idx_issues_run ON schedule_validation_issues (run)',
      ],
    })
    app.save(issues)

    // 1D. Add `draft` + `generation_run` relation fields to `shifts`.
    // Existing shift rules already allow Admin writes; these new optional
    // relation fields simply extend the schema (no rule change needed —
    // the existing createRule/updateRule already cover them).
    const shifts = app.findCollectionByNameOrId('shifts')
    if (!shifts.fields.getByName('draft')) {
      shifts.fields.add(
        new RelationField({
          name: 'draft',
          collectionId: drafts.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!shifts.fields.getByName('generation_run')) {
      shifts.fields.add(
        new RelationField({
          name: 'generation_run',
          collectionId: runs.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    shifts.addIndex('idx_shifts_draft', false, 'draft', "draft != ''")
    shifts.addIndex('idx_shifts_run', false, 'generation_run', "generation_run != ''")
    app.save(shifts)
  },
  (app) => {
    // Revert: remove new shifts fields/indexes, then drop the new collections.
    try {
      const shifts = app.findCollectionByNameOrId('shifts')
      try {
        shifts.removeIndex('idx_shifts_run')
      } catch (_) {}
      try {
        shifts.removeIndex('idx_shifts_draft')
      } catch (_) {}
      if (shifts.fields.getByName('generation_run')) shifts.fields.removeByName('generation_run')
      if (shifts.fields.getByName('draft')) shifts.fields.removeByName('draft')
      app.save(shifts)
    } catch (_) {}

    try {
      app.delete(app.findCollectionByNameOrId('schedule_validation_issues'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('schedule_drafts'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('schedule_generation_runs'))
    } catch (_) {}
  },
)
