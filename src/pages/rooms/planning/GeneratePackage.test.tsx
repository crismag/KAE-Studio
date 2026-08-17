/**
 * What the generation surface must say, not merely do.
 *
 * Every test here is about a sentence on screen. The pipeline is tested
 * elsewhere; what this covers is the part a user reads before agreeing to
 * something — and the states an interface built against a happy path would
 * never render:
 *
 *   - a blocked file names the decision it is waiting on;
 *   - selecting a blocked file does not make it generatable;
 *   - a preview distinguishes an addition from an overwrite, in words;
 *   - approval is a separate act from publication.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { GeneratePackage } from './GeneratePackage'
import type { ArtifactPublication, GenerationRun } from '@/domain/types'

function renderPanel(services = createMockServices()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <GeneratePackage />
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

/**
 * The prototype's run, returned in a state the prototype never reaches.
 *
 * Patched rather than added to `mockServices`, because nothing in the estate
 * produces a non-terminal run and a fixture that did would be asserting the
 * product can do something it cannot. What is under test is what the page says
 * when one arrives, not that one arrives.
 */
function servicesReturningRun(status: GenerationRun['status']) {
  const services = createMockServices()
  const generate = services.pipeline.generate.bind(services.pipeline)
  services.pipeline.generate = async (projectId, planId, key) => ({
    ...(await generate(projectId, planId, key)),
    status,
  })
  return services
}

/**
 * The prototype's publication, returned with the fields under test patched.
 *
 * `filesWritten` is what the *publisher* wrote, and the mock cannot produce the
 * three cases that make it worth rendering — GitHub omitting an unchanged file,
 * the download archive's generated `manifest.json`, and a success that wrote
 * nothing. Patched here rather than in `mockServices`, for the reason the run
 * helper above gives.
 */
function servicesPublishing(patch: Partial<ArtifactPublication>) {
  const services = createMockServices()
  const publish = services.pipeline.publish.bind(services.pipeline)
  services.pipeline.publish = async (input) => ({ ...(await publish(input)), ...patch })
  return services
}

async function publishADownload(user: ReturnType<typeof userEvent.setup>) {
  await proposePlan(user, 'minimal-agent-context')
  await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
  await screen.findByText(/validated and publishable/i)
  await user.click(await screen.findByRole('button', { name: /see what would change/i }))
  await user.click(await screen.findByRole('button', { name: /approve these/i }))
  await user.click(await screen.findByRole('button', { name: /^publish$/i }))
}

async function proposePlan(user: ReturnType<typeof userEvent.setup>, profile: string) {
  // Wait for the *option*, not the select. The select renders immediately and
  // empty while the profiles load, so waiting on it passes before there is
  // anything to choose.
  const select = await screen.findByLabelText(/package profile/i)
  await waitFor(() =>
    expect(within(select).getByRole('option', { name: new RegExp(profile) })).toBeInTheDocument(),
  )
  await user.selectOptions(select, profile)
  await user.click(screen.getByRole('button', { name: /propose a plan/i }))
}

beforeEach(() => resetPrototypeState())

