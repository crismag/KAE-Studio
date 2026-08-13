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
import { ArrowRight, Check, CircleDashed, ShieldCheck } from 'lucide-react'

import { CapabilityNote } from '@/components/project/CapabilityNote'
import { RepositoryPicker } from './RepositoryPicker'
import { PageLayout } from '@/components/project/PageLayout'
import { Field, FieldSet, Input, Select } from '@/components/ui/form'
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
  useConfigureField,
  useMemoryConnections,
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
    hint: 'Reads are pinned to a commit on this branch, so evidence stays checkable after the branch moves.',
    placeholder: 'main',
    mono: true,
  },
  {
    name: 'working_directory',
    label: 'Working directory',
    hint: 'Narrows what KAE reads. Leave empty for the whole repository.',
    placeholder: 'packages/api',
    mono: true,
  },
  {
    name: 'project_kind',
    label: 'What kind of project this is',
    hint: 'Shapes what KAE asks about and what it expects to find.',
    placeholder: 'internal web application',
  },
  {
    name: 'deliverable_format',
    label: 'Output format',
    hint: 'How generated planning documents are written.',
    options: ['markdown', 'json'],
  },
]

export function ProjectSetup() {
  const setup = useSetup()
  // What has actually been reached, which is what `verified` claims (`D-25`).
  const sources = useSources()

  return (
    <PageLayout
      title="Project setup"
      lead="Where this project’s material comes from, where its outputs go, and what KAE is allowed to reach. Everything here is configuration — none of it becomes something to confirm about your product."
    >
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
            <SetupSummary state={state} sources={sources.data ?? []} />
            <Configuration state={state} />
            <Destinations state={state} />
            <ConnectionsMoved />
          </div>
        )}
      </QueryState>
    </PageLayout>
  )
}

/**
 * Two facts, discretely, per `ADR-0003`.
 *
 * `verified` is the word that has to be earned. A source is configured when
 * somebody typed a repository; it is verified when its content has actually
 * been read. A destination is verified when a publish path has been exercised —
 * which nothing has, because publishing is deliberately off.
 */
function SetupSummary({
  state,
  sources: configured,
}: {
  state: SetupState
  sources: ProjectSource[]
}) {
  const repository = state.configuration.primary_repository
  // `readable` is the provider confirming the location exists and can be read.
  // Anything at or past it means somebody reached the repository; `configured`
  // means only that its name was written down (`D-25`).
  //
  // This read `connections.some((c) => c.state === 'granted')`, which is
  // **authorization** — somebody saying KAE may use a credential — and reported
  // it as `verified` against this file's own rule four lines above and against
  // `ADR-0003`'s *"verified means proved, not declared"*. It was the closest
  // thing available when the page shipped, because sources were not durable and
  // "has this been reached?" had no answer that survived a restart.
  const reached = configured.some(
    (source) => source.state === 'readable' || source.state === 'pinned',
  )
  const sources: Level = !repository?.in_use ? 'none' : reached ? 'verified' : 'configured'
  const destination = state.targets.find((t) => t.isDefault)
  // Registered is registered. This read `destination.available ? 'configured' :
  // 'none'`, so a destination whose credential is not authorized rendered as
  // "No output destination" — to somebody who chose a repository, chose a path
  // and saved it, and whose actual problem is a grant (`D-26`).
  //
  // Losing a fact by rounding it down is the same defect as claiming one by
  // rounding it up; both replace what is true with what is easy to compute.
  const destinations: Level = !destination ? 'none' : 'configured'
  const unreachable =
    destination && !destination.available
      ? destination.unavailableReason ||
        'It cannot be reached yet — the connection it uses has not been granted.'
      : ''

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Where this project stands</PanelTitle>
        <span className="text-[11.5px] text-ink-subtle">
          Configuration, not readiness — a well-understood project can still be unable to publish.
        </span>
      </PanelHeader>
      <PanelBody className="grid gap-4 sm:grid-cols-2">
        <StateRow
          label="Sources"
          level={sources}
          means={{
            none: 'No repository configured. KAE has nothing to read from.',
            configured:
              'A repository is named. Nothing has been read from it yet — a granted ' +
              'credential says KAE may look, not that it has.',
            verified: 'Its content has been reached and read.',
          }}
        />
        <StateRow
          label="Destinations"
          level={destinations}
          detail={unreachable}
          // Only when the connection is the thing missing. A destination
          // unreachable for a reason Memory named — a revoked grant, a deleted
          // repository — is not fixed by visiting settings, and sending
          // somebody there would be a guess dressed as an instruction.
          action={
            unreachable && !destination?.unavailableReason
              ? { label: 'Grant the connection in Settings', to: '/settings/project' }
              : undefined
          }
          means={{
            none: 'No output destination. Generated documents have nowhere to go.',
            configured: 'A destination is registered.',
            // Deliberately unreachable today, and named rather than hidden:
            // `verified` means a publish path was exercised, and publishing is
            // off by decision (`D-8`).
            verified: 'A publication has succeeded to it.',
          }}
        />
      </PanelBody>
    </Panel>
  )
}

