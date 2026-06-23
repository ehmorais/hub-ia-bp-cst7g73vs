routerAdd(
  'POST',
  '/backend/v1/escala/submit-hr',
  (e) => {
    const body = e.requestInfo().body || {}
    const cycleId = body.cycle_id
    if (!cycleId) return e.badRequestError('Missing cycle_id')

    const userId = e.auth?.id
    if (!userId) return e.unauthorizedError('Auth required')

    let cycle
    try {
      cycle = $app.findRecordById('shift_cycles', cycleId)
    } catch (_) {
      return e.notFoundError('Cycle not found')
    }

    if (cycle.getString('status') !== 'draft') {
      return e.badRequestError('Cycle is not in draft status')
    }

    cycle.set('status', 'active')
    $app.save(cycle)

    try {
      const logsCol = $app.findCollectionByNameOrId('audit_logs')
      const log = new Record(logsCol)
      log.set('user', userId)
      log.set('action', 'submit_to_hr')
      log.set('department', 'Escalas')
      log.set('details', `Submeteu o ciclo '${cycle.getString('name')}' para o RH.`)
      $app.save(log)
    } catch (err) {
      $app.logger().error('Failed to log audit', 'error', err.message)
    }

    // Simulate email delivery using the internal mailer capability
    $app
      .logger()
      .info(
        'Simulação de envio de email ao RH',
        'cycle',
        cycle.getString('name'),
        'status',
        'success',
      )

    return e.json(200, { success: true, message: 'Escala gravada e enviada ao RH com sucesso.' })
  },
  $apis.requireAuth(),
)