describe('GeneratePackage', () => {
  it('says planning generates nothing, before anything is planned', async () => {
    renderPanel()
    expect(await screen.findByText(/proposing generates nothing/i)).toBeInTheDocument()
  })

  it('shows the revision a plan was proposed against', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'minimal-agent-context')

    expect(await screen.findByText(/^memory:\d+$/)).toBeInTheDocument()
  })

  it('names the decision a blocked file is waiting on', async () => {
    // The most product-relevant behaviour on the screen. A UI that hid this
    // row would discard the whole reason a plan is a proposal to argue with.
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'full-project-foundation')

    expect(
      await screen.findByText(/No repository has been chosen for this project/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/waiting on a decision/i)).toBeInTheDocument()
  })

  it('will not let a blocked file be selected for generation', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'full-project-foundation')

    const checkbox = await screen.findByLabelText(/include integration-specification/i)
    expect(checkbox).toBeDisabled()
  })

  it('counts only the files it can actually generate', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'full-project-foundation')

    // Four in the profile, one blocked.
    expect(await screen.findByRole('button', { name: /generate 3 files/i })).toBeInTheDocument()
  })

  it('reports the package and its source revision after generating', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')

    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))

    expect(await screen.findByText(/validated and publishable/i)).toBeInTheDocument()
  })

  it('says in words that a preview would overwrite existing files', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')
    // Naming the repository is now part of choosing GitHub. It used to be a
    // hardcoded empty string behind a button reading "create pull request"
    // (AUD-019), so these tests could reach a preview without saying where.
    await user.type(await screen.findByLabelText(/repository/i), 'crismag/kae-artifacts-proof')
    await user.click(screen.getByRole('button', { name: /see what would change/i }))

    // Not only the badge. "Approve" against a list of filenames is agreement to
    // something the user was never told.
    expect(await screen.findByText(/current content will be overwritten/i)).toBeInTheDocument()
  })

  it('warns that a moved destination invalidates the approval', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')
    // Naming the repository is now part of choosing GitHub. It used to be a
    // hardcoded empty string behind a button reading "create pull request"
    // (AUD-019), so these tests could reach a preview without saying where.
    await user.type(await screen.findByLabelText(/repository/i), 'crismag/kae-artifacts-proof')
    await user.click(screen.getByRole('button', { name: /see what would change/i }))

    expect(await screen.findByText(/stops being valid and nothing is written/i)).toBeInTheDocument()
  })

  it('requires approval as its own act before offering to publish', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.click(await screen.findByRole('button', { name: /see what would change/i }))

    // No publish control until something has been approved.
    await screen.findByRole('button', { name: /approve these/i })
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /approve these/i }))

    expect(await screen.findByRole('button', { name: /^publish$/i })).toBeInTheDocument()
    expect(screen.getByText(/approved by/i)).toBeInTheDocument()
  })

  it('offers a pull request rather than an export, for a repository', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')
    // Naming the repository is now part of choosing GitHub. It used to be a
    // hardcoded empty string behind a button reading "create pull request"
    // (AUD-019), so these tests could reach a preview without saying where.
    await user.type(await screen.findByLabelText(/repository/i), 'crismag/kae-artifacts-proof')
    await user.click(screen.getByRole('button', { name: /see what would change/i }))
    await user.click(await screen.findByRole('button', { name: /approve these/i }))

    expect(
      await screen.findByRole('button', { name: /approve & create pull request/i }),
    ).toBeInTheDocument()
  })

  it('discards a stale approval when the plan changes underneath it', async () => {
    // An approval names one package. Leaving it on screen after a re-plan would
    // offer a publish the service would refuse — correctly, and confusingly.
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.click(await screen.findByRole('button', { name: /see what would change/i }))
    await user.click(await screen.findByRole('button', { name: /approve these/i }))
    await screen.findByText(/approved by/i)

    await user.click(screen.getByRole('button', { name: /propose a plan/i }))

    await waitFor(() => expect(screen.queryByText(/approved by/i)).not.toBeInTheDocument())
  })

  it('reports which destinations this deployment cannot reach, and why', async () => {
    const user = userEvent.setup()
    renderPanel()
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    const select = await screen.findByLabelText(/destination/i)

    // Present and disabled, with a reason — not silently absent, which would be
    // indistinguishable from a destination that does not exist.
    const s3 = within(select).getByRole('option', { name: /s3 — no S3 connection configured/i })
    expect(s3).toBeDisabled()
  })
})

describe('a destination has to be named', () => {
  it('will not preview a repository nobody has named', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.selectOptions(await screen.findByLabelText(/destination/i), 'github')

    // AUD-019. `target` and `targetPath` were hardcoded empty strings, and the
    // approval button still read "Approve & create pull request" — a pull
    // request against nothing, offered as though it were configured.
    expect(screen.getByRole('button', { name: /see what would change/i })).toBeDisabled()
    expect(await screen.findByText(/name the repository/i)).toBeInTheDocument()
  })

  it('needs no target for a download, which writes nowhere', async () => {
    const user = userEvent.setup()
    renderPanel()

    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)

    // The distinction that keeps the requirement honest: it is about writing to
    // somewhere somebody owns, not about ceremony before every action.
    expect(screen.getByRole('button', { name: /see what would change/i })).toBeEnabled()
  })
})

describe('a run that neither succeeded nor failed', () => {
  // `D-203`. The page had two arms and KAE-Artifacts' vocabulary has five
  // words, so a run in any other state drew nothing at all: steps 1 and 2, a
  // Generate button already pressed, and no third step to explain the silence.
  it.each([
    ['cancelled', /cancelled before it finished/i],
    ['running', /still running/i],
    ['accepted', /has not finished/i],
  ] as const)('says what happened when a run comes back %s', async (status, sentence) => {
    const user = userEvent.setup()
    renderPanel(servicesReturningRun(status))

    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))

    expect(await screen.findByText(sentence)).toBeInTheDocument()
    // And does not claim files that a run in this state has not produced.
    expect(screen.queryByText(/^3 · Package$/)).not.toBeInTheDocument()
  })
})

