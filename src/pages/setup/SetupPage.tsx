/**
 * Project Setup — stage one of the seven, which has never existed.
 *
 * ## Why this page is the largest gap in the product
 *
 * `01_PRODUCT_OPERATING_MODEL.md` names seven Studio stages: **Project Setup**,
 * Discovery, Definition, Requirements, Architecture, Development Plan,
 * Development Package. Studio's navigation has been most of that for months
 * with stage one absent — repository configuration buried inside `/deliverables`
 * beneath a banner announcing that the page is not built.
 *
 * So the only way into a project was the interview, and the owner's sentence is
 * the whole brief: **"Not all information intake are coming from an interview.
 * There are other input sources and controls that should take part to build
 * KAE."**
 *
 * ## What it renders, and why not a percentage
 *
 * `ADR-0003` already ruled this: setup carries **discrete state**, not a score.
 *
 *     Sources        none · configured · verified
 *     Destinations   none · configured · verified
 *
 * *"A percentage over two booleans communicates less than the two booleans, and
 * it would put configuration into the same visual grammar as knowledge
 * coverage — inviting `Setup 100%` to be read as the project is 100%
 * understood."* And **verified means proved, not declared**: a connection that
 * has been checked is verified; a repository nobody has read is not.
 *
 * ## A lens, never a wizard
 *
 * `01` is explicit that stages *"never lock the user into a wizard sequence"*.
 * Every field here is revisitable, in any order, and the page is as useful on
 * day forty as on day one.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { CapabilityNote } from '@/components/project/CapabilityNote'
import { PageLayout } from '@/components/project/PageLayout'
import { accountsFrom } from '@/pages/settings/accounts'
import { RepositoryPicker } from '@/components/project/RepositoryPicker'
import { Field, FieldSet, Input, Select } from '@/components/ui/form'
import {
  Badge,
  EmptyState,
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
  useAvailableRepositories,
  useConfigureField,
  useMemoryConnections,
  useProject,
  useSources,
  useRegisterTarget,
  useSetDefaultTarget,
  useSetup,
} from '@/hooks/useProject'
import type { ConfiguredValue, ProjectSource, SetupState } from '@/domain/types'

/**
 * The six fields KAE-Memory will accept, and what each is for in a sentence.
 *
 * `KNOWN_FIELDS` in `project_configuration.py` is exactly these six and refuses
 * anything else — *"small on purpose. Each entry arrived with something that
 * reads it."* Rendering a seventh here would be a control whose save always
 * fails.
 */
/**
 * The fields that stay in *Reading options*.
 *
 * `working_directory` **left this list** (`D-91`). It renders beside the source
 * it narrows instead, because a control three panels from its subject is one
 * nobody finds — and two controls writing one field is two things to keep in
 * agreement. With no source there is nothing to narrow, so it is absent rather
 * than empty.
 */
const FIELDS: {
  name: string
  label: string
  hint: string
  placeholder?: string
  mono?: boolean
  options?: string[]
}[] = [
  {
    name: 'primary_branch',
    label: 'Branch',
    hint: 'KAE reads from this branch.',
    placeholder: 'main',
    mono: true,
  },
  {
    name: 'project_kind',
    label: 'What kind of project this is',
    hint: 'Helps KAE ask better questions.',
    placeholder: 'internal web application',
  },
  {
    name: 'deliverable_format',
    label: 'Output format',
    hint: 'The format generated documents are written in.',
    options: ['markdown', 'json'],
  },
]

export function ProjectSetup() {
  const setup = useSetup()
  // What has actually been reached, which is what `verified` claims (`D-25`).
  const sources = useSources()

  return (
    <PageLayout title="Project setup" lead="Everything here can be changed at any time.">
      <QueryState
        query={setup}
        of="This project’s setup"
        skeleton={
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
          </div>
        }
      >
        {(state) => (
          <div className="space-y-5">
            <ProjectIdentity state={state} sources={sources.data ?? []} />
            {/* Second, not last. On a first run the question after *which
                project* is *can KAE reach anything*, and it was at the bottom
                of the page under two panels about things you cannot do yet. */}
            <ConnectionState />
            <Configuration state={state} sources={sources.data ?? []} />
            <Destinations state={state} />
          </div>
        )}
      </QueryState>
    </PageLayout>
  )
}

