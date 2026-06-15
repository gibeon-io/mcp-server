import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HttpClient, ApiError } from './http.js'

const cfg = { apiKey: 'gib_test_xyz', apiUrl: 'https://api.example.com', timeoutMs: 1000 }

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HttpClient', () => {
  it('GETs with Bearer header + Accept', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }))
    const client = new HttpClient(cfg)
    const res = await client.request('/v1/players')
    expect(res).toEqual({ data: [] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/players')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer gib_test_xyz')
    expect(init.headers.Accept).toBe('application/json')
    expect(init.body).toBeUndefined()
  })

  it('serialises query params and skips undefined', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }))
    const client = new HttpClient(cfg)
    await client.request('/v1/players', { query: { status: 'online', group_id: undefined } })
    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/players?status=online')
  })

  it('PATCH posts JSON body + Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: '1' } }))
    const client = new HttpClient(cfg)
    await client.request('/v1/players/1', { method: 'PATCH', body: { name: 'New' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PATCH')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"name":"New"}')
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = new HttpClient(cfg)
    const res = await client.request('/v1/players/1', { method: 'DELETE' })
    expect(res).toBeUndefined()
  })

  it('maps API error body to ApiError with code + request_id', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, {
        error: { code: 'not_found', message: 'player x not found', request_id: 'req_abc' },
      }),
    )
    const client = new HttpClient(cfg)
    await expect(client.request('/v1/players/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      requestId: 'req_abc',
    })
  })

  it('throws timeout ApiError on AbortError', async () => {
    fetchMock.mockImplementationOnce(() => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    const client = new HttpClient(cfg)
    await expect(client.request('/v1/players')).rejects.toMatchObject({
      code: 'timeout',
      status: 0,
    })
  })

  it('wraps network errors as ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND api.example.com'))
    const client = new HttpClient(cfg)
    await expect(client.request('/v1/players')).rejects.toBeInstanceOf(ApiError)
  })

  it('throws invalid_json on non-JSON response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>nope</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    const client = new HttpClient(cfg)
    await expect(client.request('/v1/players')).rejects.toMatchObject({ code: 'invalid_json' })
  })

  it('throws unauthorized without hitting fetch when apiKey is empty (lazy validation)', async () => {
    const client = new HttpClient({ ...cfg, apiKey: '' })
    await expect(client.request('/v1/players')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws invalid_key when apiKey lacks the gib_ prefix', async () => {
    const client = new HttpClient({ ...cfg, apiKey: 'sk-foo' })
    await expect(client.request('/v1/players')).rejects.toMatchObject({
      code: 'invalid_key',
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
