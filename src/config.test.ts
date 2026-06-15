import { describe, it, expect } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('reads valid key + defaults', () => {
    const cfg = loadConfig({ GIBEON_API_KEY: 'gib_live_abc' } as NodeJS.ProcessEnv)
    expect(cfg.apiKey).toBe('gib_live_abc')
    expect(cfg.apiUrl).toBe('https://api.gibeon.io')
    expect(cfg.timeoutMs).toBe(15000)
  })

  it('strips trailing slash from custom URL', () => {
    const cfg = loadConfig({
      GIBEON_API_KEY: 'gib_test_x',
      GIBEON_API_URL: 'https://staging.example.com/',
    } as NodeJS.ProcessEnv)
    expect(cfg.apiUrl).toBe('https://staging.example.com')
  })

  it('returns empty apiKey when env is missing (validation deferred to request time)', () => {
    const cfg = loadConfig({} as NodeJS.ProcessEnv)
    expect(cfg.apiKey).toBe('')
    expect(cfg.apiUrl).toBe('https://api.gibeon.io')
  })

  it('returns the raw apiKey even when prefix is wrong (validation deferred to request time)', () => {
    const cfg = loadConfig({ GIBEON_API_KEY: 'sk-foo' } as NodeJS.ProcessEnv)
    expect(cfg.apiKey).toBe('sk-foo')
  })

  it('rejects non-numeric timeout', () => {
    expect(() =>
      loadConfig({ GIBEON_API_KEY: 'gib_x', GIBEON_API_TIMEOUT_MS: 'abc' } as NodeJS.ProcessEnv),
    ).toThrow(/positive number/)
  })
})
