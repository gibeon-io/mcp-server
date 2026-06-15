import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function asText(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  }
}

// MCP SDK v1.x's ToolCallback infers args via mapped types over the raw zod
// shape; with >2 optional fields TypeScript bails with TS2589 (excessive
// depth). Wrapping registration in this thin helper erases the depth while
// still validating args via z.object().parse() at runtime.
type RawShape = Record<string, z.ZodTypeAny>

export function defineTool<S extends RawShape>(
  server: McpServer,
  name: string,
  config: { title?: string; description: string; inputSchema: S },
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
) {
  const parser = z.object(config.inputSchema)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(server.registerTool as any)(
    name,
    { title: config.title, description: config.description, inputSchema: config.inputSchema },
    async (raw: unknown) => {
      const parsed = parser.parse(raw ?? {}) as z.infer<z.ZodObject<S>>
      return handler(parsed)
    },
  )
}
