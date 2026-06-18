migrate(
  (app) => {
    app
      .db()
      .newQuery(
        "UPDATE ia_tools SET status = 'active' WHERE status IS NULL OR status = '' OR status != 'active'",
      )
      .execute()
  },
  (app) => {},
)
