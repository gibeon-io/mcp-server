import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { asText, defineTool } from './_helpers.js'
import type { HttpClient } from '../http.js'
import type {
  ListResponse,
  Player,
  Playlist,
  PatchPlayerResponse,
  PublishOneResult,
  PublishAllResult,
  SingleResponse,
} from '../types.js'

export function registerPlayerTools(server: McpServer, http: HttpClient): void {
  defineTool(
    server,
    'list_players',
    {
      title: 'List players',
      description: `List the digital-signage players (screens) in the calling tenant.

When to use:
- You need to discover which players exist before reading or changing them.
- The user asks "how many screens are online?" or wants an overview.

When NOT to use:
- You already know a specific player_id — call get_player instead, it's cheaper.

What to know:
- Optional filters: status ("online" | "offline"), group_id (UUID).
- Returns up to 25 players per call; pagination is not yet exposed in MVP.
- "online" means a heartbeat arrived within the last 90 seconds.`,
      inputSchema: {
        status: z.enum(['online', 'offline']).optional().describe('Filter by reachability'),
        group_id: z.string().uuid().optional().describe('Filter by player group UUID'),
      },
    },
    async ({ status, group_id }) => {
      const res = await http.request<ListResponse<Player>>('/v1/players', {
        query: { status, group_id },
      })
      return asText(res)
    },
  )

  defineTool(
    server,
    'get_player',
    {
      title: 'Get player',
      description: `Fetch a single player by id.

When to use:
- You have a player_id and need its current state, assigned content, or last-seen timestamp.

When NOT to use:
- You only have the player's name — list_players first to resolve the id.

What to know:
- Returns the same shape as list_players' data items.
- 404 if the id does not exist in the calling tenant — never cross-tenant.`,
      inputSchema: {
        player_id: z.string().uuid().describe('UUID of the player'),
      },
    },
    async ({ player_id }) => {
      const res = await http.request<SingleResponse<Player>>(`/v1/players/${player_id}`)
      return asText(res)
    },
  )

  defineTool(
    server,
    'update_player',
    {
      title: 'Update player',
      description: `Patch mutable fields on a single player.

When to use:
- The user wants to rename a player, change its orientation, or reassign content.

When NOT to use:
- For content authoring — playlists, sequences, and planning have their own dedicated tools (coming in v0.2.0).

What to know:
- Mutable fields: name, orientation ("landscape" | "portrait" | "portrait-reverse"), playlist_id, sequence_id, planning_id, group_id.
- Assigning a *_id schedules a publish — the response includes publish_required: true. Call publish_players to make the player actually pick up the change.
- Pass null to clear an assignment (e.g. playlist_id: null).
- Exactly one of playlist_id / sequence_id / planning_id may be non-null at a time.`,
      inputSchema: {
        player_id: z.string().uuid(),
        name: z.string().min(1).optional(),
        orientation: z.enum(['landscape', 'portrait', 'portrait-reverse']).optional(),
        playlist_id: z.string().uuid().nullable().optional(),
        sequence_id: z.string().uuid().nullable().optional(),
        planning_id: z.string().uuid().nullable().optional(),
        group_id: z.string().uuid().nullable().optional(),
      },
    },
    async ({ player_id, ...patch }) => {
      const res = await http.request<PatchPlayerResponse>(`/v1/players/${player_id}`, {
        method: 'PATCH',
        body: patch,
      })
      return asText(res)
    },
  )

  defineTool(
    server,
    'publish_players',
    {
      title: 'Publish players',
      description: `Build a fresh content snapshot so one or every player picks up its current content assignment.

When to use:
- update_player returned publish_required: true.
- The user changed a playlist's items elsewhere and asks to make screens reflect it.

When NOT to use:
- For a single field-only rename — that takes effect immediately without publish.

What to know:
- Omit player_id to publish every player in the tenant. Per-player failures are returned in "failed" without aborting the batch.
- Players with no playlist/sequence/planning assigned are listed under "skipped" with reason "no_content_assigned".
- Snapshots are durable; the player pulls them on its next heartbeat (typically within 10 seconds).`,
      inputSchema: {
        player_id: z.string().uuid().optional().describe('Specific player to publish; omit to publish every player'),
      },
    },
    async ({ player_id }) => {
      if (player_id) {
        const res = await http.request<PublishOneResult>(`/v1/players/${player_id}/publish`, {
          method: 'POST',
        })
        return asText(res)
      }
      const res = await http.request<PublishAllResult>('/v1/players/publish', { method: 'POST' })
      return asText(res)
    },
  )

  defineTool(
    server,
    'list_playlists',
    {
      title: 'List playlists',
      description: `List the playlists in the calling tenant.

When to use:
- You need to surface playlist names and ids before assigning one to a player via update_player.

When NOT to use:
- For inspecting the items inside a playlist — get_playlist (v0.2.0) returns the playlist with its items inline.

What to know:
- Returns id, name, and timestamps. Item-level CRUD lands in v0.2.0 of this MCP server.`,
      inputSchema: {},
    },
    async () => {
      const res = await http.request<ListResponse<Playlist>>('/v1/playlists')
      return asText(res)
    },
  )
}
