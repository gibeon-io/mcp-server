// Runtime configuration for the Gibeon MCP server. Read from env at start
// (the MCP host launches us once and re-uses the process).
//
// API key validation is deferred to first request — the server has to boot
// and respond to MCP `tools/list` even when no key is set, so that
// introspection-based registries (Glama, etc.) can index us without needing
// real credentials. A missing or malformed key surfaces as an MCP tool
// error on the first `tools/call`, with a clear "set GIBEON_API_KEY"
// message.

const DEFAULT_API_URL = 'https://api.gibeon.io'

export interface Config {
  /** May be empty at boot; HttpClient.request validates before each call. */
  apiKey: string
  apiUrl: string
  /** HTTP timeout per upstream call, in ms. */
  timeoutMs: number
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiUrl = (env.GIBEON_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '')
  const timeoutMs = env.GIBEON_API_TIMEOUT_MS ? Number(env.GIBEON_API_TIMEOUT_MS) : 15000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`GIBEON_API_TIMEOUT_MS must be a positive number (got '${env.GIBEON_API_TIMEOUT_MS}').`)
  }

  return { apiKey: env.GIBEON_API_KEY ?? '', apiUrl, timeoutMs }
}