describe('an approval says how long it lasts', () => {
  /**
   * `D-208`. `expiresAt` reached the page and was read by nothing, so a person
   * learned the approval had lapsed from an `approval_expired` 409 after
   * pressing Publish — a condition `Approval.check` (`domain/approval.py:113`)
   * can state before it refuses.
   */
  async function approveADownload(user: ReturnType<typeof userEvent.setup>) {
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
    await user.click(await screen.findByRole('button', { name: /see what would change/i }))
    await user.click(await screen.findByRole('button', { name: /approve these/i }))
    await screen.findByText(/approved by/i)
  }

  it('says the deadline before Publish is pressed, not after', async () => {
    const user = userEvent.setup()
    renderPanel()

    await approveADownload(user)

    expect(screen.getByText(/valid until .* UTC/i)).toBeInTheDocument()
    // The remedy the publisher itself gives, so the sentence is actionable.
    expect(screen.getByText(/preview and approve again/i)).toBeInTheDocument()
  })

  it('says nothing rather than "valid until —" on a timestamp it cannot read', async () => {
    const user = userEvent.setup()
    const services = createMockServices()
    const approve = services.pipeline.approve.bind(services.pipeline)
    services.pipeline.approve = async (input) => ({ ...(await approve(input)), expiresAt: '' })
    renderPanel(services)

    await approveADownload(user)

    expect(screen.queryByText(/valid until/i)).not.toBeInTheDocument()
  })
})

