#!/usr/bin/env node
import('../dist/index.js').catch((err) => {
  console.error('[gibeon-mcp] failed to start:', err)
  process.exit(1)
})
