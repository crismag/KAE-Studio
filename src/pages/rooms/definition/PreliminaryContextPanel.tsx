/**
 * What was said, what KAE is guessing, and what nobody has decided.
 *
 * `D-18`. KAE-Memory composes this for exactly the project that has almost
 * nothing yet, and its own docstring states the discipline the section is for:
 *
 * > *known, proposed, assumed and unknown are four separate collections and
 * > never merge.*
 *
 * Studio received all of it and rendered none of it. The backend proxied five
 * of the six collections faithfully; the live adapter declared two, read one,
 * and put it into `health.recommendedNext`, which no component renders. Every
 * layer looked correct and nothing reached a person — `AUD-041` at the last
 * hop, where it is hardest to see.
 *
 * ## What this component will not do
 *
 * **Count them.** A section that opens with *"2 assumptions, 1 unknown"* has
 * already thrown away the distinction it exists to preserve.
 *
 * **Merge them.** An assumption rendered beside a confirmed statement, in the
 * same type, is a confirmed statement to anybody reading quickly.
 *
 * **Paraphrase.** `statedVerbatim` is the one place in this product where a
 * person's own sentence survives, and Memory keeps it because *"a preliminary
 * context is most often wrong in its interpretation rather than in its
 * transcription."* A reader who can see the original catches that; one who
 * cannot, cannot.
 */

import { Panel, PanelBody, PanelHeader, PanelTitle, Badge } from '@/components/ui/primitives'
import { SeverityBadge } from '@/components/project/SeverityBadge'
import type { AssumedEntry, PreliminaryContext, UnknownEntry } from '@/domain/types'

/**
 * Whether there is anything at all to render.
 *
 * Kept as its own function rather than inlined into the JSX because presence is
 * a decision with a reason: a panel that has nothing to say still says *"this
 * section applies to you"*, and an empty bordered box on every mature project
 * is furniture.
 */
function hasPreliminaryContent(preliminary: PreliminaryContext): boolean {
  return (
    preliminary.statedVerbatim.length > 0 ||
    preliminary.assumed.length > 0 ||
    preliminary.materialUnknowns.length > 0 ||
    preliminary.deferrableUnknowns.length > 0 ||
    preliminary.warnings.length > 0
  )
}