describe('a publication says which files it wrote', () => {
  /**
   * `D-207`. All three publishers compute `files_written`, it survives every hop
   * into `ArtifactPublication`, and no component read it — the panel said a
   * count instead (*"4 files plus a manifest, 18211 bytes"*). The preview cannot
   * substitute: GitHub drops every `unchanged` file before committing, the
   * download archive adds a `manifest.json` that appears in no change row, and
   * both publishers succeed with an empty list when everything already matched.
   */

  it('names the paths, not just how many there were', async () => {
    const user = userEvent.setup()
    renderPanel(servicesPublishing({ filesWritten: ['docs/one.md', 'docs/two.md'] }))

    await publishADownload(user)

    expect(await screen.findByText('docs/one.md')).toBeInTheDocument()
    expect(screen.getByText('docs/two.md')).toBeInTheDocument()
    expect(screen.getByText('2 files written')).toBeInTheDocument()
  })

  it('names the file the preview could not have named', async () => {
    // `manifest.json` is generated into the archive by `DownloadPublisher` and
    // is in no change row, so this is the path a person would otherwise find
    // only by unzipping.
    const user = userEvent.setup()
    renderPanel(servicesPublishing({ filesWritten: ['docs/one.md', 'manifest.json'] }))

    await publishADownload(user)

    expect(await screen.findByText('manifest.json')).toBeInTheDocument()
  })

  it('says nothing was written when nothing was, rather than an empty heading', async () => {
    // Both `github.py` and `s3.py` succeed with an empty tuple when every file
    // already matches. That is the one case where the absence is the fact.
    const user = userEvent.setup()
    renderPanel(servicesPublishing({ filesWritten: [] }))

    await publishADownload(user)

    expect(await screen.findByText(/no files were written/i)).toBeInTheDocument()
    expect(screen.queryByText(/files written$/)).not.toBeInTheDocument()
  })

  it('claims nothing about files on a publication that failed', async () => {
    // A publisher raises before returning, so the field is absent rather than
    // empty; a heading with nothing under it would suggest a partial write.
    const user = userEvent.setup()
    renderPanel(servicesPublishing({ status: 'failed', filesWritten: [] }))

    await publishADownload(user)

    expect(await screen.findByText(/not published/i)).toBeInTheDocument()
    expect(screen.queryByText(/no files were written/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/files written$/)).not.toBeInTheDocument()
  })

  /*
   * `D-209`. Publishing to `download` left the bytes on the publisher and gave
   * a person no way to fetch them, which is the canned success `AUD-029`
   * removed from KAE-Artifacts surviving one hop later.
   */

  it('offers the archive after a download publication, and says it is not kept', async () => {
    const user = userEvent.setup()
    renderPanel()

    await publishADownload(user)

    expect(await screen.findByRole('button', { name: /download the archive/i })).toBeInTheDocument()
    // Before the control is pressed, not after the 404 it predicts.
    expect(screen.getByText(/only until it restarts/i)).toBeInTheDocument()
  })

  it('does not offer an archive for a destination that kept the files elsewhere', async () => {
    // GitHub and S3 wrote to somewhere the person named, and `Reference`
    // already points at it. There is nothing here to hand back.
    const user = userEvent.setup()
    renderPanel(
      servicesPublishing({
        destination: {
          type: 'github',
          mode: 'pull_request',
          target: 'owner/repo',
          targetPath: 'docs/',
          baseBranch: 'main',
        },
      }),
    )

    await publishADownload(user)

    await screen.findByText(/^published$/i)
    expect(screen.queryByRole('button', { name: /download the archive/i })).not.toBeInTheDocument()
  })

  it('offers no archive for a publication that failed', async () => {
    const user = userEvent.setup()
    renderPanel(servicesPublishing({ status: 'failed' }))

    await publishADownload(user)

    await screen.findByText(/not published/i)
    expect(screen.queryByRole('button', { name: /download the archive/i })).not.toBeInTheDocument()
  })

  it('asks for the published package by identifier, and saves what comes back', async () => {
    const user = userEvent.setup()
    const services = createMockServices()
    const asked: string[] = []
    services.pipeline.downloadArchive = async (packageId) => {
      asked.push(packageId)
      return new Blob(['PK'], { type: 'application/zip' })
    }
    // jsdom has neither, and navigating an anchor is not implemented there.
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:zip', configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true })
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPanel(services)
    await publishADownload(user)
    await user.click(await screen.findByRole('button', { name: /download the archive/i }))

    await waitFor(() => expect(clicked).toHaveBeenCalled())
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatch(/^pkg/)
    clicked.mockRestore()
  })

  it('renders a refusal in the words it arrived in, rather than nothing', async () => {
    // The prototype holds fixtures and not bytes, and says so — which is also
    // what a KAE-Artifacts restart looks like on a live deployment.
    const user = userEvent.setup()
    renderPanel()

    await publishADownload(user)
    await user.click(await screen.findByRole('button', { name: /download the archive/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/holds no published bytes/i)
  })
})

/*
 * `D-210`. Every finding carries the artifact it is about and the panel drew
 * severity, message and remedy — so on a package of a dozen documents "a
 * section is empty" named none of them.
 */
describe('a validation finding says what it is about', () => {
  async function generate(user: ReturnType<typeof userEvent.setup>) {
    await proposePlan(user, 'minimal-agent-context')
    await user.click(await screen.findByRole('button', { name: /generate 2 files/i }))
    await screen.findByText(/validated and publishable/i)
  }

  /*
   * The finding's own line, not the panel. The plan rows above it show the
   * same paths, so a bare text query would pass on the file list while the
   * finding still named nothing.
   */
  function findingLine() {
    return screen.findByText(
      (_, element) =>
        element?.tagName === 'P' && /some sections have nothing/i.test(element.textContent ?? ''),
    )
  }

  function servicesFinding(artifactId: string) {
    const services = createMockServices()
    const validate = services.pipeline.validate.bind(services.pipeline)
    services.pipeline.validate = async (packageId) => {
      const result = await validate(packageId)
      return { ...result, findings: result.findings.map((f) => ({ ...f, artifactId })) }
    }
    return services
  }

  it('names the file, from the manifest the finding only points at', async () => {
    const user = userEvent.setup()
    renderPanel()

    await generate(user)

    expect(
      within(await findingLine()).getByText('docs/context/PROJECT_CONTEXT.md'),
    ).toBeInTheDocument()
  })

  it('says a finding about the package is about the package, rather than nothing', async () => {
    // KAE-Artifacts leaves `artifact_id` empty on its limit and integrity
    // checks. Beside findings that name a file, a blank would read as one
    // nobody bothered to name.
    const user = userEvent.setup()
    renderPanel(servicesFinding(''))

    await generate(user)

    expect(within(await findingLine()).getByText(/across the whole package/i)).toBeInTheDocument()
  })

  it('shows an identifier the manifest cannot explain, rather than dropping it', async () => {
    // Dropping it would attribute a finding about one file to the package,
    // which is the one wrong sentence available here.
    const user = userEvent.setup()
    renderPanel(servicesFinding('art_missing'))

    await generate(user)

    const line = within(await findingLine())
    expect(line.getByText('art_missing')).toBeInTheDocument()
    expect(line.queryByText(/across the whole package/i)).not.toBeInTheDocument()
  })
})
