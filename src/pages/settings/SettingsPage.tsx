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
import { formatDate } from '@/lib/format'
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
import { accountsFrom, ungranted, type Account } from './accounts'
import { useDeploymentStatus } from '@/app/shell/useDeploymentStatus'
import { CapabilityNote } from '@/components/project/CapabilityNote'

export function ProjectSettings() {
  return (
    <PageLayout
      title="Connections"
      lead="Accounts KAE can reach. Connect one here and any project can use it — connecting reads nothing on its own."
    >
      <Connections />
    </PageLayout>
  )
}

export function Connections() {
  const connections = useMemoryConnections()
  const record = useMemoryConnectionForm()

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>GitHub</PanelTitle>
          <Badge tone="neutral">
            <Lock className="mr-1 size-3" aria-hidden="true" />
            KAE never sees a token
          </Badge>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <QueryState
            query={connections}
            of="Connected accounts"
            skeleton={<Skeleton className="h-16" />}
          >
            {(rows) => {
              const accounts = accountsFrom(rows)
              return accounts.length === 0 ? (
                <ConnectGitHub />
              ) : (
                <>
                  <ul className="space-y-2">
                    {accounts.map((account) => (
                      <AccountRow key={account.key} account={account} />
                    ))}
                  </ul>
                  <ConnectGitHub compact />
                </>
              )
            }}
          </QueryState>
        </PanelBody>
      </Panel>

      {record}
    </div>
  )
}

/**
 * The install hand-off (`D-78`), and what it says while there is no App.
 *
 * `§19` forbids a control that looks available and is not. It does **not**
 * require the explanation before anybody asks — so the button is present and
 * states its prerequisite where a person reaching for it will read it, rather
 * than as a paragraph above the panel (`D-78`).
 */
function ConnectGitHub({ compact = false }: { compact?: boolean }) {
  const deployment = useDeploymentStatus()
  const slug = deployment.state === 'ready' ? deployment.status.githubAppSlug : undefined

  return (
    <div
      className={
        compact
          ? 'border-t border-line pt-3'
          : 'rounded-md border border-line bg-surface-sunken px-4 py-4'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">
            {compact ? 'Add another account' : 'Connect GitHub'}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {compact
              ? 'A second account, or an organisation.'
              : 'You choose the repositories on GitHub. KAE reads only those, and never holds a token.'}
          </p>
        </div>
        {slug ? (
          <Button asChild size={compact ? 'sm' : 'md'}>
            <a href={`https://github.com/apps/${slug}/installations/new`} rel="noreferrer">
              <Github className="size-3.5" aria-hidden="true" />
              Connect
            </a>
          </Button>
        ) : (
          <CapabilityNote
            className="max-w-md"
            reason="No GitHub App is registered for this deployment, so there is nothing to install yet. An operator sets STUDIO_GITHUB_APP_SLUG once the App exists."
          />
        )}
      </div>
    </div>
  )
}

/**
 * One row per account, from records that accumulated one per attempt (`D-79`).
 *
 * Six identical `github` rows was not a rendering choice — it was every write
 * attempt, shown. This groups them; nothing is deleted and every record stays
 * separately addressable.
 */
function AccountRow({ account }: { account: Account }) {
  const authorize = useAuthorizeMemoryConnection()
  // Only where the account does **not** work. A connected account with a
  // leftover ungranted record rendered `Connected` beside `Grant access`, which
  // reads as a contradiction — and it is noise, because the account already
  // reaches the provider. Caught by looking at the page, not the test.
  const pending = account.granted ? undefined : ungranted(account)
  const error = authorize.error instanceof Error ? authorize.error.message : null

  return (
    <li className="rounded-md border border-line px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <Github className="size-3.5 text-ink-subtle" aria-hidden="true" />
            {account.provider}
            <Badge tone={account.granted ? 'confirmed' : 'attention'}>
              {account.granted ? 'Connected' : 'Not connected'}
            </Badge>
          </p>
          <p className="mt-1 text-[11.5px] text-ink-subtle">
            <Mono>{account.credentialReference ?? 'no reference'}</Mono>
            {account.authorizedBy && ` · connected by ${account.authorizedBy}`}
            {/* **Connected**, never *last checked*: the timestamp is stamped
                when somebody authorises, and nothing since has reached the
                provider (`D-25`, `D-60`). */}
            {account.grantedAt && ` on ${formatDate(account.grantedAt)}`}
          </p>
          {account.records.length > 1 && (
            <p className="mt-1 text-[11.5px] text-ink-subtle">
              {account.records.length} records for this account. Kept as they are — one of them is
              the connection this project uses.
            </p>
          )}
        </div>
        {pending && (
          <Button
            size="sm"
            onClick={() => authorize.mutate(pending.connectionId)}
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
    <Panel>
      <PanelHeader>
        <PanelTitle>Connect by token instead</PanelTitle>
        <Badge tone="neutral">Superseded</Badge>
      </PanelHeader>
      <PanelBody>
        <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">
          The older way, kept because deployments still use it. KAE reads the token from an
          environment variable on the server — it is never typed here, and never stored.
        </p>
        <Field
          label="Environment variable"
          hint="The name of the variable holding the token, not the token."
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
      </PanelBody>
    </Panel>
  )
}