export function PreliminaryContextPanel({ preliminary }: { preliminary: PreliminaryContext }) {
  // A section Memory did not compose is not a project with nothing preliminary
  // about it. Saying so beats rendering nothing, which reads as reassurance
  // derived from our own ignorance.
  if (!preliminary.composed) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Stated, assumed, and undecided</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p role="alert" className="text-[12.5px] leading-relaxed text-ink-muted">
            KAE-Memory did not answer for this section, so what was said, what KAE assumed, and what
            nobody has decided could not be read. This is not a statement that there is nothing.
          </p>
        </PanelBody>
      </Panel>
    )
  }

  if (!hasPreliminaryContent(preliminary)) return null

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Stated, assumed, and undecided</PanelTitle>
        {preliminary.isPreliminary && (
          // The one honest headline for a project in this state, and the reason
          // Memory computes the flag at all.
          <Badge tone="attention">Rests on unconfirmed material</Badge>
        )}
      </PanelHeader>
      <PanelBody className="space-y-6">
        {preliminary.warnings.length > 0 && (
          <ul className="space-y-1.5">
            {preliminary.warnings.map((warning) => (
              <li key={warning} className="text-[12.5px] leading-relaxed text-attention">
                {warning}
              </li>
            ))}
          </ul>
        )}

        {preliminary.statedVerbatim.length > 0 && (
          <section>
            <Heading>What was actually said</Heading>
            <Note>
              Recorded as written, never paraphrased. Everything else on this page is KAE&rsquo;s
              reading of these sentences — which is the part most likely to be wrong.
            </Note>
            <ul className="mt-3 space-y-2.5">
              {preliminary.statedVerbatim.map((stated) => (
                <li
                  key={stated.messageId}
                  className="border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink"
                >
                  {stated.text}
                  <span className="mt-1 block text-[11.5px] text-ink-subtle">
                    {stated.actorType} · {stated.messageType}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {preliminary.assumed.length > 0 && (
          <section>
            <Heading>What KAE assumed</Heading>
            <Note>
              Nobody said these. KAE inferred them to keep going, and each one is wrong until
              somebody agrees with it.
            </Note>
            <ul className="mt-3 space-y-3">
              {preliminary.assumed.map((assumption) => (
                <AssumptionRow key={assumption.assumptionId} assumption={assumption} />
              ))}
            </ul>
          </section>
        )}

        {preliminary.materialUnknowns.length > 0 && (
          <section>
            <Heading>Nobody has decided</Heading>
            <Note>
              These change what gets built rather than how it is configured, so they are worth
              deciding now.
            </Note>
            <ul className="mt-3 space-y-2.5">
              {preliminary.materialUnknowns.map((unknown) => (
                <UnknownRow key={unknown.clarificationId} unknown={unknown} />
              ))}
            </ul>
          </section>
        )}

        {preliminary.deferrableUnknowns.length > 0 && (
          <section>
            <Heading>Open, and safe to leave for now</Heading>
            <Note>
              Still undecided. Shown rather than hidden because &ldquo;not yet&rdquo; is an answer
              somebody gave, and a list that quietly drops them is a project that has forgotten what
              it postponed.
            </Note>
            <ul className="mt-3 space-y-2.5">
              {preliminary.deferrableUnknowns.map((unknown) => (
                <UnknownRow key={unknown.clarificationId} unknown={unknown} />
              ))}
            </ul>
          </section>
        )}
      </PanelBody>
    </Panel>
  )
}

function AssumptionRow({ assumption }: { assumption: AssumedEntry }) {
  return (
    <li className="rounded-md border border-line bg-surface-sunken px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-ink">{assumption.subject}</span>
        {/* Material means architectural, unsafe, or irreversible — Memory's own
            test for "worth a person's time". Not every assumption gets a badge,
            because a page where everything is flagged flags nothing. */}
        {assumption.material && <Badge tone="attention">Architectural</Badge>}
        {!assumption.reversible && <Badge tone="blocking">Hard to reverse</Badge>}
      </div>
      {/* Memory's sentence, rendered unedited. It already contains the value,
          the reason, and the consequence of being wrong, written to be read —
          and a component that rebuilds it from the parts is one that will
          disagree with Memory the first time either changes. */}
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{assumption.disclosure}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-subtle">
        {assumption.acceptedBy
          ? `Accepted by ${assumption.acceptedBy}`
          : 'Nobody has agreed to this yet'}
      </p>
    </li>
  )
}

function UnknownRow({ unknown }: { unknown: UnknownEntry }) {
  // **The question first** (`NAV-01` N4). `question:partial_area:problem_and_value:-`
  // led each row, so a panel about what the project has not decided opened with
  // a Memory key. It is a support handle rather than a fact about the project:
  // available on hover and to a screen reader, not occupying the line a person
  // reads.
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1" title={unknown.clarificationId}>
      <span className="sr-only">Reference {unknown.clarificationId}</span>
      <span className="text-[13px] leading-relaxed text-ink">{unknown.question}</span>
      <SeverityBadge severity={unknown.severity} />
      {/* `open` means nobody was asked. Anything else means somebody was asked
          and did not decide — a different situation, and one Memory requires to
          stay visible (N36). Rendering both as "open" loses the distinction
          between a project that has not looked and one that looked and moved
          on. */}
      <span className="text-[11.5px] text-ink-subtle">
        {unknown.disposition === 'open' ? 'Not yet asked' : `Asked · ${unknown.disposition}`}
      </span>
    </li>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12.5px] font-medium tracking-tight text-ink">{children}</h3>
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11.5px] leading-relaxed text-ink-subtle">{children}</p>
}
