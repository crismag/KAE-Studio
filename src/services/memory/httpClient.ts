import type { ConversationMessage, InterviewSession, Project } from '@/domain/types'
import type { MemoryWriteResult, ModuleDecision, ProjectMemoryClient } from '@/services/interfaces'

type Fetch = typeof fetch

export interface KaeMemoryHttpClientOptions {
  baseUrl: string
  apiVersion?: string
  fetchImpl?: Fetch
  token?: string
}

export class KaeMemoryClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'KaeMemoryClientError'
  }
}

export class KaeMemoryClientUnsupportedError extends KaeMemoryClientError {
  constructor(operation: string) {
    super(`${operation} is not part of the frozen first Studio HTTP slice yet.`, 501, 'unsupported')
    this.name = 'KaeMemoryClientUnsupportedError'
  }
}

/**
 * First-slice HTTP implementation of the Memory client boundary.
 *
 * Keep this client deliberately small: unsupported prototype operations should
 * fail explicitly rather than reintroducing mock-only semantics in production.
 */
export class KaeMemoryHttpClient implements ProjectMemoryClient {
  private readonly baseUrl: string
  private readonly apiVersion: string
  private readonly fetchImpl: Fetch
  private readonly token?: string

  constructor(options: KaeMemoryHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiVersion = options.apiVersion ?? 'v1'
    this.fetchImpl = options.fetchImpl ?? fetch
    this.token = options.token
  }

  async listProjects(): Promise<Project[]> {
    const json = await this.request('projects')
    const projects = readArray(json, 'projects')
    return projects.map(readProject)
  }

  async getProject(projectId: string): Promise<Project> {
    return readProject(await this.request(`projects/${encodeURIComponent(projectId)}`))
  }

  async listMessages(projectId: string): Promise<ConversationMessage[]> {
    const json = await this.request(`projects/${encodeURIComponent(projectId)}/messages`)
    const messages = readArray(json, 'messages')
    return messages.map(readConversationMessage)
  }

  async submitMessage(
    projectId: string,
    body: string,
    idempotencyKey: string,
  ): Promise<{ message: ConversationMessage; result: MemoryWriteResult }> {
    const json = await this.request(`projects/${encodeURIComponent(projectId)}/messages`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ body }),
    })

    const object = readObject(json)
    return {
      message: readConversationMessage(object.message),
      result: readMemoryWriteResult(object.result),
    }
  }

  async getInterviewSession(projectId: string): Promise<InterviewSession> {
    return readInterviewSession(
      await this.request(`projects/${encodeURIComponent(projectId)}/interview-session`),
    )
  }

  async recordModuleDecision(
    _projectId: string,
    _moduleId: string,
    _decision: ModuleDecision,
  ): Promise<MemoryWriteResult> {
    throw new KaeMemoryClientUnsupportedError('recordModuleDecision')
  }

  async deferDecision(
    _projectId: string,
    _decisionId: string,
    _deferred: boolean,
  ): Promise<MemoryWriteResult> {
    throw new KaeMemoryClientUnsupportedError('deferDecision')
  }

  async confirmFinding(_projectId: string, _findingId: string): Promise<MemoryWriteResult> {
    throw new KaeMemoryClientUnsupportedError('confirmFinding')
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }

    const response = await this.fetchImpl(`${this.baseUrl}/${this.apiVersion}/${path}`, {
      ...init,
      headers,
    })

    const json = await readJson(response)

    if (!response.ok) {
      const body = readObject(json)
      const message = typeof body.message === 'string' ? body.message : response.statusText
      const code = typeof body.code === 'string' ? body.code : undefined
      throw new KaeMemoryClientError(message, response.status, code)
    }

    return json
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    throw new KaeMemoryClientError(
      'KAE-Memory returned invalid JSON.',
      response.status,
      'invalid_json',
    )
  }
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  throw new KaeMemoryClientError('KAE-Memory response shape did not match the Studio contract.')
}

function readArray(value: unknown, key: string): unknown[] {
  const object = readObject(value)
  const array = object[key]

  if (Array.isArray(array)) return array

  throw new KaeMemoryClientError(`KAE-Memory response is missing array field '${key}'.`)
}

function readString(object: Record<string, unknown>, key: string): string {
  const value = object[key]
  if (typeof value === 'string') return value
  throw new KaeMemoryClientError(`KAE-Memory response is missing string field '${key}'.`)
}

function readNumber(object: Record<string, unknown>, key: string): number {
  const value = object[key]
  if (typeof value === 'number') return value
  throw new KaeMemoryClientError(`KAE-Memory response is missing number field '${key}'.`)
}

function readBoolean(object: Record<string, unknown>, key: string): boolean {
  const value = object[key]
  if (typeof value === 'boolean') return value
  throw new KaeMemoryClientError(`KAE-Memory response is missing boolean field '${key}'.`)
}

function readStringArray(object: Record<string, unknown>, key: string): string[] | undefined {
  const value = object[key]
  if (value === undefined) return undefined
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  throw new KaeMemoryClientError(`KAE-Memory response field '${key}' must be a string array.`)
}

function readProject(value: unknown): Project {
  const object = readObject(value)
  return {
    id: readString(object, 'id'),
    name: readString(object, 'name'),
    phase: readString(object, 'phase'),
    memoryRevision: readNumber(object, 'memoryRevision'),
    createdAt: readString(object, 'createdAt'),
  }
}

function readConversationMessage(value: unknown): ConversationMessage {
  const object = readObject(value)
  const author = readString(object, 'author')
  const syncState = readString(object, 'syncState')

  if (author !== 'user' && author !== 'assistant') {
    throw new KaeMemoryClientError(`Unsupported message author '${author}'.`)
  }

  if (syncState !== 'acknowledged' && syncState !== 'pending' && syncState !== 'failed') {
    throw new KaeMemoryClientError(`Unsupported message sync state '${syncState}'.`)
  }

  return {
    id: readString(object, 'id'),
    author,
    body: readString(object, 'body'),
    createdAt: readString(object, 'createdAt'),
    syncState,
    question: optionalString(object, 'question'),
    suggestions: readStringArray(object, 'suggestions'),
    resultingChanges: readStringArray(object, 'resultingChanges'),
  }
}

function readInterviewSession(value: unknown): InterviewSession {
  const object = readObject(value)
  return {
    interviewType: readString(object, 'interviewType'),
    objective: readString(object, 'objective'),
    questionsAsked: readNumber(object, 'questionsAsked'),
    questionsAnswered: readNumber(object, 'questionsAnswered'),
    questionsDeferred: readNumber(object, 'questionsDeferred'),
  }
}

function readMemoryWriteResult(value: unknown): MemoryWriteResult {
  const object = readObject(value)
  return {
    accepted: readBoolean(object, 'accepted'),
    memoryRevision: readNumber(object, 'memoryRevision'),
    pendingReason: optionalString(object, 'pendingReason'),
  }
}

function optionalString(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key]
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  throw new KaeMemoryClientError(`KAE-Memory response field '${key}' must be a string.`)
}
