// Response shapes the worker emits today. Kept narrow on purpose — we only
// surface what an LLM caller usefully needs, not every internal column.

export interface Player {
  id: string
  name: string
  status: 'online' | 'offline'
  last_seen_at: string | null
  playlist_id: string | null
  sequence_id: string | null
  planning_id: string | null
  group_id: string | null
  orientation: 'landscape' | 'portrait' | 'portrait-reverse'
  created_at: string
  updated_at: string
}

export interface Playlist {
  id: string
  name: string
  default_interval: number | null
  image_uri: string | null
  created_at: string
  updated_at: string
}

export interface ContentItem {
  id: string
  playlist_id: string
  type: 'image' | 'video' | 'image_slideshow' | 'youtube' | string
  name: string | null
  duration_seconds: number | null
  sort_order: number
  is_selected: boolean
  schedule_start: string | null
  schedule_end: string | null
  asset_id: string | null
  external_url: string | null
  config: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface PlaylistWithItems extends Playlist {
  items: ContentItem[]
}

export interface ReorderResult {
  data: { item_ids: string[] }
}

export interface ListResponse<T> {
  data: T[]
  next_cursor: string | null
}

export interface SingleResponse<T> {
  data: T
}

export interface PatchPlayerResponse {
  data: Player
  publish_required: boolean
}

export interface PublishOneResult {
  data: { player_id: string; snapshot_id: string }
}

export interface PublishAllResult {
  data: {
    published: Array<{ player_id: string; snapshot_id: string }>
    skipped: Array<{ player_id: string; reason: string }>
    failed: Array<{ player_id: string; error: string }>
  }
}
