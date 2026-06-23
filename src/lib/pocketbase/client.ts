import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Intercept requests to append AI settings for shift generation
pb.beforeSend = function (url, options) {
  if (
    typeof window !== 'undefined' &&
    options.method === 'POST' &&
    (url.includes('/backend/v1/escala/generate') || url.includes('/backend/v1/escala/draft'))
  ) {
    try {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      if (body && typeof body === 'object') {
        const priority = localStorage.getItem('escala_ai_priority') || 'staffing'
        const strictness = parseInt(localStorage.getItem('escala_ai_strictness') || '50', 10)
        body.priority = priority
        body.strictness = strictness
        options.body = JSON.stringify(body)
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return { url, options }
}

export default pb
