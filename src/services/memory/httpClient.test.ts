import { describe, expect, it, vi } from 'vitest'
import {
  KaeMemoryClientError,
  KaeMemoryClientUnsupportedError,
  KaeMemoryHttpClient,
} from './httpClient'

const project = {
  id: 'PRJ-1',
  name: 'Ministry Reporting',
  phase: 'Discovery',
  memoryRevision: 7,
  createdAt: '2026-08-05T00:00:00.000Z',
}

const message = {
  id: 'MSG-1',
  author: 'user',
  body: 'Only leaders may submit reports.',
  createdAt: '2026-08-05T00:01:00.000Z',
  syncState: 'acknowledged',
}

describe('KaeMemoryHttpClient', () => {
  it('lists projects from the versioned Memory API', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([String(input), init])
      return jsonResponse({ projects: [project] })
    }
    const client = new KaeMemoryHttpClient({ baseUrl: 'https://memory.example.test/', fetchImpl })

    await expect(client.listProjects()).resolves.toEqual([project])
    expect(calls[0]?.[0]).toBe('https://memory.example.test/v1/projects')
    expect(calls[0]?.[1]?.headers).toBeInstanceOf(Headers)
  })

  it('submits messages with an idempotency key and bearer token', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([String(input), init])
      return jsonResponse({ message, result: { accepted: true, memoryRevision: 8 } })
    }
    const client = new KaeMemoryHttpClient({
      baseUrl: 'https://memory.example.test',
      fetchImpl,
      token: 'secret-token',
    })

    await expect(
      client.submitMessage('PRJ-1', 'Only leaders may submit reports.', 'studio-message-1'),
    ).resolves.toEqual({ message, result: { accepted: true, memoryRevision: 8 } })

    const [, init] = calls[0] ?? []
    const headers = init?.headers as Headers
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ body: 'Only leaders may submit reports.' }))
    expect(headers.get('Idempotency-Key')).toBe('studio-message-1')
    expect(headers.get('Authorization')).toBe('Bearer secret-token')
  })

  it('maps Memory error payloads to safe client errors', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ code: 'unauthorized', message: 'No access' }, 403),
    )
    const client = new KaeMemoryHttpClient({ baseUrl: 'https://memory.example.test', fetchImpl })

    await expect(client.getProject('PRJ-1')).rejects.toMatchObject({
      name: 'KaeMemoryClientError',
      message: 'No access',
      status: 403,
      code: 'unauthorized',
    })
  })

  it('fails fast when Memory returns an unexpected shape', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ projects: [{ ...project, memoryRevision: '7' }] }),
    )
    const client = new KaeMemoryHttpClient({ baseUrl: 'https://memory.example.test', fetchImpl })

    await expect(client.listProjects()).rejects.toBeInstanceOf(KaeMemoryClientError)
  })

  it('keeps unfrozen prototype operations explicitly unsupported', async () => {
    const client = new KaeMemoryHttpClient({
      baseUrl: 'https://memory.example.test',
      fetchImpl: vi.fn(),
    })

    await expect(
      client.recordModuleDecision('PRJ-1', 'MOD-APR', { kind: 'accept' }),
    ).rejects.toBeInstanceOf(KaeMemoryClientUnsupportedError)
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
