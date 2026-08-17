/**
 * Where the pipeline's raw numbers live, for the people who need them.
 *
 * Doc 17 (`EPI-7`, `D-156`): Studio must not present extraction and
 * classification counts as a person's work — *"803 candidates await review. 692
 * items need classification"* is the sentence it names as wrong — while those
 * same numbers may remain available in an advanced Knowledge Health /
 * Diagnostics view for developers and operators.
 *
 * ## What this page is, and what it is not
 *
 * It is the **destination**, built first. Nothing has been removed from Reviews,
 * Requirements, Sources or the Dashboard by its existence: a count deleted from
 * a primary surface before a working home exists is information the estate
 * computed and somebody reads, thrown away. Which counts move, and what each
 * surface says in their place, is the second half of `EPI-7`.
 *
 * It reports **no number the projection does not carry**. No health score, no
 * percentage, no ratio — a diagnostics page inventing a figure is the one
 * failure this surface cannot afford, because its entire claim is that these are
 * the raw values and not a reading of them.
 */

import { Activity } from 'lucide-react'

import { PageLayout } from '@/components/project/PageLayout'
import {
  Badge,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { useProjection } from '@/hooks/useProject'
import { projectCounts } from '@/lib/counts'
import { contentLossClauses } from '@/lib/coverage'

// `value` takes a string so an unreported figure can render as an em dash. On
// this page the difference between zero and unreported is the point, and a
// number type forces one of them to impersonate the other (`D-232`).
function Figures({ figures }: { figures: { label: string; value: number | string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">{figure.label}</dt>
          <dd className="mt-0.5 text-[20px] font-semibold tabular-nums text-ink">{figure.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Diagnostics() {
  const { data: projection, isLoading } = useProjection()

  if (isLoading || !projection) {
    return (
      <PageLayout title="Knowledge health">
        <Skeleton className="h-80" />
      </PageLayout>
    )
  }

  const counts = projectCounts(projection)
  const coverage = projection.extractionCoverage
  const classification = projection.classification

  return (
    <PageLayout
      title="Knowledge health"
      lead="The pipeline's own numbers, for operators. These are counts of what extraction produced — they are not a list of things anybody has to do, and nothing here is a measure of how the project is going."
      actions={
        <Badge tone="neutral">
          <Activity className="size-3" aria-hidden="true" />
          operator view
        </Badge>
      }
    >
      <div className="space-y-6">
        <Panel>
          <PanelHeader>
            <PanelTitle>Extracted statements</PanelTitle>
            <span className="text-[11.5px] text-ink-subtle">
              What KAE recorded, by pipeline state
            </span>
          </PanelHeader>
          <PanelBody>
            <Figures
              figures={[
                { label: 'Statements', value: counts.statements },
                { label: 'Proposed', value: counts.awaitingDecision },
                { label: 'Confirmed requirements', value: counts.confirmedRequirements },
                { label: 'Open questions', value: counts.openQuestions },
              ]}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>What a review found</PanelTitle>
            {/* Findings and proposed statements are different sets of different
                sizes (`D-96`), and a page that puts them side by side is the
                one place that difference is legible rather than confusing. */}
            <span className="text-[11.5px] text-ink-subtle">
              Findings are what a review produced, and are not the proposed statements above
            </span>
          </PanelHeader>
          <PanelBody>
            <Figures
              figures={[
                { label: 'Findings', value: counts.reviewFindings },
                { label: 'Critical findings', value: counts.criticalReviewFindings },
                { label: 'Contradictions', value: counts.unresolvedContradictions },
                { label: 'Open decisions', value: counts.openDecisions },
              ]}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Reading the sources</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {/* Absent and zero are different facts, and on this page the
                difference is the point: a projection carrying no coverage has
                not reported it, which is not the same as having abandoned
                nothing. */}
            {coverage ? (
              <>
                <Figures
                  figures={[
                    { label: 'Sections read', value: coverage.succeeded },
                    { label: 'Sections abandoned', value: coverage.abandoned },
                    // The other failure, and the reason this panel could show
                    // "Sections abandoned: 0" beside a warning that content was
                    // lost (`AUD-024`, `D-232`).
                    { label: 'Sections never read', value: coverage.notIngested ?? '—' },
                    { label: 'Sections submitted', value: coverage.total ?? '—' },
                  ]}
                />
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
                  {coverage.complete
                    ? 'Every section KAE attempted was read.'
                    : contentLossClauses(coverage).join(' ') +
                      ' So what is recorded is drawn from part of the sources rather than all of them.'}
                </p>
                {(coverage.notIngested === null || coverage.total === null) && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-subtle">
                    An em dash is a figure this backend did not report, which is not the same as
                    zero.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                This projection carries no extraction coverage, so how much of the sources was read
                is unreported — which is not the same as everything having been read.
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Classification</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {classification ? (
              <div className="space-y-2 text-[12.5px] leading-relaxed text-ink-muted">
                <p>
                  Engine: {classification.engine ?? 'unreported'}
                  {classification.degraded ? ' — running degraded' : ''}
                </p>
                {/* Memory's own sentence, never rewritten on the way through:
                    it is the one statement here about limits that Studio is not
                    entitled to paraphrase. */}
                {classification.note && <p>{classification.note}</p>}
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                This projection carries no classification state, so which engine read the sources is
                unreported.
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>
    </PageLayout>
  )
}