type Level = 'none' | 'configured' | 'verified'

const LEVEL: Record<Level, { icon: typeof Check; tone: string; word: string }> = {
  none: { icon: CircleDashed, tone: 'text-ink-subtle', word: 'None' },
  configured: { icon: Check, tone: 'text-accent', word: 'Configured' },
  verified: { icon: ShieldCheck, tone: 'text-confirmed', word: 'Verified' },
}

function StateRow({
  label,
  level,
  means,
  detail = '',
  action,
}: {
  label: string
  level: Level
  means: Record<Level, string>
  /** The one thing to do about the caveat, when there is one (`§16`). */
  action?: { label: string; to: string }
  /**
   * A caveat belonging to this project rather than to the vocabulary.
   *
   * `means` says what a level means for anybody; this says what is true here —
   * a destination that is registered and cannot be reached, for instance. Kept
   * apart so a caveat can never be mistaken for a definition (`D-26`).
   */
  detail?: string
}) {
  const { icon: Icon, tone, word } = LEVEL[level]
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${tone}`} aria-hidden="true" />
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {/* The word travels with the icon. Colour is never the only signal. */}
        <Badge
          tone={level === 'verified' ? 'confirmed' : level === 'configured' ? 'accent' : 'neutral'}
        >
          {word}
        </Badge>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{means[level]}</p>
      {detail && (
        <>
          <p className="mt-1 text-[11.5px] leading-relaxed text-attention">{detail}</p>
          {/* `§16`: a degraded state names one exact next action. This one
              named the fix in prose — grant the connection — and offered no
              way to do it, on a page whose connections panel is two below
              (`D-41`). */}
          {action && (
            <Link
              to={action.to}
              className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-accent-ink underline-offset-2 hover:underline"
            >
              {action.label}
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Where the connection panels went, and why the page does not just drop them.
 *
 * `§6`: workflow selects, Settings configures. Removing them silently would
 * leave a person who used them yesterday with no idea where they are — so the
 * page says, once, and links.
 */
function ConnectionsMoved() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Connections</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Adding and granting a GitHub connection now lives in Project settings. This page selects
          what is already configured; configuring it is a different kind of decision and belongs
          somewhere it can be found deliberately.
        </p>
        <Button asChild variant="secondary">
          <Link to="/settings/project">Manage connections</Link>
        </Button>
      </PanelBody>
    </Panel>
  )
}

/** The six configurable fields, each saved on blur. */
function Configuration({ state }: { state: SetupState }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>What this project is</PanelTitle>
      </PanelHeader>
      <PanelBody>
        <FieldSet
          legend="Source repository"
          description="Chosen from what KAE can actually reach, not typed from memory. Selecting one records where KAE reads from; it reads nothing until you ask it to."
          className="mb-6 max-w-xl"
        >
          <SourceRepository state={state} />
        </FieldSet>

        <FieldSet
          legend="Shape"
          description="Saved as you go. Every value records who set it and when, so a reader can tell a decision from a guess."
          className="max-w-xl"
        >
          {FIELDS.map((field) => (
            <ConfigField key={field.name} field={field} current={state.configuration[field.name]} />
          ))}
        </FieldSet>
      </PanelBody>
    </Panel>
  )
}

/**
 * Repository selection, and the branch that comes with it.
 *
 * Selecting a repository also sets the branch to that repository's own default,
 * because asking for both is asking a person to know something GitHub already
 * told us. They can change it afterwards — `§5`: do not ask for what KAE can
 * infer; show it for confirmation.
 */
function SourceRepository({ state }: { state: SetupState }) {
  const configure = useConfigureField()
  const current = state.configuration.primary_repository?.value ?? ''
  const branch = state.configuration.primary_branch?.value ?? ''

  return (
    <div className="space-y-3">
      <RepositoryPicker
        value={current}
        onSelect={(repo) => {
          configure.mutate({ field: 'primary_repository', value: repo.fullName })
          // Only when the branch is unset. Overwriting a branch somebody chose
          // would make selecting a repository quietly undo a decision.
          //
          // `inferred`, not `confirmed`. **GitHub reported this; the person did
          // not choose it.** `confirmed` is the word this product uses for human
          // agreement, and spending it on a value nobody looked at is the
          // substitution the audit spent a week removing. `§5` asks for inferred
          // values shown *for confirmation*, which is a different claim.
          if (!branch) {
            configure.mutate({
              field: 'primary_branch',
              value: repo.defaultBranch,
              state: 'inferred',
              evidence: `GitHub reports this as the default branch of ${repo.fullName}`,
            })
          }
        }}
      />
      {configure.error instanceof Error && (
        <p role="alert" className="text-[11.5px] text-blocking">
          {configure.error.message}
        </p>
      )}
    </div>
  )
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

/** Credentials as references, and the check that earns the word *granted*. */
function Destinations({ state }: { state: SetupState }) {
  const register = useRegisterTarget()
  const setDefault = useSetDefaultTarget()
  const connections = useMemoryConnections()
  const [repository, setRepository] = useState('')
  const [path, setPath] = useState('docs/planning')
  const usable = (connections.data ?? []).find((c) => c.state === 'granted')
  const error = register.error instanceof Error ? register.error.message : null

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Where outputs go</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <p className="text-[12px] leading-relaxed text-ink-muted">
          Generated planning documents are written to a destination registered here. The coordinate
          lives on the destination and never on a publish request, so nothing can be sent somewhere
          that was never authorised.
        </p>

        {state.targets.length > 0 && (
          <ul className="space-y-2">
            {state.targets.map((target) => (
              <li
                key={target.targetId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-sunken px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                    {target.name}
                    {target.isDefault && <Badge tone="accent">Default</Badge>}
                    {!target.available && <Badge tone="attention">Unavailable</Badge>}
                  </p>
                  <p className="mt-1 text-[11.5px] text-ink-subtle">
                    <Mono>
                      {target.configuration.repository ?? '—'}
                      {target.configuration.path ? `/${target.configuration.path}` : ''}
                    </Mono>
                  </p>
                  {/* Three states, three remedies. A boolean would make a
                      person guess which of them they are looking at. */}
                  {target.unavailableReason && (
                    <p className="mt-1 text-[11.5px] text-ink-muted">{target.unavailableReason}</p>
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
          <Field
            label="Repository"
            hint="Where generated documents are written. KAE opens a pull request; it never force-pushes."
            error={error}
            unavailable={
              usable
                ? undefined
                : 'Grant a connection above first — a destination nobody has authorised cannot receive anything.'
            }
          >
            {(props) => (
              <Input
                {...props}
                mono
                value={repository}
                onChange={(event) => setRepository(event.target.value)}
                placeholder="owner/repository"
              />
            )}
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
