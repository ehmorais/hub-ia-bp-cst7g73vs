migrate(
  (app) => {
    app
      .db()
      .newQuery("UPDATE ia_tools SET status = 'active' WHERE status != 'active' OR status IS NULL")
      .execute()
  },
  (app) => {
    // Revert not applicable
  },
)
