/**
 * Connections — configuring *how* GitHub is reached, which is not a project decision.
 *
 * `§6` of the UX package states the Studio-wide rule:
 *
 * > Workflow pages select configured resources. Settings pages configure those
 * > resources.
 *
 * A project asks **which repository?** Settings owns **how GitHub is
 * connected.** The browser never holds a token (`§19`). The product action is
 * installing KAE's GitHub App. A host environment variable is not a user
 * connector, and naming it on this page made the page look broken.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '@/lib/format'
import { ChevronRight, Github, Lock, Plus } from 'lucide-react'

import { PageLayout } from '@/components/project/PageLayout'
import { Field, Input } from '@/components/ui/form'
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { QueryState } from '@/components/ui/QueryState'
import {
  useAuthorizeMemoryConnection,
  useAvailableRepositories,
  useMemoryConnections,
  useRecordMemoryConnection,
} from '@/hooks/useProject'
import { accountsFrom, ungranted, type Account } from './accounts'
import { useDeploymentStatus } from '@/app/shell/useDeploymentStatus'
import { useInstallations } from '@/hooks/useProject'
import { plural } from '@/lib/plural'
import type { InstallationListing } from '@/services/interfaces'
import type { MemoryConnection } from '@/domain/types'

export function ProjectSettings() {
  return (
    <PageLayout
      title="GitHub"
      lead="Connect an account so this project can read repositories. Connecting reads nothing on its own — you pick repositories on Sources."
    >
      <Connections />
    </PageLayout>
  )
}

export function Connections() {
  const connections = useMemoryConnections()
  const installs = useInstallations()
  const listing = useAvailableRepositories()
  const deployment = useDeploymentStatus()
  const slug = deployment.state === 'ready' ? deployment.status.githubAppSlug : undefined
  const tokenOnHost =
    deployment.state === 'ready' && deployment.status.githubSource === 'configured'
  const githubCount = (listing.data?.repositories ?? []).filter(
    (row) => row.kind === 'github',
  ).length

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle>This project</PanelTitle>
          <Badge tone="neutral">
            <Lock className="mr-1 size-3" aria-hidden="true" />
            KAE never holds a token in the browser
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
              if (accounts.length === 0) {
                return <NoAccountYet slug={slug} tokenOnHost={tokenOnHost} />
              }
              return (
                <>
                  <ul className="space-y-2">
                    {accounts.map((account) => (
                      <AccountRow
                        key={account.key}
                        account={account}
                        installations={installs.data}
                      />
                    ))}
                  </ul>
                  <Installations listing={installs.data} />
                  {accounts.some((account) => account.granted) && (
                    <GrantedNext githubCount={githubCount} listingPending={listing.isPending} />
                  )}
                  {slug ? <ConnectGitHub compact /> : null}
                </>
              )
            }}
          </QueryState>
        </PanelBody>
      </Panel>

      <TokenReferenceForm />
    </div>
  )
}

/**
 * What a person can do when this project has no GitHub grant yet.
 *
 * Three states, because collapsing them is how this page used to offer a
 * control that could not run:
 *
 * - **App slug** — Connect goes to GitHub. That is the product connector.
 * - **Host token, no App** — this Studio can already call GitHub; the user
 *   grants *this project*, and never pastes a secret.
 * - **Neither** — there is nothing to connect from here. Say so. Do not name
 *   operator environment variables (`D-78`).
 */
function NoAccountYet({ slug, tokenOnHost }: { slug?: string; tokenOnHost: boolean }) {
  if (slug) return <ConnectGitHub />
  if (tokenOnHost) return <UseHostGitHub />
  return (
    <EmptyState title="GitHub is not available to connect from this Studio">
      <p>
        You cannot add a GitHub account here. Connecting your own GitHub is done by installing KAE’s
        GitHub App, and this Studio does not have one yet. A personal token is never typed into this
        page.
      </p>
      <p className="mt-2">
        Folders on this machine still work.{' '}
        <Link className="underline" to="/sources">
          Add a source
        </Link>{' '}
        to pick one.
      </p>
    </EmptyState>
  )
}

function ConnectGitHub({ compact = false }: { compact?: boolean }) {
  const deployment = useDeploymentStatus()
  const slug = deployment.state === 'ready' ? deployment.status.githubAppSlug : undefined
  if (!slug) return null

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
              ? 'A second account, or an organisation. GitHub asks which repositories KAE may read.'
              : 'GitHub asks which repositories KAE may read. KAE never holds a token.'}
          </p>
        </div>
        <Button asChild size={compact ? 'sm' : 'md'}>
          <a href={`https://github.com/apps/${slug}/installations/new`} rel="noreferrer">
            <Github className="size-3.5" aria-hidden="true" />
            Connect
          </a>
        </Button>
      </div>
    </div>
  )
}

/**
 * This host already has a GitHub token. The user is granting the *project*,
 * not pasting a secret.
 *
 * `KAE_GITHUB_TOKEN` / `STUDIO_GITHUB_SOURCE_TOKEN` live on the server. Memory
 * records `env:KAE_GITHUB_TOKEN` as a pointer to that secret. Showing the
 * pointer as a form made people think they were supposed to type a token.
 */
