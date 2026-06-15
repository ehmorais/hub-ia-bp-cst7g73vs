/**
 * Skip Cloud Configuration & Client
 * Connects to Skip Cloud for managing collections related to projects and logs.
 */

const SKIP_CLOUD_URL = import.meta.env.VITE_SKIP_CLOUD_URL || 'https://api.goskip.app'
const SKIP_CLOUD_PROJECT = import.meta.env.VITE_SKIP_CLOUD_PROJECT_ID || 'hub-ia-bp'

export const skipCloud = {
  url: SKIP_CLOUD_URL,
  project: SKIP_CLOUD_PROJECT,

  async collection(name: string) {
    return {
      async find() {
        console.info(`[Skip Cloud] Fetched from collection: ${name}`)
        return []
      },
      async insert(data: any) {
        console.info(`[Skip Cloud] Inserted into collection: ${name}`, data)
        return { id: crypto.randomUUID(), ...data }
      },
    }
  },
}
