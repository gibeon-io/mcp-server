# @gibeon/mcp-server — stdio MCP server for the Gibeon digital signage platform.
#
# Used by registries (Glama, etc.) and by anyone who wants to run the stdio
# variant via Docker instead of `npx`. The server boots without GIBEON_API_KEY
# so introspection calls (`tools/list`) succeed — the first `tools/call` that
# actually hits the API fails with a clear "set GIBEON_API_KEY" message.
#
# Build:  docker build -t gibeon-mcp-server packages/mcp-server
# Run:    docker run --rm -i -e GIBEON_API_KEY=gib_live_... gibeon-mcp-server
#
# Note: the server speaks JSON-RPC 2.0 over stdin/stdout. `-i` keeps stdin
# attached; the MCP host pipes requests in and reads responses out.

FROM node:20-alpine AS build
WORKDIR /app

# Manifest first for layer-cache reuse on src-only changes.
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Runtime-only deps (no devDeps like tsup/vitest/typescript).
COPY package.json ./
RUN npm install --omit=dev --omit=optional --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY bin ./bin

ENV NODE_ENV=production

# Health: server boots immediately and waits on stdin for MCP requests. No
# HTTP port to probe — Docker treats the process as healthy as long as the
# entrypoint stays running.
ENTRYPOINT ["node", "bin/gibeon-mcp.js"]
