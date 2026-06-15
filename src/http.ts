import type { Config } from './config.js'

export interface ApiErrorBody {
  error?: { code?: string; message?: string; request_id?: string }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

export class HttpClient {
  constructor(private readonly cfg: Config) {}

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    // Auth is validated lazily so the MCP server can boot + serve
    // `tools/list` for registry introspection without credentials.
    // The first `tools/call` that needs the API fails here with a clear
    // message instead of crashing the process at startup.
    if (!this.cfg.apiKey) {
      throw new ApiError(
        401,
        'unauthorized',
        'GIBEON_API_KEY is not set — create a key in the Gibeon CMS under Settings → API and set it in your MCP host config.',
      )
    }
    if (!this.cfg.apiKey.startsWith('gib_')) {
      throw new ApiError(
        401,
        'invalid_key',
        `GIBEON_API_KEY does not look like a Gibeon key (expected prefix 'gib_', got '${this.cfg.apiKey.slice(0, 4)}…').`,
      )
    }

    const { method = 'GET', body, query } = opts

    let url = `${this.cfg.apiUrl}${path}`
    if (query) {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) params.set(k, String(v))
      }
      const qs = params.toString()
      if (qs) url += `?${qs}`
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      'User-Agent': '@gibeon/mcp-server',
      Accept: 'application/json',
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(0, 'timeout', `request to ${path} timed out after ${this.cfg.timeoutMs}ms`)
      }
      throw new ApiError(0, 'network_error', `network error calling ${path}: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }

    if (res.status === 204) return undefined as T

    const text = await res.text()
    let parsed: unknown = null
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new ApiError(res.status, 'invalid_json', `response was not JSON: ${text.slice(0, 200)}`)
      }
    }

    if (!res.ok) {
      const body = parsed as ApiErrorBody | null
      const code = body?.error?.code ?? `http_${res.status}`
      const message = body?.error?.message ?? `HTTP ${res.status} on ${method} ${path}`
      throw new ApiError(res.status, code, message, body?.error?.request_id)
    }

    return parsed as T
  }
}
