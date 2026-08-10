import { TriangleAlert } from 'lucide-react'
import { PageLayout } from '@/components/project/PageLayout'
import { StatusBadge } from '@/components/project/statusVocabulary'
import { CapabilityNote } from '@/components/project/CapabilityNote'
import {
  Badge,
  Mono,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Skeleton,
} from '@/components/ui/primitives'
import { useProjection } from '@/hooks/useProject'
import type { ModuleInterfaceRef, ProjectModule } from '@/domain/types'

interface InterfaceEntry {
  iface: ModuleInterfaceRef
  owner: ProjectModule | undefined
  consumers: ProjectModule[]
}

/** One row per interface, keyed by its owner rather than by each reference. */
function collectInterfaces(modules: ProjectModule[]): InterfaceEntry[] {
  const byId = new Map<string, InterfaceEntry>()

  for (const module of modules) {
    for (const iface of module.interfaces) {
      const existing = byId.get(iface.id)
      if (existing) {
        if (iface.direction === 'exposes') existing.iface = iface
        else existing.consumers.push(module)
        continue
      }
      byId.set(iface.id, {
        iface,
        owner: modules.find((m) => m.id === iface.ownerModuleId),
        consumers: iface.direction === 'consumes' ? [module] : [],
      })
    }
  }

  return [...byId.values()].sort((a, b) => a.iface.id.localeCompare(b.iface.id))
}

export function Interfaces() {
  const { data: projection, isLoading } = useProjection()

  if (isLoading || !projection) {
    return (
      <PageLayout title="Interfaces">
        <Skeleton className="h-80" />
      </PageLayout>
    )
  }

  const entries = collectInterfaces(projection.modules)
  const undefinedCount = entries.filter(
    (e) => e.iface.protocol === 'Undecided' || e.iface.status === 'contested',
  ).length

  return (
    <PageLayout
      title="Interfaces"
      wide
      lead="How the modules and external systems talk, and who owns each contract. An interface with an undefined contract cannot be implemented against, regardless of how complete its module looks."
      actions={
        undefinedCount > 0 ? (
          <Badge tone="attention">
            <TriangleAlert className="size-3" aria-hidden="true" />
            {undefinedCount} contracts undefined
          </Badge>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* The register is `collectInterfaces(projection.modules)`, so when
            module derivation is unavailable this page has nothing to show for
            a reason that has nothing to do with the project's interfaces. */}
        {projection.modulesGap && (
          <CapabilityNote
            reason={`Interfaces are read from module boundaries, and modules are not derived. ${projection.modulesGap.reason}`}
          />
        )}
        <Panel>
          <PanelHeader>
            <PanelTitle>Interface register</PanelTitle>
            <Badge tone="neutral">{entries.length}</Badge>
          </PanelHeader>
          <PanelBody className="px-0 py-0">
            <ul className="divide-y divide-line">
              {entries.map(({ iface, owner, consumers }) => (
                <li key={iface.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium text-ink">{iface.name}</span>
                        <Mono>{iface.id}</Mono>
                        <StatusBadge status={iface.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-muted">
                        <span>
                          Owner <Mono className="text-ink">{iface.ownerModuleId}</Mono>
                          {owner && <span className="text-ink-subtle"> · {owner.name}</span>}
                        </span>
                        <span
                          className={
                            iface.protocol === 'Undecided' ? 'text-attention' : 'text-ink-muted'
                          }
                        >
                          {iface.protocol}
                        </span>
                        <span>{iface.synchronicity}</span>
                        {consumers.length > 0 && (
                          <span>
                            Consumed by{' '}
                            {consumers.map((c, i) => (
                              <span key={c.id} className="font-mono text-[11.5px]">
                                {i > 0 && ', '}
                                {c.key}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      {iface.note && (
                        <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-attention">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          {iface.note}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>

        {/* A hardcoded nine-item integration questionnaire used to sit here,
            introduced as what is "not yet established for any interface" and
            closing with a sentence about what no interface records. It is
            generic integration vocabulary, so the fixture-content scan did not
            catch it, and it read as analysis of the reader's project when it
            was page copy (AUD-020).

            What is true is simpler and is said above: this register is derived
            from module interfaces, and module derivation does not exist. */}
      </div>
    </PageLayout>
  )
}
