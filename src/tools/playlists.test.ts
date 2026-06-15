import { describe, it, expect, beforeEach, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerPlaylistTools } from './playlists.js'
import type { HttpClient } from '../http.js'

class HarnessHttp {
  public calls: Array<{ path: string; opts?: Record<string, unknown> }> = []
  constructor(private readonly responder: (call: { path: string; opts?: Record<string, unknown> }) => unknown) {}
  async request(path: string, opts?: Record<string, unknown>): Promise<unknown> {
    const call = { path, opts }
    this.calls.push(call)
    return this.responder(call)
  }
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>) {
  const reg = (server as unknown as { _registeredTools: Record<string, { handler: (a: unknown) => Promise<unknown> }> })
    ._registeredTools
  const entry = reg[name]
  if (!entry) throw new Error(`tool ${name} not registered`)
  return entry.handler(args)
}

let server: McpServer
let http: HarnessHttp
let responder: (call: { path: string; opts?: Record<string, unknown> }) => unknown

function setup(r: typeof responder) {
  responder = r
  http = new HarnessHttp((c) => responder(c))
  server = new McpServer({ name: 'test', version: '0.0.0' })
  registerPlaylistTools(server, http as unknown as HttpClient)
}

beforeEach(() => {
  setup(vi.fn(() => ({ data: {} })))
})

const PL = '123e4567-e89b-12d3-a456-426614174000'
const ITEM = '223e4567-e89b-12d3-a456-426614174001'
const ASSET = '323e4567-e89b-12d3-a456-426614174002'

describe('get_playlist', () => {
  it('passes include=items when include_items=true', async () => {
    setup(vi.fn(() => ({ data: { id: PL, items: [] } })))
    await callTool(server, 'get_playlist', { playlist_id: PL, include_items: true })
    expect(http.calls[0].path).toBe(`/v1/playlists/${PL}`)
    expect(http.calls[0].opts).toMatchObject({ query: { include: 'items' } })
  })

  it('omits include when include_items is false', async () => {
    setup(vi.fn(() => ({ data: { id: PL } })))
    await callTool(server, 'get_playlist', { playlist_id: PL })
    expect(http.calls[0].opts).toMatchObject({ query: undefined })
  })
})

describe('create_playlist', () => {
  it('POSTs to /v1/playlists', async () => {
    setup(vi.fn(() => ({ data: { id: PL, name: 'New' } })))
    await callTool(server, 'create_playlist', { name: 'New', default_interval: 7 })
    expect(http.calls[0].path).toBe('/v1/playlists')
    expect(http.calls[0].opts).toMatchObject({ method: 'POST', body: { name: 'New', default_interval: 7 } })
  })
})

describe('update_playlist', () => {
  it('PATCHes with patch fields (no playlist_id in body)', async () => {
    setup(vi.fn(() => ({ data: { id: PL } })))
    await callTool(server, 'update_playlist', { playlist_id: PL, name: 'Renamed' })
    expect(http.calls[0].path).toBe(`/v1/playlists/${PL}`)
    expect(http.calls[0].opts).toMatchObject({ method: 'PATCH', body: { name: 'Renamed' } })
  })
})

describe('delete_playlist', () => {
  it('DELETEs and returns deleted=true text', async () => {
    setup(vi.fn(() => undefined))
    const res = await callTool(server, 'delete_playlist', { playlist_id: PL })
    expect(http.calls[0].opts).toMatchObject({ method: 'DELETE' })
    const text = (res as { content: Array<{ text: string }> }).content[0].text
    expect(JSON.parse(text)).toEqual({ data: { deleted: true, playlist_id: PL } })
  })
})

describe('add_playlist_item', () => {
  it('POSTs to /:id/items with image asset_id', async () => {
    setup(vi.fn(() => ({ data: { id: ITEM, type: 'image' } })))
    await callTool(server, 'add_playlist_item', {
      playlist_id: PL,
      type: 'image',
      asset_id: ASSET,
      duration_seconds: 5,
    })
    expect(http.calls[0].path).toBe(`/v1/playlists/${PL}/items`)
    expect(http.calls[0].opts).toMatchObject({
      method: 'POST',
      body: { type: 'image', asset_id: ASSET, duration_seconds: 5 },
    })
  })

  it('rejects bad type via zod', async () => {
    setup(vi.fn(() => ({ data: {} })))
    await expect(
      callTool(server, 'add_playlist_item', { playlist_id: PL, type: 'gif' }),
    ).rejects.toBeTruthy()
  })
})

describe('update_playlist_item', () => {
  it('PATCHes /:id/items/:item_id', async () => {
    setup(vi.fn(() => ({ data: { id: ITEM } })))
    await callTool(server, 'update_playlist_item', {
      playlist_id: PL,
      item_id: ITEM,
      duration_seconds: 12,
    })
    expect(http.calls[0].path).toBe(`/v1/playlists/${PL}/items/${ITEM}`)
    expect(http.calls[0].opts).toMatchObject({ method: 'PATCH', body: { duration_seconds: 12 } })
  })
})

describe('delete_playlist_item', () => {
  it('DELETEs the item and returns text confirmation', async () => {
    setup(vi.fn(() => undefined))
    const res = await callTool(server, 'delete_playlist_item', { playlist_id: PL, item_id: ITEM })
    expect(http.calls[0].path).toBe(`/v1/playlists/${PL}/items/${ITEM}`)
    expect(http.calls[0].opts).toMatchObject({ method: 'DELETE' })
    const text = (res as { content: Array<{ text: string }> }).content[0].text
    expect(JSON.parse(text)).toEqual({ data: { deleted: true, item_id: ITEM } })
  })
})

describe('reorder_playlist_items', () => {
  it('PUTs to /:id/items/reorder with item_ids', async () => {
    setup(vi.fn(() => ({ data: { item_ids: [ITEM] } })))
    await callTool(server, 'reorder_playlist_items', { playlist_id: PL, item_ids: [ITEM] })
    expect(http.calls[0].path).toBe(`/v1/playlists/${PL}/items/reorder`)
    expect(http.calls[0].opts).toMatchObject({ method: 'PUT', body: { item_ids: [ITEM] } })
  })

  it('rejects empty item_ids via zod min(1)', async () => {
    setup(vi.fn(() => ({ data: {} })))
    await expect(
      callTool(server, 'reorder_playlist_items', { playlist_id: PL, item_ids: [] }),
    ).rejects.toBeTruthy()
  })
})
