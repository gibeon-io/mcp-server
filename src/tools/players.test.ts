import { describe, it, expect, beforeEach, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerPlayerTools } from './players.js'
import type { HttpClient } from '../http.js'

interface ToolCall {
  name: string
  args: Record<string, unknown>
}

// Minimal McpServer harness — we register tools, then invoke their callbacks
// directly via the server's internal handler. We don't boot the transport.
class HarnessHttp {
  public calls: Array<{ path: string; opts?: Record<string, unknown> }> = []
  constructor(private readonly responder: (call: { path: string; opts?: Record<string, unknown> }) => unknown) {}
  async request(path: string, opts?: Record<string, unknown>): Promise<unknown> {
    const call = { path, opts }
    this.calls.push(call)
    return this.responder(call)
  }
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<ToolCall> {
  const server_: unknown = server
  const reg = (server_ as { _registeredTools: Record<string, { handler: (a: unknown) => Promise<unknown> }> })
    ._registeredTools
  const entry = reg[name]
  if (!entry) throw new Error(`tool ${name} not registered`)
  const result = await entry.handler(args)
  return { name, args, ...(result as object) } as ToolCall
}

let server: McpServer
let http: HarnessHttp
let responder: (call: { path: string; opts?: Record<string, unknown> }) => unknown

beforeEach(() => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  responder = vi.fn()
  http = new HarnessHttp((c) => responder(c))
  registerPlayerTools(server, http as unknown as HttpClient)
})

describe('list_players', () => {
  it('passes query filters through', async () => {
    responder = vi.fn(() => ({ data: [{ id: 'p1' }], next_cursor: null }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)

    await callTool(server, 'list_players', { status: 'online', group_id: '123e4567-e89b-12d3-a456-426614174000' })
    expect(http.calls[0].path).toBe('/v1/players')
    expect(http.calls[0].opts).toMatchObject({
      query: { status: 'online', group_id: '123e4567-e89b-12d3-a456-426614174000' },
    })
  })

  it('rejects unknown status', async () => {
    await expect(callTool(server, 'list_players', { status: 'maybe' })).rejects.toBeTruthy()
  })
})

describe('get_player', () => {
  it('hits /v1/players/:id', async () => {
    responder = vi.fn(() => ({ data: { id: 'p1', name: 'Lobby' } }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)
    const ID = '123e4567-e89b-12d3-a456-426614174000'
    await callTool(server, 'get_player', { player_id: ID })
    expect(http.calls[0].path).toBe(`/v1/players/${ID}`)
  })
})

describe('update_player', () => {
  it('PATCHes with the patch fields (no player_id in body)', async () => {
    responder = vi.fn(() => ({ data: { id: 'p1' }, publish_required: true }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)
    const ID = '123e4567-e89b-12d3-a456-426614174000'
    const PL = '223e4567-e89b-12d3-a456-426614174001'
    await callTool(server, 'update_player', { player_id: ID, name: 'Lobby HQ', playlist_id: PL })
    expect(http.calls[0].path).toBe(`/v1/players/${ID}`)
    expect(http.calls[0].opts).toMatchObject({
      method: 'PATCH',
      body: { name: 'Lobby HQ', playlist_id: PL },
    })
  })

  it('supports clearing assignments with null', async () => {
    responder = vi.fn(() => ({ data: { id: 'p1' }, publish_required: true }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)
    const ID = '123e4567-e89b-12d3-a456-426614174000'
    await callTool(server, 'update_player', { player_id: ID, playlist_id: null })
    expect(http.calls[0].opts).toMatchObject({ body: { playlist_id: null } })
  })
})

describe('publish_players', () => {
  it('routes to /v1/players/:id/publish when player_id given', async () => {
    responder = vi.fn(() => ({ data: { player_id: 'p1', snapshot_id: 's1' } }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)
    const ID = '123e4567-e89b-12d3-a456-426614174000'
    await callTool(server, 'publish_players', { player_id: ID })
    expect(http.calls[0].path).toBe(`/v1/players/${ID}/publish`)
    expect(http.calls[0].opts).toMatchObject({ method: 'POST' })
  })

  it('routes to /v1/players/publish when no player_id', async () => {
    responder = vi.fn(() => ({ data: { published: [], skipped: [], failed: [] } }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)
    await callTool(server, 'publish_players', {})
    expect(http.calls[0].path).toBe('/v1/players/publish')
  })
})

describe('list_playlists', () => {
  it('GETs /v1/playlists', async () => {
    responder = vi.fn(() => ({ data: [], next_cursor: null }))
    http = new HarnessHttp((c) => responder(c))
    server = new McpServer({ name: 'test', version: '0.0.0' })
    registerPlayerTools(server, http as unknown as HttpClient)
    await callTool(server, 'list_playlists', {})
    expect(http.calls[0].path).toBe('/v1/playlists')
  })
})
