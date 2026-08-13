/**
 * Connections — configuring *how* GitHub is reached, which is not a project decision.
 *
 * `§6` of the UX package states the Studio-wide rule:
 *
 * > Workflow pages select configured resources. Settings pages configure those
 * > resources.
 *
 * A project asks **which repository?** Settings owns **how GitHub is
 * connected.** These panels used to sit on `/setup` beside five configuration
 * fields and a destination form — seven responsibilities on one page, which is
 * what `§5` means by *"too information-heavy"*.
 *
 * Moved rather than rebuilt: the same components, the same hooks, the same
 * behaviour, one route over. The directive is explicit that structural
 * relocation must not be combined with visual redesign.
 *
 * ## Still project-scoped, and that is deliberate
 *
 * Memory records connections per project (`provider_connections`), so this is
 * *Project Settings* rather than global Settings. When `U7` multi-user arrives,
 * a genuinely global connection — one GitHub account, many projects — becomes
 * the right shape. It is not the right shape while one deployment-wide token
 * does the reaching.
 */

import { useState } from 'react'
import { Github, Lock, Plus } from 'lucide-react'

import { PageLayout } from '@/components/project/PageLayout'
import { Field, Input } from '@/components/ui/form'
import {
  Badge,
  Button,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { QueryState } from '@/components/ui/QueryState'
import {
  useAuthorizeMemoryConnection,
  useMemoryConnections,
  useRecordMemoryConnection,
} from '@/hooks/useProject'
import type { MemoryConnection } from '@/domain/types'

export function ProjectSettings() {
  return (
    <PageLayout
      title="Project settings"
      lead="How KAE reaches the services this project uses. Ordinary work selects what is configured here — it does not configure it."
    >
      <Connections />
    </PageLayout>
  )
}

export function Connections() {
  const connections = useMemoryConnections()
  const record = useMemoryConnectionForm()

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What KAE may reach</PanelTitle>
        <Badge tone="neutral">
          <Lock className="mr-1 size-3" aria-hidden="true" />
          References only
        </Badge>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <p className="text-[12px] leading-relaxed text-ink-muted">
          A connection records <em>where</em> a credential lives — an environment variable name —
          never the credential. Pasting a token here is refused rather than stored.
        </p>

        <QueryState
          query={connections}
          of="This project’s connections"
          skeleton={<Skeleton className="h-16" />}
          empty={
            <p className="text-[12.5px] italic text-ink-subtle">
              Nothing connected yet. KAE can read nothing outside this conversation.
            </p>
          }
        >
          {(rows) => (
            <ul className="space-y-2">
              {rows.map((connection) => (
                <ConnectionRow key={connection.connectionId} connection={connection} />
              ))}
            </ul>
          )}
        </QueryState>

        {record}
      </PanelBody>
    </Panel>
  )
}

function ConnectionRow({ connection }: { connection: MemoryConnection }) {
  const authorize = useAuthorizeMemoryConnection()
  const granted = connection.state === 'granted'
  const error = authorize.error instanceof Error ? authorize.error.message : null

  return (
    <li className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
            <Github className="size-3.5 text-ink-subtle" aria-hidden="true" />
            {connection.provider}
            <Badge tone={granted ? 'confirmed' : 'attention'}>
              {granted ? 'Granted' : 'Not granted'}
            </Badge>
          </p>
          <p className="mt-1 text-[11.5px] text-ink-subtle">
            <Mono>{connection.credentialReference ?? 'no reference'}</Mono>
            {connection.authorizedBy && ` · granted by ${connection.authorizedBy}`}
          </p>
        </div>
        {!granted && (
          <Button
            size="sm"
            onClick={() => authorize.mutate(connection.connectionId)}
            disabled={authorize.isPending}
          >
            {authorize.isPending ? 'Checking…' : 'Grant access'}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-[11.5px] text-blocking">{error}</p>}
    </li>
  )
}

function useMemoryConnectionForm() {
  const record = useRecordMemoryConnection()
  const [reference, setReference] = useState('env:KAE_GITHUB_TOKEN')
  const error = record.error instanceof Error ? record.error.message : null

  return (
    <div className="border-t border-line pt-4">
      <Field
        label="Add a connection"
        hint="The name of the environment variable holding the token, not the token."
        error={error}
      >
        {(props) => (
          <div className="flex gap-2">
            <Input
              {...props}
              mono
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="env:KAE_GITHUB_TOKEN"
            />
            <Button
              onClick={() => record.mutate({ credentialReference: reference })}
              disabled={record.isPending || !reference.trim()}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        )}
      </Field>
    </div>
  )
}
