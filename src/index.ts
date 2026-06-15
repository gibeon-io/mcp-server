import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { HttpClient } from './http.js'
import { registerPlayerTools } from './tools/players.js'
import { registerPlaylistTools } from './tools/playlists.js'

const PACKAGE_VERSION = '0.2.1'

export async function start(): Promise<void> {
  const config = loadConfig()
  const http = new HttpClient(config)

  const server = new McpServer({
    name: 'gibeon-mcp',
    version: PACKAGE_VERSION,
  })

  registerPlayerTools(server, http)
  registerPlaylistTools(server, http)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Auto-start when invoked as a script (bin/gibeon-mcp.js imports this file
// and dynamic-imports trigger this branch). Skipped in tests where the
// module is imported for unit-level assertions.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('gibeon-mcp.js') ||
    process.argv[1].endsWith('mcp-server/dist/index.js') ||
    process.argv[1].endsWith('mcp-server/src/index.ts'))

if (isMain) {
  start().catch((err) => {
    process.stderr.write(`[gibeon-mcp] fatal: ${(err as Error).message}\n`)
    process.exit(1)
  })
}
