import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { asText, defineTool } from './_helpers.js'
import type { HttpClient } from '../http.js'
import type {
  ContentItem,
  Playlist,
  PlaylistWithItems,
  ReorderResult,
  SingleResponse,
} from '../types.js'

const TimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'must be HH:MM or HH:MM:SS')

export function registerPlaylistTools(server: McpServer, http: HttpClient): void {
  defineTool(
    server,
    'get_playlist',
    {
      title: 'Get playlist',
      description: `Fetch a single playlist by id, optionally with its content items inline.

When to use:
- The user wants to inspect what's actually queued on a playlist.
- You need the item ids before reordering or patching items.

When NOT to use:
- For just the name/id — list_playlists is one round-trip.

What to know:
- include_items=true returns the playlist with its items array; otherwise only the playlist row.
- Item shape depends on type (image/video/image_slideshow/youtube). Inspect type before assuming asset_id vs external_url vs config.`,
      inputSchema: {
        playlist_id: z.string().uuid(),
        include_items: z.boolean().optional().describe('Inline the playlist items in the response'),
      },
    },
    async ({ playlist_id, include_items }) => {
      const res = await http.request<SingleResponse<Playlist | PlaylistWithItems>>(
        `/v1/playlists/${playlist_id}`,
        { query: include_items ? { include: 'items' } : undefined },
      )
      return asText(res)
    },
  )

  defineTool(
    server,
    'create_playlist',
    {
      title: 'Create playlist',
      description: `Create a new empty playlist in the calling tenant.

When to use:
- Bootstrapping content for a player, or splitting an existing playlist.

When NOT to use:
- A playlist with that name might already exist — list_playlists first if reuse is acceptable.

What to know:
- Only name is required. default_interval (seconds) and image_uri (cover-art URL) are optional and can be added later via update_playlist.
- The playlist starts empty; use add_playlist_item to fill it.`,
      inputSchema: {
        name: z.string().min(1),
        default_interval: z.number().int().min(1).optional().describe('Default item duration in seconds'),
        image_uri: z.string().nullable().optional().describe('Cover image URL'),
      },
    },
    async (args) => {
      const res = await http.request<SingleResponse<Playlist>>('/v1/playlists', {
        method: 'POST',
        body: args,
      })
      return asText(res)
    },
  )

  defineTool(
    server,
    'update_playlist',
    {
      title: 'Update playlist',
      description: `Patch a playlist's metadata.

When to use:
- Renaming a playlist, changing its default item duration, or swapping the cover image.

When NOT to use:
- For changing items — use add_playlist_item / update_playlist_item / delete_playlist_item.

What to know:
- Only name, default_interval, image_uri are mutable here. Pass image_uri: null to clear the cover.
- Updating a playlist does NOT trigger a publish on its own; a player assigned to this playlist still needs publish_players to pick up the new items list.`,
      inputSchema: {
        playlist_id: z.string().uuid(),
        name: z.string().min(1).optional(),
        default_interval: z.number().int().min(1).optional(),
        image_uri: z.string().nullable().optional(),
      },
    },
    async ({ playlist_id, ...patch }) => {
      const res = await http.request<SingleResponse<Playlist>>(`/v1/playlists/${playlist_id}`, {
        method: 'PATCH',
        body: patch,
      })
      return asText(res)
    },
  )

  defineTool(
    server,
    'delete_playlist',
    {
      title: 'Delete playlist',
      description: `Permanently delete a playlist and all its items.

When to use:
- The playlist is no longer used by any player and you want to free up the name.

When NOT to use:
- A player still references this playlist — unassign it first via update_player (set playlist_id: null), otherwise the player will lose its content on next publish.
- You only want to clear items but keep the playlist — delete the items individually.

What to know:
- Irreversible. Cascade-deletes the playlist's content_items.
- Returns 204 on success.`,
      inputSchema: { playlist_id: z.string().uuid() },
    },
    async ({ playlist_id }) => {
      await http.request<void>(`/v1/playlists/${playlist_id}`, { method: 'DELETE' })
      return asText({ data: { deleted: true, playlist_id } })
    },
  )

  defineTool(
    server,
    'add_playlist_item',
    {
      title: 'Add item to playlist',
      description: `Append a content item to a playlist.

When to use:
- Adding an image, video, YouTube embed, or image slideshow to an existing playlist.

When NOT to use:
- For images/videos: the asset must already exist (status='ready'). Use the asset upload flow first.

What to know:
- type drives the rest of the payload:
  - image / video → asset_id (UUID, already-uploaded asset)
  - youtube       → external_url (a youtube.com or youtu.be link)
  - image_slideshow → config.asset_ids[] (1+ already-uploaded image UUIDs) plus optional image_duration / transition_speed / fit / bg_color / randomize
- duration_seconds overrides the playlist's default_interval for this item.
- schedule_start / schedule_end (HH:MM or HH:MM:SS) constrain the item to a time window.
- The item is appended at the end; use reorder_playlist_items to change order.`,
      inputSchema: {
        playlist_id: z.string().uuid(),
        type: z.enum(['image', 'video', 'image_slideshow', 'youtube']),
        name: z.string().nullable().optional(),
        duration_seconds: z.number().int().min(0).optional(),
        is_selected: z.boolean().optional(),
        schedule_start: TimeStringSchema.nullable().optional(),
        schedule_end: TimeStringSchema.nullable().optional(),
        asset_id: z.string().uuid().optional().describe('For image/video items'),
        external_url: z.string().url().optional().describe('For youtube items'),
        config: z
          .object({
            asset_ids: z.array(z.string().uuid()).min(1).optional(),
            image_duration: z.number().int().min(1).optional(),
            transition_speed: z.number().int().min(0).optional(),
            fit: z.enum(['contain', 'cover']).optional(),
            bg_color: z.string().optional(),
            randomize: z.boolean().optional(),
          })
          .optional()
          .describe('For image_slideshow items'),
      },
    },
    async ({ playlist_id, ...body }) => {
      const res = await http.request<SingleResponse<ContentItem>>(`/v1/playlists/${playlist_id}/items`, {
        method: 'POST',
        body,
      })
      return asText(res)
    },
  )

  defineTool(
    server,
    'update_playlist_item',
    {
      title: 'Update playlist item',
      description: `Patch an existing content item.

When to use:
- Renaming an item, adjusting duration_seconds, changing a schedule window, swapping the asset on an image/video item.

When NOT to use:
- For changing type — delete the item and add a new one (type drives a different validation surface).
- For reordering — use reorder_playlist_items.

What to know:
- Only the provided fields are touched. Pass null on nullable fields to clear them.
- Mutable: name, duration_seconds, is_selected, schedule_start, schedule_end, asset_id, external_url, config.`,
      inputSchema: {
        playlist_id: z.string().uuid(),
        item_id: z.string().uuid(),
        name: z.string().nullable().optional(),
        duration_seconds: z.number().int().min(0).optional(),
        is_selected: z.boolean().optional(),
        schedule_start: TimeStringSchema.nullable().optional(),
        schedule_end: TimeStringSchema.nullable().optional(),
        asset_id: z.string().uuid().optional(),
        external_url: z.string().url().optional(),
        config: z.record(z.unknown()).optional(),
      },
    },
    async ({ playlist_id, item_id, ...patch }) => {
      const res = await http.request<SingleResponse<ContentItem>>(
        `/v1/playlists/${playlist_id}/items/${item_id}`,
        { method: 'PATCH', body: patch },
      )
      return asText(res)
    },
  )

  defineTool(
    server,
    'delete_playlist_item',
    {
      title: 'Delete playlist item',
      description: `Remove an item from a playlist.

When to use:
- Pruning content that's no longer relevant.

When NOT to use:
- You want to keep the item but skip it for now — set is_selected: false via update_playlist_item instead.

What to know:
- Irreversible. The remaining items stay in order; gaps in sort_order are normalised on the server.
- The asset itself is NOT deleted (other playlists may reference it).`,
      inputSchema: {
        playlist_id: z.string().uuid(),
        item_id: z.string().uuid(),
      },
    },
    async ({ playlist_id, item_id }) => {
      await http.request<void>(`/v1/playlists/${playlist_id}/items/${item_id}`, { method: 'DELETE' })
      return asText({ data: { deleted: true, item_id } })
    },
  )

  defineTool(
    server,
    'reorder_playlist_items',
    {
      title: 'Reorder playlist items',
      description: `Set the playback order of a playlist's items in one call.

When to use:
- The user wants to promote/demote a few items, or apply a freshly-computed order.

When NOT to use:
- You only want to move one item by one position — same call still works, but reading + emitting the full list is the cost.

What to know:
- item_ids MUST contain every current item of the playlist, in the desired final order.
- A missing or extra id returns 422 with reorder_mismatch.
- Server uses a two-phase update (negative offset then final) to avoid UNIQUE(parent_id, sort_order) conflicts mid-flight.`,
      inputSchema: {
        playlist_id: z.string().uuid(),
        item_ids: z
          .array(z.string().uuid())
          .min(1)
          .describe('All current item ids of the playlist, in the desired final order'),
      },
    },
    async ({ playlist_id, item_ids }) => {
      const res = await http.request<ReorderResult>(`/v1/playlists/${playlist_id}/items/reorder`, {
        method: 'PUT',
        body: { item_ids },
      })
      return asText(res)
    },
  )
}
