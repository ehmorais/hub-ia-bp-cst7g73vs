migrate(
  (app) => {
    // Goal: ensure staff_contracts references the operational collaborator
    // (staff_profiles), never a portal user. We only reconcile cases that can be
    // resolved UNAMBIGUOUSLY; nothing is deleted and no association is guessed.
    //
    // Strategy (idempotent):
    // 1. For each staff_contracts row that has a `user` but no `staff_profile`:
    //    - The original seed (0037) created demo users that no longer exist (the
    //      users were purged by 0042_cleanup_users). Their `user` FK is now
    //      dangling. We cannot recover a staff_profile from a deleted user, so we
    //      simply clear the dangling `user` reference so the row stops pretending
    //      to be linked to someone. The contract row itself (type, hour limit,
    //      shift type) is preserved.
    //    - We do NOT attempt to match by professional_id because the seed users
    //      never carried one, and matching by name would be guesswork.
    // 2. Leave every other row untouched.

    const contractsCol = app.findCollectionByNameOrId('staff_contracts')

    // Gather live user ids so we can tell dangling references from valid ones.
    const liveUserIds = {}
    try {
      const users = app.findRecordsByFilter('_pb_users_auth_', 'id != ""', '', 1000, 0)
      for (const u of users) liveUserIds[u.id] = true
    } catch (_) {
      // If the users table is unreadable for any reason, treat every user ref as
      // dangling — clearing an already-dangling ref is still safe, but we'd rather
      // not touch rows whose user genuinely exists. Skip the whole pass in that case.
      return
    }

    let contractRecords = []
    try {
      contractRecords = app.findRecordsByFilter('staff_contracts', '', 'created', 10000, 0)
    } catch (_) {
      return
    }

    for (const contract of contractRecords) {
      const userId = contract.getString('user')
      const profileId = contract.getString('staff_profile')

      // Already correctly linked to a profile — nothing to do.
      if (profileId) continue

      // No user reference at all and no profile — nothing resolvable; leave as-is.
      if (!userId) continue

      // User reference exists but points to a user that no longer exists (dangling).
      // Clear only the dangling reference; keep the contract row + its settings.
      if (!liveUserIds[userId]) {
        contract.set('user', '')
        try {
          app.save(contract)
        } catch (_) {
          // Saving should not fail, but never block the migration on a single row.
        }
      }
      // If the user still exists but there's no staff_profile, we intentionally
      // DO NOT invent a link — that would be guesswork. The operator can re-link
      // it from the Contratos / Colaboradores tabs.
    }
  },
  (app) => {
    // Non-reversible: cleared references cannot be reconstructed because the
    // original user records they pointed to were already deleted by prior
    // migrations (0042). We keep the down migration as a no-op for safety.
  },
)