/**
 * What project this is, and whether it is ready to work — before anything else.
 *
 * The page opened with a form. *"What project am I working on?"* is the first
 * question a setup page has to answer, and it was answered only in the sidebar,
 * in eleven-pixel text, above thirteen navigation items (`D-83`).
 *
 * Order is the owner's: **identity → status → action → technical detail**.
 */
function ProjectIdentity({ state, sources }: { state: SetupState; sources: ProjectSource[] }) {
  const { data: project } = useProject()
  const read = sources.filter((s) => s.state === 'readable' || s.state === 'pinned').length
  const kind = state.configuration.project_kind?.value

  return (
    <Panel>
      <PanelBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title font-semibold text-ink">{project?.name ?? 'This project'}</h2>
            <p className="mt-1 text-meta text-ink-muted">{kind || 'No project kind set yet'}</p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/workspace">Continue in Workspace</Link>
          </Button>
        </div>

        {/* Status as facts a person can act on, not a score. `ADR-0003`: two
            discrete readings beat one percentage. */}
        <div className="flex flex-wrap gap-2">
          <Fact
            label="Sources"
            value={
              sources.length === 0
                ? 'None yet'
                : read > 0
                  ? `${read} of ${sources.length} read`
                  : `${sources.length} added, none read`
            }
            // Added-but-unread is the ordinary state of a new project, not a
            // warning. Amber here made every project look wrong on arrival.
            tone={read > 0 ? 'confirmed' : 'neutral'}
          />
          <Fact label="Outputs" value={destinationWord(state)} tone={destinationTone(state)} />
        </div>
      </PanelBody>
    </Panel>
  )
}