function UseHostGitHub() {
  const record = useRecordMemoryConnection()
  const authorize = useAuthorizeMemoryConnection()
  const error =
    (record.error instanceof Error ? record.error.message : null) ||
    (authorize.error instanceof Error ? authorize.error.message : null)
  const pending = record.isPending || authorize.isPending

  return (
    <div className="space-y-3">
      <p className="text-body text-ink-muted">
        This Studio can already talk to GitHub using access configured on the server. You do not
        paste a token here. Allow this project to use that access, then pick repositories on
        Sources.
      </p>
      <Button
        disabled={pending}
        onClick={() => {
          void (async () => {
            const created = (await record.mutateAsync({
              credentialReference: 'env:KAE_GITHUB_TOKEN',
            })) as MemoryConnection
            await authorize.mutateAsync(created.connectionId)
          })()
        }}
      >
        <Github className="size-3.5" aria-hidden="true" />
        {pending ? 'Allowing…' : 'Allow this project to use GitHub'}
      </Button>
      {error && <p className="text-[11.5px] text-blocking">{error}</p>}
    </div>
  )
}

function GrantedNext({
  githubCount,
  listingPending,
}: {
  githubCount: number
  listingPending: boolean
}) {
  if (listingPending) return null
  if (githubCount > 0) {
    return (
      <p className="text-meta text-ink-muted">
        {plural(githubCount, 'repository')} available.{' '}
        <Link className="underline" to="/sources">
          Choose repositories on Sources
        </Link>
        .
      </p>
    )
  }
  return (
    <p className="text-meta text-ink-muted">
      This project is allowed to use GitHub, but KAE cannot see any repositories through the
      server’s access. Folders on this machine still work.{' '}
      <Link className="underline" to="/sources">
        Add a source
      </Link>
      .
    </p>
  )
}

/**
 * The accounts this App is installed on, and which one is being read (`D-90`).
 *
 * **Not a picker.** Choosing durably has nowhere to live (`OD-SRC-2`).
 */
function Installations({ listing }: { listing?: InstallationListing }) {
  if (!listing || listing.installations.length === 0) return null

  const chosen = listing.selected
  return (
    <div className="rounded-md border border-line bg-surface-sunken px-3.5 py-3">
      <p className="text-meta font-medium text-ink">
        Installed on {plural(listing.installations.length, 'account')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {listing.installations.map((install) => {
          const reading = String(install.installationId) === chosen
          return (
            <li
              key={install.installationId}
              className="flex flex-wrap items-center justify-between gap-2 text-meta"
            >
              <span className="flex items-center gap-2 text-ink">
                {install.account}
                <span className="text-caption text-ink-subtle">
                  {install.repositorySelection === 'all'
                    ? 'all repositories'
                    : 'selected repositories'}
                </span>
              </span>
              {reading && <Badge tone="confirmed">KAE reads this one</Badge>}
            </li>
          )
        })}
      </ul>
      {!chosen && listing.installations.length > 1 && (
        <p className="mt-2 text-caption text-ink-muted">
          KAE does not know which of these accounts to read yet. This Studio has to be told which
          one, then restarted.
        </p>
      )}
    </div>
  )
}

function AccountRow({
  account,
  installations,
}: {
  account: Account
  installations?: InstallationListing
}) {
  const authorize = useAuthorizeMemoryConnection()
  const pending = account.granted ? undefined : ungranted(account)
  const error = authorize.error instanceof Error ? authorize.error.message : null

  return (
    <li className="rounded-md border border-line px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-body font-medium text-ink">
            <Github className="size-3.5 text-ink-subtle" aria-hidden="true" />
            {accountName(account, installations)}
            <Badge tone={account.granted ? 'confirmed' : 'attention'}>
              {account.granted ? 'Connected' : 'Not connected'}
            </Badge>
          </p>
          <p className="mt-1 text-[11.5px] text-ink-subtle">
            {account.authorizedBy && `connected by ${account.authorizedBy}`}
            {account.grantedAt && ` on ${formatDate(account.grantedAt)}`}
          </p>
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

function accountName(account: Account, installations?: InstallationListing): string {
  const only = installations?.installations
  if (only && only.length === 1) return only[0].account
  if (only && only.length > 1) return only.map((row) => row.account).join(', ')
  return account.provider === 'github' ? 'GitHub' : account.provider
}

/**
 * Operator path. A reference to a host secret, never the secret.
 *
 * Kept because deployments still record `env:KAE_GITHUB_TOKEN`. It is not how a
 * person connects GitHub, so it sits behind a disclosure (`D-78`).
 */
function TokenReferenceForm() {
  const record = useRecordMemoryConnection()
  const [reference, setReference] = useState('env:KAE_GITHUB_TOKEN')
  const error = record.error instanceof Error ? record.error.message : null

  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 text-body font-medium text-ink hover:bg-surface-sunken">
        <ChevronRight
          className="size-3.5 text-ink-subtle transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        Advanced
        <span className="text-meta font-normal text-ink-muted">Server token reference</span>
      </summary>
      <div className="border-t border-line px-4 py-4">
        <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">
          KAE reads a token from an environment variable on the server — never typed here, never
          stored. This records the *name* of that variable for this project. It does not create a
          GitHub account.
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
      </div>
    </details>
  )
}
