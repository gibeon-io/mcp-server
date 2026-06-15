# @gibeon/mcp-server

> **Deprecated. Use the hosted MCP at `https://api.gibeon.io/mcp` instead.**
>
> This stdio package authenticated with `gib_live_` API keys, which Gibeon has
> removed: the public API is now OAuth-only. The package no longer works as
> documented and is unmaintained. The hosted MCP runs the same tools,
> authorizes via OAuth automatically, needs no install, and updates instantly.

MCP server for the [Gibeon](https://www.gibeon.io) digital signage platform.
Control your players, manage playlists, and trigger publishes from Claude
Desktop, Cursor, Claude Code, or any other MCP-aware client.

## Hosted MCP (use this)

```json
{
  "mcpServers": {
    "gibeon": {
      "url": "https://api.gibeon.io/mcp"
    }
  }
}
```

No token goes in the config. The client authorizes itself via OAuth on first
connect: it discovers the auth requirements from the server, registers, and
you approve access on the Gibeon consent screen (where you pick the tenant).
Works in Claude Desktop, Claude Code, and Cursor. Full flow:
<https://www.gibeon.io/auth.md>.

## Tools (13 total)

### Players + publish

| Tool              | What it does                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| `list_players`    | List the screens in your tenant, optionally filtered by status/group.     |
| `get_player`      | Fetch one player by id.                                                   |
| `update_player`   | Rename, reassign content, change orientation. Returns `publish_required`. |
| `publish_players` | Build a fresh snapshot for one player or every player in the tenant.      |

### Playlists + items

| Tool                     | What it does                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `list_playlists`         | List the playlists in your tenant.                                          |
| `get_playlist`           | Fetch one playlist, optionally with its content items inline.               |
| `create_playlist`        | Create a new empty playlist.                                                |
| `update_playlist`        | Rename, change default interval, swap cover image.                          |
| `delete_playlist`        | Permanently delete a playlist and its items.                                |
| `add_playlist_item`      | Append an image / video / image slideshow / YouTube embed to a playlist.    |
| `update_playlist_item`   | Patch an existing item's name / duration / schedule / asset / config.       |
| `delete_playlist_item`   | Remove a single item from a playlist.                                       |
| `reorder_playlist_items` | Set the full playback order in one call.                                    |

## Example prompts

> *"How many players are online in my Gibeon tenant?"*
> → calls `list_players` with `status: "online"`.

> *"Create a playlist called Lobby Morning, add the welcome image, then point screen 7f3a… at it and republish."*
> → `create_playlist` + `add_playlist_item` + `update_player` + `publish_players`.

## Links

- **Docs:** <https://www.gibeon.io/dev>
- **Auth:** <https://www.gibeon.io/auth.md>

## License

MIT