/** One reading, as a chip. State reads at a glance or it is not status. */
function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'neutral' | 'attention' | 'confirmed'
}) {
  const colour =
    tone === 'confirmed'
      ? 'border-confirmed-line bg-confirmed-soft text-confirmed'
      : tone === 'attention'
        ? 'border-attention-line bg-attention-soft text-ink'
        : 'border-line bg-surface-sunken text-ink-muted'
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-md border px-2.5 py-1 text-meta ${colour}`}
    >
      <span className="font-medium">{label}</span>
      <span>{value}</span>
    </span>
  )
}

/**
 * Whether an account is connected, in one line (`D-85`).
 *
 * This was a panel apologising for a move — three lines explaining that
 * connections live in Settings now and that configuring is *a different kind of
 * decision*. True, and an explanation of the product's architecture rather than
 * a fact about this project.
 *
 * What a person needs here is whether GitHub is reachable and where to change
 * it. `§6` still holds: this page selects what is configured, and configuring
 * happens in Settings.
 */
function ConnectionState() {
  const connections = useMemoryConnections()
  const listing = useAvailableRepositories()
  const accounts = accountsFrom(connections.data ?? [])
  const connected = accounts.some((account) => account.granted)
  const githubCount = (listing.data?.repositories ?? []).filter((row) => row.kind === 'github')
    .length
  const listingKnown = listing.isSuccess && !listing.data?.unavailableReason
  const seesGithub = listingKnown && githubCount > 0
  const authorisedEmpty = connected && listingKnown && githubCount === 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <span className="flex items-center gap-2 text-body text-ink">
        <Badge tone={seesGithub ? 'confirmed' : authorisedEmpty ? 'attention' : 'neutral'}>
          {seesGithub
            ? 'GitHub connected'
            : authorisedEmpty
              ? 'GitHub authorised, no repositories visible'
              : connected
                ? 'GitHub authorised'
                : 'No GitHub account'}
        </Badge>
        <span className="text-meta text-ink-muted">
          {seesGithub
            ? 'Repositories on GitHub can be added as sources.'
            : authorisedEmpty
              ? 'This project may use GitHub, but KAE cannot see any repositories yet.'
              : connected && listing.isPending
                ? 'Checking which repositories KAE can see.'
                : 'Folders on this machine still work without one.'}
        </span>
      </span>
      <Button asChild variant="secondary" size="sm">
        <Link to="/settings/project">{connected ? 'Manage' : 'Connect'}</Link>
      </Button>
    </div>
  )
}

/** The six configurable fields, each saved on blur. */
function Configuration({ state, sources }: { state: SetupState; sources: ProjectSource[] }) {
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader>
          <PanelTitle>What this project reads from</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <ConfiguredSources sources={sources} />
          {/* Beside what it narrows, not three panels away (`D-91`). */}
          {sources.length > 0 && (
            <div className="max-w-md border-t border-line pt-4">
              <WorkingDirectory state={state} />
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Behind a disclosure. Four inputs a person sets once were the bulk of
          the page — technical detail ahead of identity, status and action,
          which is the order the owner reversed (`D-83`). */}
      <details className="group rounded-lg border border-line bg-surface">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-body font-medium text-ink hover:bg-surface-sunken">
          <span className="flex items-center gap-2">
            {/* An affordance. Without it this rendered as a bar that looked
                disabled — a control nobody could tell was a control. */}
            <ChevronRight
              className="size-3.5 text-ink-subtle transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
            Reading options
          </span>
          <span className="text-meta font-normal text-ink-muted">
            Branch, project kind, output format
          </span>
        </summary>
        <div className="border-t border-line px-4 py-4">
          <FieldSet legend="" description="Saved as you type." className="max-w-xl">
            {FIELDS.map((field) => (
              <ConfigField
                key={field.name}
                field={field}
                current={state.configuration[field.name]}
              />
            ))}
          </FieldSet>
        </div>
      </details>
    </div>
  )
}

/**
 * What this project reads from, as a summary — never a second picker.
 *
 * Selection has one home, and it is Sources (`D-81`). Two pickers with
 * different behaviour is how they drift apart, and the owner's `+` model puts
 * the accumulating list in one place. This says what is configured, whether it
 * has actually been read, and where to change it.
 *
 * **Name first, path second.** `location` is `owner/name` for GitHub and an
 * absolute path for a folder, and leading with the path made this read as
 * developer output rather than as a product (`D-78`).
 */
/**
 * What KAE reads **inside** the chosen source.
 *
 * `working_directory` lived only in collapsed *Reading options*, three panels
 * from the repository it narrows — so a monorepo looked like a project with
 * hundreds of irrelevant files and the field that fixes it was somewhere a
 * person had no reason to open (`D-91`, `OD-SRC-3`).
 *
 * Shown beside the source list once a source exists, and **not** a folder
 * multi-select inside the picker: `OD-SRC-3` settles that a working directory
 * is a setup field, and picking a root then narrowing it is the shipped shape.
 */
function WorkingDirectory({ state }: { state: SetupState }) {
  const configure = useConfigureField()
  const current = state.configuration.working_directory?.value ?? ''
  const [draft, setDraft] = useState(current)

  return (
    <Field label="Read only this folder" hint="Empty means the whole repository.">
      {(props) => (
        <Input
          {...props}
          mono
          value={draft}
          placeholder="packages/api"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() =>
            draft !== current && configure.mutate({ field: 'working_directory', value: draft })
          }
        />
      )}
    </Field>
  )
}

function ConfiguredSources({ sources }: { sources: ProjectSource[] }) {
  if (sources.length === 0) {
    return (
      <EmptyState
        title="Nothing to read from yet"
        action={
          <Button asChild>
            <Link to="/sources">Add a source</Link>
          </Button>
        }
      >
        KAE reads repositories and documents you give it. Nothing has been added to this project.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {sources.map((source) => {
          // Reached, not merely saved. `configured` means somebody named it;
          // the words differ because the remedies do (`D-25`).
          const read = source.state === 'readable' || source.state === 'pinned'
          return (
            <li
              key={source.sourceId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-body font-medium text-ink">
                  <Badge tone="neutral">{SOURCE_KIND[source.kind] ?? source.kind}</Badge>
                  {sourceName(source)}
                </p>
                <p className="mt-1 truncate text-caption text-ink-subtle">
                  <Mono>{source.location}</Mono>
                  {source.reference ? ` · ${source.reference}` : ''}
                </p>
              </div>
              <Badge tone={read ? 'confirmed' : 'neutral'}>{read ? 'Read' : 'Not read yet'}</Badge>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/sources">Manage sources</Link>
        </Button>
      </div>
    </div>
  )
}

const SOURCE_KIND: Record<string, string> = {
  github: 'GitHub',
  local: 'Folder',
  paste: 'Pasted',
  upload: 'File',
  s3: 'S3',
}

function sourceName(source: ProjectSource): string {
  if (source.kind !== 'local') return source.location
  return source.location.split('/').filter(Boolean).pop() || source.location
}

function ConfigField({
  field,
  current,
}: {
  field: (typeof FIELDS)[number]
  current: ConfiguredValue | undefined
}) {
  const configure = useConfigureField()
  const [draft, setDraft] = useState(current?.value ?? '')
  const error = configure.error instanceof Error ? configure.error.message : null

  const save = () => {
    if (draft === (current?.value ?? '')) return
    configure.mutate({ field: field.name, value: draft })
  }

  return (
    <Field
      label={field.label}
      hint={
        current?.state === 'inferred' || current?.state === 'suggested' ? (
          <>
            {/* Where a value came from, when it did not come from a person.
                `suggested` is deliberately not in use — a proposal to accept,
                not a setting — and saying so is the difference between the two. */}
            <span className="font-medium text-ink-muted">
              {current.state === 'suggested' ? 'Suggested, not applied' : 'Inferred'}
            </span>
            {current.evidence ? ` — ${current.evidence}` : null}
          </>
        ) : (
          field.hint
        )
      }
      error={error}
    >
      {(props) =>
        field.options ? (
          <Select
            {...props}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              configure.mutate({ field: field.name, value: event.target.value })
            }}
          >
            <option value="">Not set</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            {...props}
            value={draft}
            mono={field.mono}
            placeholder={field.placeholder}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
          />
        )
      }
    </Field>
  )
}

/**
 * What a destination is, in one word, beside the thing it describes.
 *
 * This was a second panel at the top of the page restating it — *Destinations:
 * Configured* over a list that already said so. One subject, one place
 * (`D-82`).
 */
function destinationWord(state: SetupState): string {
  const targets = state.targets
  if (targets.length === 0) return 'None'
  const chosen = targets.find((target) => target.isDefault)
  if (!chosen) return 'No default chosen'
  // Registered and unreachable is neither absent nor ready (`D-26`). The word
  // has to carry that, or the badge contradicts the row underneath it.
  return chosen.available ? 'Ready' : 'Cannot be reached'
}

function destinationTone(state: SetupState): 'neutral' | 'attention' | 'confirmed' {
  const targets = state.targets
  if (targets.length === 0) return 'neutral'
  const chosen = targets.find((target) => target.isDefault)
  if (!chosen || !chosen.available) return 'attention'
  return 'confirmed'
}

function Destinations({ state }: { state: SetupState }) {
  const register = useRegisterTarget()
  const setDefault = useSetDefaultTarget()
  const connections = useMemoryConnections()
  const listing = useAvailableRepositories()
  const [repository, setRepository] = useState('')
  const [path, setPath] = useState('docs/planning')
  const usable = (connections.data ?? []).find((c) => c.state === 'granted')
  const githubCount = (listing.data?.repositories ?? []).filter((row) => row.kind === 'github')
    .length
  const listingKnown = listing.isSuccess && !listing.data?.unavailableReason
  const noGithubToPick = Boolean(usable && listingKnown && githubCount === 0)
  const error = register.error instanceof Error ? register.error.message : null

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Where outputs go</PanelTitle>
        <Badge tone={destinationTone(state)}>{destinationWord(state)}</Badge>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <p className="text-meta text-ink-muted">Generated documents are written here.</p>

        {/* `D-26`'s follow-up, moved with its subject (`D-82`). A destination
            that is registered and is not the default receives nothing:
            `resolve_target` takes a registered id or the project's default and
            no third option, and nothing in Studio passes an id. It used to be
            said in a summary panel at the top of the page, one panel away from
            the control that fixes it. */}
        {state.targets.length > 0 && !state.targets.some((target) => target.isDefault) && (
          <p className="rounded-md border border-attention-line bg-attention-soft px-3 py-2 text-meta text-ink">
            {state.targets.length === 1
              ? 'This destination is not the default, so a generated package has nowhere to go.'
              : `None of these ${state.targets.length} is the default, so a generated package has nowhere to go.`}{' '}
            Choose one below.
          </p>
        )}

        {state.targets.length > 0 && (
          <ul className="space-y-2">
            {state.targets.map((target) => (
              <li
                key={target.targetId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-body font-medium text-ink">
                    {target.name}
                    {target.isDefault && <Badge tone="accent">Default</Badge>}
                    {!target.available && <Badge tone="attention">Unavailable</Badge>}
                  </p>
                  <p className="mt-1 text-caption text-ink-subtle">
                    <Mono>
                      {target.configuration.repository ?? '—'}
                      {target.configuration.path ? `/${target.configuration.path}` : ''}
                    </Mono>
                  </p>
                  {/* Three states, three remedies. A boolean would make a
                      person guess which of them they are looking at. */}
                  {/* A reason, always, when it cannot be reached. `§16` and
                      `D-41`: Memory does not always supply one, and "unavailable"
                      with no sentence leaves somebody guessing between three
                      situations with three remedies. The fallback lived in the
                      summary panel `D-82` removed, and came with it. */}
                  {!target.available && (
                    <p className="mt-1 text-caption text-ink-muted">
                      {target.unavailableReason ||
                        'It cannot be reached yet — the connection it uses has not been granted.'}
                    </p>
                  )}
                </div>
                {!target.isDefault && (
                  <Button
                    size="sm"
                    onClick={() => setDefault.mutate(target.targetId)}
                    disabled={setDefault.isPending}
                  >
                    Make default
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <FieldSet legend="Add a destination" className="max-w-xl border-t border-line pt-4">
          {/* **Chosen, not typed** (`D-87`). This was a text box taking
              `owner/repository` from memory — the exact interaction removed
              from source selection two decisions earlier, still sitting one
              panel below it. A repository nobody can reach fails at publish
              time, which is the last place to discover a typo. */}
          <Field
            label="Repository"
            hint="Where generated documents are written. KAE opens a pull request; it never force-pushes."
            error={error}
            unavailable={
              usable
                ? undefined
                : 'This project has no GitHub access yet. Open GitHub in Settings — you cannot paste a token here.'
            }
          >
            {() =>
              repository ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-line bg-accent-soft px-3 py-2">
                  <Mono>{repository}</Mono>
                  <Button variant="ghost" size="sm" onClick={() => setRepository('')}>
                    Change
                  </Button>
                </div>
              ) : noGithubToPick ? (
                <p className="text-meta text-ink-muted">
                  KAE cannot see any GitHub repositories to send output to.{' '}
                  <Link className="underline" to="/settings/project">
                    See GitHub in Settings
                  </Link>
                  . Folders as sources still work on{' '}
                  <Link className="underline" to="/sources">
                    Sources
                  </Link>
                  .
                </p>
              ) : (
                <RepositoryPicker
                  kind="github"
                  label="Filter destination repositories"
                  onSelect={(repo) => setRepository(repo.fullName)}
                />
              )
            }
          </Field>

          <Field label="Path" hint="Where inside the repository.">
            {(props) => (
              <Input
                {...props}
                mono
                value={path}
                onChange={(event) => setPath(event.target.value)}
                disabled={!usable}
              />
            )}
          </Field>
          <Button
            onClick={() =>
              register.mutate({
                name: repository,
                configuration: { repository, path },
                connectionId: usable?.connectionId,
                makeDefault: state.targets.length === 0,
              })
            }
            disabled={!usable || !repository.trim() || register.isPending}
          >
            {register.isPending ? 'Registering…' : 'Register destination'}
          </Button>
        </FieldSet>

        {/* The honest edge of this page. Everything above is real; writing is
            not, and saying so here beats a button that fails at the end. */}
        <CapabilityNote reason="Test write is not available. Publishing is disabled on this deployment, so no destination has been proved writable — a registered destination means authorised and reachable, not exercised." />
      </PanelBody>
    </Panel>
  )
}
