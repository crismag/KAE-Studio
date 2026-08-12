/**
 * `ARC-1b` — the drawing says the same thing the list says, and no more.
 *
 * The owner asked for *"graphical and textual information about the
 * architecture and modules"*. `/dependencies` is the text. This is the picture,
 * and the risk a picture carries is the opposite of the risk a list carries: a
 * diagram states a great deal through position, size and line style, and a
 * reader will find meaning in any variation it offers them.
 *
 * So these hold two things. That the drawing agrees with the graph — same
 * modules, same edges, same order. And that it does not say anything Memory
 * has not said.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ArchitectureDiagram } from './ArchitectureDiagram'
import { architecture as fixture } from '@/services/mock/fixtures/ministryReporting'
import type { ArchitectureGraph } from '@/domain/types'

function draw(graph: ArchitectureGraph = fixture) {
  return render(<ArchitectureDiagram graph={graph} />)
}

describe('the drawing agrees with the graph', () => {
  it('draws every module', () => {
    const { container } = draw()

    expect(container.querySelectorAll('rect')).toHaveLength(fixture.modules.length)
    for (const module of fixture.modules) {
      expect(screen.getByText(module.key)).toBeInTheDocument()
    }
  })

  it('draws one arrow per dependency, and none for a statement edge', () => {
    // `satisfies` runs to a statement, which has no box. An arrow to a module
    // would say this module depends on that one, and it does not.
    const { container } = draw()

    const dependencies = fixture.edges.filter(
      (edge) => edge.relation === 'depends_on' && edge.targetModule,
    )
    expect(container.querySelectorAll('line')).toHaveLength(dependencies.length)
  })

  it('draws no arrow for a relationship that is not a dependency', () => {
    // Written after the first version of this file passed with the relation
    // filter removed. A `satisfies` edge has no box to point at, so the
    // placement lookup dropped it anyway and the assertion below proved
    // nothing about the filter it was aimed at.
    //
    // `exposes` runs module to module and **would** be drawn. It is a real
    // relationship and it is not a build-order one, and an arrow that means
    // two different things is an arrow that means neither.
    const { container } = draw({
      ...fixture,
      edges: [
        ...fixture.edges,
        {
          source: 'reporting',
          relation: 'exposes',
          targetModule: 'publication',
          targetKnowledge: null,
        },
      ],
    })

    const dependencies = fixture.edges.filter(
      (edge) => edge.relation === 'depends_on' && edge.targetModule,
    )
    expect(container.querySelectorAll('line')).toHaveLength(dependencies.length)
  })

  it('puts a dependency above what depends on it', () => {
    // The one thing position is allowed to mean. `reporting` depends on
    // `identity`, so `identity` is higher up the drawing.
    const { container } = draw()

    const box = (key: string) => {
      const label = [...container.querySelectorAll('text')].find((node) => node.textContent === key)
      return Number(label?.getAttribute('y'))
    }

    expect(box('identity')).toBeLessThan(box('reporting'))
    expect(box('reporting')).toBeLessThan(box('approval'))
  })

  it('gives its arrows a direction', () => {
    // An unarrowed line states a relationship and hides which way it runs,
    // which is the whole content of a dependency.
    const { container } = draw()

    for (const line of container.querySelectorAll('line')) {
      expect(line.getAttribute('marker-end')).toBeTruthy()
    }
  })
})

describe('the drawing claims nothing Memory has not said', () => {
  it('draws every box the same size', () => {
    // Memory holds nothing that would justify making one module bigger, and a
    // reader will read size as importance the moment it varies.
    const { container } = draw()

    const sizes = new Set(
      [...container.querySelectorAll('rect')].map(
        (rect) => `${rect.getAttribute('width')}x${rect.getAttribute('height')}`,
      ),
    )
    expect(sizes.size).toBe(1)
  })

  it('marks an unconfirmed module as unconfirmed and nothing else', () => {
    const { container } = draw()

    const dashed = [...container.querySelectorAll('rect')].filter((rect) =>
      rect.getAttribute('stroke-dasharray'),
    )
    const unconfirmed = fixture.modules.filter((module) => module.status !== 'confirmed')

    expect(dashed).toHaveLength(unconfirmed.length)
  })

  it('says what position means, so a reader does not decide for themselves', () => {
    draw()

    expect(screen.getByText(/nothing else in this drawing means anything/i)).toBeInTheDocument()
  })

  it('is described for a reader who cannot see it', () => {
    draw()

    expect(screen.getByRole('img')).toHaveAccessibleName(/build order/i)
  })

  it('draws nothing rather than an empty frame', () => {
    // An empty bordered drawing on a project with no modules reads as a
    // diagram that failed to load.
    const { container } = draw({
      available: true,
      reason: '',
      modules: [],
      edges: [],
      buildOrder: [],
      note: '',
    })

    expect(container).toBeEmptyDOMElement()
  })
})
