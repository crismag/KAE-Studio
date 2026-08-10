/**
 * Deterministic fixture: the "Ministry Reporting Workspace" sample project.
 *
 * PROTOTYPE DATA ONLY. Nothing here was produced by KAE-Memory, an AI provider,
 * or any extraction run. It is hand-authored to exercise the interface with
 * realistic engineering content.
 *
 * Presentation components must never import this file. It is reachable only
 * through the mock service adapters.
 */

import type {
  AcceptanceTest,
  ConversationMessage,
  Deliverable,
  InterviewSession,
  OpenDecision,
  Project,
  ProjectDefinition,
  ProjectHealth,
  ProjectModule,
  PublishTarget,
  Requirement,
  ReviewFinding,
} from '@/domain/types'

export const MEMORY_REVISION = 47

export const project: Project = {
  id: 'proj-ministry-reporting',
  name: 'Ministry Reporting Workspace',
  phase: 'Requirements forming',
  memoryRevision: MEMORY_REVISION,
  createdAt: '2026-07-28T09:12:00Z',
}

/* ------------------------------------------------------------------ session */

export const interviewSession: InterviewSession = {
  interviewType: 'Business workflow analysis',
  objective:
    'Establish who submits, reviews, and publishes reports, and what each step requires before it may complete.',
  questionsAsked: 11,
  questionsAnswered: 8,
  questionsDeferred: 2,
}

/* ------------------------------------------------------------- conversation */

export const messages: ConversationMessage[] = [
  {
    id: 'msg-001',
    author: 'user',
    body: 'We need a way for ministry leaders to submit monthly reports. Reports should be approved before publication, but we have not decided who approves them.',
    createdAt: '2026-07-28T09:12:00Z',
    syncState: 'acknowledged',
  },
  {
    id: 'msg-002',
    author: 'assistant',
    body: "That gives me a clear starting shape: a recurring submission cycle with a review gate in front of publication. I've recorded the approval step as required, and kept the approver role open rather than assuming it.",
    createdAt: '2026-07-28T09:12:31Z',
    syncState: 'acknowledged',
    understanding: {
      heading: 'What I understand',
      points: [
        'Ministry leaders submit reports each month.',
        'Reports follow an approval step before publication.',
        'The approver role is still an open decision.',
      ],
    },
    question:
      'Who needs to read the published reports: ministry staff only, church leadership, members, or the public?',
    suggestions: [
      'Leadership only',
      'Staff and leadership',
      'Decide later',
      'Why does this matter?',
    ],
    resultingChanges: ['Added 2 requirements', 'Opened 1 decision'],
  },
  {
    id: 'msg-003',
    author: 'user',
    body: 'Pastors and administrators can view published reports. Only ministry leaders can submit them.',
    createdAt: '2026-07-28T09:15:02Z',
    syncState: 'acknowledged',
  },
  {
    id: 'msg-004',
    author: 'assistant',
    body: 'Recorded. That separates submission from readership, which usually means two different permission checks rather than one role list. I want to pin down the editing window next, because it decides whether an approved report can change underneath a reader.',
    createdAt: '2026-07-28T09:15:44Z',
    syncState: 'acknowledged',
    understanding: {
      heading: 'What I understand',
      points: [
        'Ministry leaders are the only submitters.',
        'Pastors and administrators read published reports.',
        'Submission and readership are separate permissions.',
      ],
    },
    question: 'Can a report still be edited after it has been submitted for approval?',
    suggestions: ['Editable until approved', 'Locked at submission', 'Decide later'],
    resultingChanges: ['Added FR-04', 'Added 2 actors'],
  },
  {
    id: 'msg-005',
    author: 'user',
    body: 'Staff can edit a draft until it is submitted. After approval a report cannot be edited at all.',
    createdAt: '2026-07-28T09:18:10Z',
    syncState: 'acknowledged',
  },
  {
    id: 'msg-006',
    author: 'assistant',
    body: "That closes the editing window cleanly, and it has a consequence worth naming: if an approved report can never be edited, then correcting a published mistake needs its own path. I've raised that as a gap rather than inventing a correction workflow.",
    createdAt: '2026-07-28T09:18:52Z',
    syncState: 'acknowledged',
    understanding: {
      heading: 'What I understand',
      points: [
        'Drafts are editable until submission.',
        'Approved reports are immutable.',
        'Correcting a published report has no defined path yet.',
      ],
    },
    question:
      'When a published report turns out to be wrong, should it be withdrawn, superseded by a new version, or corrected in place with an audit note?',
    suggestions: ['Supersede with a new version', 'Withdraw and resubmit', 'Decide later'],
    resultingChanges: ['Added BR-02', 'Opened 1 decision', 'Raised 1 gap'],
  },
]

/* -------------------------------------------------------------- definition */

export const definition: ProjectDefinition = {
  problem:
    'Ministry leaders report monthly on activity, attendance, and challenges. Today those reports arrive as documents and email attachments, are reviewed inconsistently, and are published without a reliable record of who approved what. Leadership cannot tell whether a published report was reviewed, and contributors cannot tell whether their submission was received.',
  value:
    'A single submission path with an explicit approval gate, an auditable record of every decision, and a predictable publication step that leadership can trust.',
  objectives: [
    {
      id: 'OBJ-01',
      text: 'Every published report has an identifiable approver, approval time, and approved version.',
      status: 'confirmed',
    },
    {
      id: 'OBJ-02',
      text: 'Ministry leaders can submit a monthly report without assistance from an administrator.',
      status: 'confirmed',
    },
    {
      id: 'OBJ-03',
      text: 'Leadership can see submission status across all ministries for a reporting period.',
      status: 'proposed',
    },
  ],
  stakeholders: [
    {
      id: 'STK-01',
      name: 'Ministry leader',
      role: 'Submitter',
      interest: 'Submits the monthly report and needs confirmation it was received and reviewed.',
      status: 'confirmed',
    },
    {
      id: 'STK-02',
      name: 'Pastor',
      role: 'Reader',
      interest: 'Reads published reports to understand ministry activity.',
      status: 'confirmed',
    },
    {
      id: 'STK-03',
      name: 'Administrator',
      role: 'Reader, operator',
      interest: 'Reads published reports and maintains the ministry directory.',
      status: 'confirmed',
    },
    {
      id: 'STK-04',
      name: 'Approver',
      role: 'Undetermined',
      interest:
        'Reviews submitted reports and decides publication. Which role holds this authority is an open decision.',
      status: 'contested',
    },
  ],
  inScope: [
    {
      id: 'SCP-01',
      text: 'Monthly report authoring, submission, and draft editing.',
      status: 'confirmed',
    },
    {
      id: 'SCP-02',
      text: 'Approval or rejection of a submitted report, with history.',
      status: 'confirmed',
    },
    {
      id: 'SCP-03',
      text: 'Publication of approved reports to authorised readers.',
      status: 'confirmed',
    },
    {
      id: 'SCP-04',
      text: 'Notification of submitters when a decision is made.',
      status: 'proposed',
    },
  ],
  outOfScope: [
    {
      id: 'SCP-05',
      text: 'Financial or giving records. These stay in the existing finance system.',
      status: 'confirmed',
    },
    { id: 'SCP-06', text: 'Member directory management.', status: 'confirmed' },
    {
      id: 'SCP-07',
      text: 'Public-facing publication outside the organisation.',
      status: 'confirmed',
    },
  ],
  workflows: [
    {
      id: 'WF-01',
      name: 'Monthly report submission',
      status: 'confirmed',
      realizedBy: ['MOD-RPT'],
      steps: [
        { actor: 'Ministry leader', action: 'Opens the reporting period and drafts the report.' },
        { actor: 'Ministry leader', action: 'Saves the draft, editable until submission.' },
        {
          actor: 'Ministry leader',
          action: 'Submits the report for approval, locking further edits.',
        },
      ],
    },
    {
      id: 'WF-02',
      name: 'Approval and publication',
      status: 'confirmed',
      realizedBy: ['MOD-APR', 'MOD-PUB'],
      steps: [
        { actor: 'Approver', action: 'Reviews the submitted report version.' },
        { actor: 'Approver', action: 'Approves or rejects, recording comments.' },
        { actor: 'System', action: 'Makes an approved report eligible for publication.' },
        { actor: 'System', action: 'Returns a rejected report to the submitter for revision.' },
      ],
    },
  ],
  assumptions: [
    {
      id: 'ASM-01',
      text: 'Ministry leaders already have organisational accounts; no separate registration is needed.',
      status: 'proposed',
    },
    {
      id: 'ASM-02',
      text: 'Roughly 25 ministries submit monthly, so throughput is not a design constraint.',
      status: 'proposed',
    },
  ],
  constraints: [
    {
      id: 'CON-01',
      text: 'Identity must come from the existing organisational directory, not a new user store.',
      status: 'confirmed',
    },
    {
      id: 'CON-02',
      text: 'Approval history must be retained for at least seven years for audit.',
      status: 'proposed',
    },
  ],
}

/* ------------------------------------------------------------ requirements */

export const requirements: Requirement[] = [
  {
    id: 'FR-RPT-001',
    category: 'functional',
    statement: 'A ministry leader can create one report per ministry per reporting period.',
    status: 'confirmed',
    moduleId: 'MOD-RPT',
    satisfies: ['OBJ-02'],
    verifiedBy: ['AT-011'],
    updatedAt: '2026-07-28T09:15:02Z',
    trace: [
      {
        evidenceId: 'ev-001',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'We need a way for ministry leaders to submit monthly reports.',
        recordedAt: '2026-07-28T09:12:00Z',
      },
    ],
  },
  {
    id: 'FR-RPT-002',
    category: 'functional',
    statement: 'A draft report remains editable by its author until it is submitted.',
    status: 'confirmed',
    moduleId: 'MOD-RPT',
    satisfies: ['OBJ-02'],
    verifiedBy: ['AT-012'],
    updatedAt: '2026-07-28T09:18:10Z',
    trace: [
      {
        evidenceId: 'ev-005',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'Staff can edit a draft until it is submitted.',
        recordedAt: '2026-07-28T09:18:10Z',
      },
    ],
  },
  {
    id: 'FR-APR-001',
    category: 'functional',
    statement: 'Only an authorised approver may approve a report.',
    status: 'confirmed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-031'],
    updatedAt: '2026-07-28T09:13:40Z',
    trace: [
      {
        evidenceId: 'ev-001',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'Reports should be approved before publication.',
        recordedAt: '2026-07-28T09:12:00Z',
      },
    ],
  },
  {
    id: 'FR-APR-002',
    category: 'functional',
    statement: 'A report cannot be published before it is approved.',
    status: 'confirmed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-032'],
    updatedAt: '2026-07-28T09:13:40Z',
    trace: [
      {
        evidenceId: 'ev-001',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'Reports should be approved before publication.',
        recordedAt: '2026-07-28T09:12:00Z',
      },
    ],
  },
  {
    id: 'FR-APR-003',
    category: 'functional',
    statement:
      'A rejected report returns to its submitter for revision, with the reviewer comments attached.',
    status: 'confirmed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-033'],
    updatedAt: '2026-07-28T09:16:20Z',
    trace: [
      {
        evidenceId: 'ev-004',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'Rejected reports go back to the person who submitted them.',
        recordedAt: '2026-07-28T09:16:20Z',
      },
    ],
  },
  {
    id: 'FR-APR-004',
    category: 'functional',
    statement: 'An approval applies to one specific report version.',
    status: 'confirmed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-034'],
    updatedAt: '2026-07-28T09:18:52Z',
    trace: [
      {
        evidenceId: 'ev-005',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'After approval a report cannot be edited at all.',
        recordedAt: '2026-07-28T09:18:10Z',
      },
    ],
  },
  {
    id: 'FR-PUB-001',
    category: 'functional',
    statement: 'Published reports are visible to pastors and administrators.',
    status: 'confirmed',
    moduleId: 'MOD-PUB',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-051'],
    updatedAt: '2026-07-28T09:15:44Z',
    trace: [
      {
        evidenceId: 'ev-003',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'Pastors and administrators can view published reports.',
        recordedAt: '2026-07-28T09:15:02Z',
      },
    ],
  },
  {
    id: 'FR-PUB-002',
    category: 'functional',
    statement: 'A published report that is later found to be wrong can be corrected.',
    status: 'contested',
    moduleId: 'MOD-PUB',
    satisfies: ['OBJ-01'],
    verifiedBy: [],
    updatedAt: '2026-07-28T09:18:52Z',
    clarificationNeeded:
      'Immutability after approval (BR-APR-02) and correction of a published report cannot both hold as stated. Withdraw-and-supersede would satisfy both; that has not been decided.',
    trace: [
      {
        evidenceId: 'ev-005',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'After approval a report cannot be edited at all.',
        recordedAt: '2026-07-28T09:18:10Z',
      },
    ],
  },
  {
    id: 'BR-APR-001',
    category: 'business_rule',
    statement: 'A submitter cannot approve their own report.',
    status: 'confirmed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-031'],
    updatedAt: '2026-07-28T09:16:20Z',
    trace: [
      {
        evidenceId: 'ev-004',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'Whoever approves it should not be the person who wrote it.',
        recordedAt: '2026-07-28T09:16:20Z',
      },
    ],
  },
  {
    id: 'BR-APR-002',
    category: 'business_rule',
    statement: 'Editing an approved report invalidates the prior approval.',
    status: 'confirmed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-034'],
    updatedAt: '2026-07-28T09:18:52Z',
    trace: [
      {
        evidenceId: 'ev-005',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'After approval a report cannot be edited at all.',
        recordedAt: '2026-07-28T09:18:10Z',
      },
    ],
  },
  {
    id: 'SR-APR-001',
    category: 'security',
    statement:
      'Approval authority is verified against the organisational directory at decision time.',
    status: 'proposed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: [],
    updatedAt: '2026-07-28T09:19:30Z',
    clarificationNeeded: 'Cannot be completed until the approver role is decided (OD-011).',
    trace: [
      {
        evidenceId: 'ev-006',
        sourceLabel: 'Assistant proposal, 28 July',
        quotedText:
          'Authorisation should be checked when the decision is made, not when the page is opened.',
        recordedAt: '2026-07-28T09:19:30Z',
      },
    ],
  },
  {
    id: 'SR-APR-002',
    category: 'security',
    statement: 'Every approval and rejection is written to an immutable audit record.',
    status: 'proposed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: ['AT-033'],
    updatedAt: '2026-07-28T09:19:30Z',
    trace: [
      {
        evidenceId: 'ev-006',
        sourceLabel: 'Assistant proposal, 28 July',
        quotedText: 'Approval history identifies the approver, time, and report version.',
        recordedAt: '2026-07-28T09:19:30Z',
      },
    ],
  },
  {
    id: 'IR-APR-001',
    category: 'integration',
    statement:
      'The approval module notifies the submitter of a decision through the notification service.',
    status: 'proposed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-01'],
    verifiedBy: [],
    updatedAt: '2026-07-28T09:20:10Z',
    clarificationNeeded:
      'Delivery channel, retry ownership, and failure behaviour are undefined. The integration interview has not been run.',
    trace: [
      {
        evidenceId: 'ev-007',
        sourceLabel: 'Assistant proposal, 28 July',
        quotedText: 'Submitters should learn the outcome without checking the system.',
        recordedAt: '2026-07-28T09:20:10Z',
      },
    ],
  },
  {
    id: 'QR-001',
    category: 'quality',
    statement: 'A submitted report reaches an approver queue within one minute of submission.',
    status: 'proposed',
    moduleId: 'MOD-APR',
    satisfies: ['OBJ-03'],
    verifiedBy: [],
    updatedAt: '2026-07-28T09:20:40Z',
    trace: [
      {
        evidenceId: 'ev-008',
        sourceLabel: 'Assistant proposal, 28 July',
        quotedText: 'Review should not wait on a batch process.',
        recordedAt: '2026-07-28T09:20:40Z',
      },
    ],
  },
  {
    id: 'OR-001',
    category: 'operational',
    statement: 'Approval history is retained for seven years and is restorable from backup.',
    status: 'proposed',
    satisfies: ['OBJ-01'],
    verifiedBy: [],
    updatedAt: '2026-07-28T09:21:00Z',
    clarificationNeeded: 'No module owns retention yet; audit responsibility is unassigned.',
    trace: [
      {
        evidenceId: 'ev-009',
        sourceLabel: 'Conversation, 28 July',
        quotedText: 'We are told to keep approval records for seven years.',
        recordedAt: '2026-07-28T09:21:00Z',
      },
    ],
  },
]

export const acceptanceTests: AcceptanceTest[] = [
  {
    id: 'AT-011',
    statement: 'A second report for the same ministry and period is rejected.',
    verifies: ['FR-RPT-001'],
    status: 'confirmed',
  },
  {
    id: 'AT-012',
    statement: 'A submitted report rejects further edits from its author.',
    verifies: ['FR-RPT-002'],
    status: 'confirmed',
  },
  {
    id: 'AT-031',
    statement: 'A user without approval authority cannot approve a report.',
    verifies: ['FR-APR-001', 'BR-APR-001'],
    status: 'confirmed',
  },
  {
    id: 'AT-032',
    statement: 'Publication is blocked while approval is pending.',
    verifies: ['FR-APR-002'],
    status: 'confirmed',
  },
  {
    id: 'AT-033',
    statement:
      'A rejected report returns to the submitter with comments, and the decision is auditable.',
    verifies: ['FR-APR-003', 'SR-APR-002'],
    status: 'confirmed',
  },
  {
    id: 'AT-034',
    statement: 'Approval history identifies the approver, time, and report version.',
    verifies: ['FR-APR-004', 'BR-APR-002'],
    status: 'proposed',
  },
  {
    id: 'AT-051',
    statement:
      'A pastor can read a published report; a ministry leader from another ministry cannot.',
    verifies: ['FR-PUB-001'],
    status: 'proposed',
  },
]

/* --------------------------------------------------------- open decisions */

export const openDecisions: OpenDecision[] = [
  {
    id: 'OD-011',
    question: 'Which role holds approval authority?',
    whyItMatters:
      'Approval authorisation, the approver queue, and the security requirements for the approval module all depend on it. Until it is decided, the Approval Workflow module cannot be implemented safely.',
    blocks: ['MOD-APR', 'SR-APR-001'],
    suggestedOwner: 'Church leadership',
    deferred: false,
  },
  {
    id: 'OD-012',
    question: 'Is a single approval sufficient, or is a second reviewer required?',
    whyItMatters:
      'Determines whether approval is one decision or a sequence, which changes the module state machine and the audit record.',
    blocks: ['MOD-APR'],
    suggestedOwner: 'Church leadership',
    deferred: false,
  },
  {
    id: 'OD-013',
    question: 'How is a published report corrected once an error is found?',
    whyItMatters:
      'Immutability after approval leaves no correction path. Withdraw-and-supersede, or correct-with-audit-note, are both viable and have different data models.',
    blocks: ['MOD-PUB', 'FR-PUB-002'],
    suggestedOwner: 'Administrator',
    deferred: false,
  },
  {
    id: 'OD-014',
    question: 'Can an administrator override a rejection?',
    whyItMatters: 'Affects the permission model and whether rejection is final.',
    blocks: ['MOD-APR'],
    suggestedOwner: 'Church leadership',
    deferred: true,
  },
]

/* ---------------------------------------------------------------- modules */

export const modules: ProjectModule[] = [
  {
    id: 'MOD-RPT',
    key: 'MOD-RPT',
    name: 'Report Management',
    purpose: 'Author, store, and version monthly ministry reports up to the point of submission.',
    proposalState: 'proposed',
    rationale:
      'Report authoring owns its own data and lifecycle, and its editing rules end where approval begins. Splitting here keeps the approval gate free of authoring concerns.',
    responsibilities: [
      'Create one report per ministry per reporting period.',
      'Hold drafts and keep them editable by their author.',
      'Version a report on submission.',
      'Lock edits once submitted.',
    ],
    nonResponsibilities: [
      { text: 'Deciding whether a report may be published', ownerModuleId: 'MOD-APR' },
      { text: 'Making a report visible to readers', ownerModuleId: 'MOD-PUB' },
    ],
    inputs: ['Ministry identity', 'Reporting period', 'Report content sections'],
    outputs: ['Report version', 'Submission event'],
    requirementIds: ['FR-RPT-001', 'FR-RPT-002'],
    businessRuleIds: [],
    interfaces: [
      {
        id: 'IF-RPT-01',
        name: 'Report state query',
        direction: 'exposes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-RPT',
        status: 'proposed',
      },
    ],
    data: [
      { id: 'DE-RPT-01', name: 'Report', ownership: 'owns', classification: 'Internal' },
      { id: 'DE-RPT-02', name: 'Report version', ownership: 'owns', classification: 'Internal' },
      { id: 'DE-IAM-01', name: 'User identity', ownership: 'reads', classification: 'Personal' },
    ],
    dependencies: [
      {
        moduleId: 'MOD-IAM',
        reason: 'Establishes who the author is and which ministry they lead.',
        nature: 'runtime',
      },
    ],
    failureBehaviour: [
      {
        condition: 'Directory lookup unavailable',
        behaviour: 'Drafting continues; submission is refused until identity can be confirmed.',
      },
    ],
    acceptanceTestIds: ['AT-011', 'AT-012'],
    openDecisionIds: [],
    readiness: [
      { dimension: 'requirements', value: 'complete' },
      { dimension: 'interfaces', value: 'draft' },
      { dimension: 'data_model', value: 'complete' },
      { dimension: 'security', value: 'draft' },
      { dimension: 'operations', value: 'incomplete' },
      { dimension: 'acceptance_tests', value: 'complete' },
      { dimension: 'ui', value: 'draft' },
    ],
    implementationReady: false,
  },
  {
    id: 'MOD-APR',
    key: 'MOD-APR',
    name: 'Approval Workflow',
    purpose: 'Ensure submitted reports are reviewed and approved before publication.',
    proposalState: 'proposed',
    rationale:
      'Approval is where authority, auditability, and the publication gate meet. It reads report state but owns none of it, and its security obligations differ from authoring — a boundary worth keeping explicit.',
    responsibilities: [
      'Receive submitted reports.',
      'Determine the authorised approver.',
      'Record approval or rejection with comments.',
      'Prevent premature publication.',
      'Preserve the approval history.',
    ],
    nonResponsibilities: [
      { text: 'Report authoring and versioning', ownerModuleId: 'MOD-RPT' },
      { text: 'Delivering notifications', ownerModuleId: 'MOD-NTF' },
      { text: 'Making a report publicly visible', ownerModuleId: 'MOD-PUB' },
    ],
    inputs: ['Submitted report ID', 'Submitter identity', 'Ministry', 'Current report version'],
    outputs: [
      'Approval decision',
      'Review comments',
      'Approval timestamp',
      'Publication eligibility',
    ],
    requirementIds: [
      'FR-APR-001',
      'FR-APR-002',
      'FR-APR-003',
      'FR-APR-004',
      'SR-APR-001',
      'SR-APR-002',
      'IR-APR-001',
      'QR-001',
    ],
    businessRuleIds: ['BR-APR-001', 'BR-APR-002'],
    interfaces: [
      {
        id: 'IF-APR-01',
        name: 'Approval decision',
        direction: 'exposes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-APR',
        status: 'proposed',
      },
      {
        id: 'IF-APR-02',
        name: 'Publication eligibility',
        direction: 'exposes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-APR',
        status: 'proposed',
      },
      {
        id: 'IF-IAM-01',
        name: 'Authority check',
        direction: 'consumes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-IAM',
        status: 'contested',
        note: 'Cannot be specified until the approver role is decided (OD-011).',
      },
      {
        id: 'IF-NTF-01',
        name: 'Decision notification',
        direction: 'consumes',
        protocol: 'Undecided',
        synchronicity: 'asynchronous',
        ownerModuleId: 'MOD-NTF',
        status: 'proposed',
        note: 'Retry ownership and failure behaviour undefined; integration interview not yet run.',
      },
    ],
    data: [
      {
        id: 'DE-APR-01',
        name: 'Approval decision',
        ownership: 'owns',
        classification: 'Internal, audited',
      },
      { id: 'DE-APR-02', name: 'Review comment', ownership: 'owns', classification: 'Internal' },
      { id: 'DE-RPT-02', name: 'Report version', ownership: 'reads', classification: 'Internal' },
      { id: 'DE-IAM-01', name: 'User identity', ownership: 'reads', classification: 'Personal' },
    ],
    dependencies: [
      {
        moduleId: 'MOD-IAM',
        reason: 'Verifies that the acting user holds approval authority.',
        nature: 'runtime',
        blocking: true,
        blockingReason:
          'The authority check cannot be specified while the approver role is undecided (OD-011).',
      },
      {
        moduleId: 'MOD-RPT',
        reason: 'Reads the submitted report version under review.',
        nature: 'data',
      },
      { moduleId: 'MOD-NTF', reason: 'Informs the submitter of the outcome.', nature: 'runtime' },
      {
        moduleId: 'MOD-PUB',
        reason: 'Publication consumes the eligibility this module produces.',
        nature: 'runtime',
      },
      {
        moduleId: 'MOD-AUD',
        reason: 'Writes the immutable approval record.',
        nature: 'operational',
      },
    ],
    failureBehaviour: [
      {
        condition: 'Notification delivery fails',
        behaviour:
          'The decision remains valid and is recorded; notification is retried separately.',
      },
      {
        condition: 'Authorisation cannot be verified',
        behaviour: 'Approval is refused. The system fails closed rather than assuming authority.',
      },
      {
        condition: 'Audit write fails',
        behaviour:
          'Undefined. Whether the decision may stand without its audit record is not yet decided.',
      },
    ],
    acceptanceTestIds: ['AT-031', 'AT-032', 'AT-033', 'AT-034'],
    openDecisionIds: ['OD-011', 'OD-012', 'OD-014'],
    readiness: [
      { dimension: 'requirements', value: 'complete' },
      {
        dimension: 'interfaces',
        value: 'incomplete',
        note: 'Authority check and notification contracts undefined.',
      },
      { dimension: 'data_model', value: 'complete' },
      {
        dimension: 'security',
        value: 'blocked',
        note: 'Blocked by OD-011 — approver role undecided.',
      },
      { dimension: 'operations', value: 'incomplete', note: 'Audit-failure behaviour undefined.' },
      { dimension: 'acceptance_tests', value: 'draft' },
      { dimension: 'ui', value: 'draft' },
    ],
    implementationReady: false,
  },
  {
    id: 'MOD-PUB',
    key: 'MOD-PUB',
    name: 'Publication',
    purpose: 'Make approved reports visible to authorised readers.',
    proposalState: 'proposed',
    rationale:
      'Readership is a different permission surface from submission and approval, and publication may later extend beyond this system. Keeping it separate avoids embedding a second authorisation model in the approval gate.',
    responsibilities: [
      'Publish an approved report to authorised readers.',
      'Withhold a report that is not publication-eligible.',
      'Present published reports by ministry and period.',
    ],
    nonResponsibilities: [{ text: 'Deciding approval', ownerModuleId: 'MOD-APR' }],
    inputs: ['Publication eligibility', 'Approved report version'],
    outputs: ['Published report', 'Reader access decision'],
    requirementIds: ['FR-PUB-001', 'FR-PUB-002'],
    businessRuleIds: [],
    interfaces: [
      {
        id: 'IF-PUB-01',
        name: 'Published report read',
        direction: 'exposes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-PUB',
        status: 'proposed',
      },
      {
        id: 'IF-APR-02',
        name: 'Publication eligibility',
        direction: 'consumes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-APR',
        status: 'proposed',
      },
    ],
    data: [
      {
        id: 'DE-PUB-01',
        name: 'Publication record',
        ownership: 'owns',
        classification: 'Internal',
      },
    ],
    dependencies: [
      { moduleId: 'MOD-APR', reason: 'Consumes publication eligibility.', nature: 'runtime' },
      { moduleId: 'MOD-IAM', reason: 'Establishes reader authorisation.', nature: 'runtime' },
    ],
    failureBehaviour: [
      {
        condition: 'Eligibility service unavailable',
        behaviour: 'Publication is withheld rather than assumed.',
      },
    ],
    acceptanceTestIds: ['AT-051'],
    openDecisionIds: ['OD-013'],
    readiness: [
      { dimension: 'requirements', value: 'draft', note: 'FR-PUB-002 contested.' },
      { dimension: 'interfaces', value: 'draft' },
      { dimension: 'data_model', value: 'draft' },
      { dimension: 'security', value: 'incomplete' },
      { dimension: 'operations', value: 'incomplete' },
      { dimension: 'acceptance_tests', value: 'incomplete' },
      { dimension: 'ui', value: 'incomplete' },
    ],
    implementationReady: false,
  },
  {
    id: 'MOD-IAM',
    key: 'MOD-IAM',
    name: 'Identity and Access',
    purpose:
      'Establish who a user is and what authority they hold, from the organisational directory.',
    proposalState: 'proposed',
    rationale:
      'CON-01 requires identity to come from the existing directory. Modelling it as a module makes that dependency explicit rather than assumed everywhere.',
    responsibilities: [
      'Resolve a user from the organisational directory.',
      'Report the ministries a user leads.',
      'Answer authority checks for a given action.',
    ],
    nonResponsibilities: [{ text: 'Storing users', ownerModuleId: 'MOD-IAM' }],
    inputs: ['Directory credentials'],
    outputs: ['User identity', 'Authority decision'],
    requirementIds: [],
    businessRuleIds: [],
    interfaces: [
      {
        id: 'IF-IAM-01',
        name: 'Authority check',
        direction: 'exposes',
        protocol: 'HTTP/JSON',
        synchronicity: 'synchronous',
        ownerModuleId: 'MOD-IAM',
        status: 'contested',
        note: 'Shape depends on how approval authority is expressed (OD-011).',
      },
    ],
    data: [
      { id: 'DE-IAM-01', name: 'User identity', ownership: 'owns', classification: 'Personal' },
    ],
    dependencies: [],
    failureBehaviour: [
      { condition: 'Directory unreachable', behaviour: 'Authority checks fail closed.' },
    ],
    acceptanceTestIds: [],
    openDecisionIds: ['OD-011'],
    readiness: [
      { dimension: 'requirements', value: 'incomplete', note: 'No requirements assigned yet.' },
      { dimension: 'interfaces', value: 'blocked', note: 'Blocked by OD-011.' },
      { dimension: 'data_model', value: 'draft' },
      { dimension: 'security', value: 'incomplete' },
      { dimension: 'operations', value: 'incomplete' },
      { dimension: 'acceptance_tests', value: 'incomplete' },
      { dimension: 'ui', value: 'not_applicable' },
    ],
    implementationReady: false,
  },
  {
    id: 'MOD-NTF',
    key: 'MOD-NTF',
    name: 'Notification Service',
    purpose: 'Deliver decision notifications to submitters.',
    proposalState: 'proposed',
    rationale:
      'Notification has its own delivery guarantees and failure semantics. Keeping it separate stops retry behaviour leaking into the approval decision.',
    responsibilities: [
      'Deliver a decision notification.',
      'Retry failed delivery independently of the decision.',
    ],
    nonResponsibilities: [{ text: 'Deciding whether to notify', ownerModuleId: 'MOD-APR' }],
    inputs: ['Recipient identity', 'Decision summary'],
    outputs: ['Delivery outcome'],
    requirementIds: [],
    businessRuleIds: [],
    interfaces: [
      {
        id: 'IF-NTF-01',
        name: 'Decision notification',
        direction: 'exposes',
        protocol: 'Undecided',
        synchronicity: 'asynchronous',
        ownerModuleId: 'MOD-NTF',
        status: 'proposed',
        note: 'Channel and contract undefined; integration interview not yet run.',
      },
    ],
    data: [],
    dependencies: [],
    failureBehaviour: [],
    acceptanceTestIds: [],
    openDecisionIds: [],
    readiness: [
      { dimension: 'requirements', value: 'incomplete' },
      { dimension: 'interfaces', value: 'incomplete' },
      { dimension: 'data_model', value: 'incomplete' },
      { dimension: 'security', value: 'incomplete' },
      { dimension: 'operations', value: 'incomplete' },
      { dimension: 'acceptance_tests', value: 'incomplete' },
      { dimension: 'ui', value: 'not_applicable' },
    ],
    implementationReady: false,
  },
  {
    id: 'MOD-AUD',
    key: 'MOD-AUD',
    name: 'Audit Record',
    purpose: 'Retain an immutable record of approval decisions for audit.',
    proposalState: 'proposed',
    rationale:
      'CON-02 requires seven-year retention. Audit has different retention and immutability obligations from operational data, so it is proposed as its own boundary.',
    responsibilities: [
      'Record approval and rejection events immutably.',
      'Retain records for the mandated period.',
    ],
    nonResponsibilities: [],
    inputs: ['Decision event'],
    outputs: ['Audit entry'],
    requirementIds: ['OR-001'],
    businessRuleIds: [],
    interfaces: [],
    data: [
      {
        id: 'DE-AUD-01',
        name: 'Audit entry',
        ownership: 'owns',
        classification: 'Internal, retained',
      },
    ],
    dependencies: [],
    failureBehaviour: [],
    acceptanceTestIds: [],
    readiness: [
      { dimension: 'requirements', value: 'draft' },
      { dimension: 'interfaces', value: 'incomplete' },
      { dimension: 'data_model', value: 'incomplete' },
      { dimension: 'security', value: 'incomplete' },
      { dimension: 'operations', value: 'incomplete' },
      { dimension: 'acceptance_tests', value: 'incomplete' },
      { dimension: 'ui', value: 'not_applicable' },
    ],
    openDecisionIds: [],
    implementationReady: false,
  },
]

/* ---------------------------------------------------------------- findings */

export const findings: ReviewFinding[] = [
  {
    id: 'FND-001',
    kind: 'open_decision',
    severity: 'critical',
    summary: 'Approval authority is undecided and blocks the Approval Workflow module.',
    detail:
      'OD-011 has been open since the first conversation. Security readiness for MOD-APR is blocked, and the authority-check interface cannot be specified until it resolves.',
    version: 1,
    subjectIds: ['OD-011', 'MOD-APR'],
  },
  {
    id: 'FND-002',
    kind: 'contradiction',
    severity: 'critical',
    summary: 'A published report cannot be both immutable and correctable.',
    detail:
      'BR-APR-002 makes an approved report immutable. FR-PUB-002 requires that a published report found to be wrong can be corrected. Both are recorded as project knowledge and they cannot both hold as stated.',
    version: 1,
    subjectIds: ['BR-APR-002', 'FR-PUB-002'],
    competingStatements: [
      {
        text: 'Editing an approved report invalidates the prior approval.',
        sourceLabel: 'Conversation, 28 July 09:18',
      },
      {
        text: 'A published report that is later found to be wrong can be corrected.',
        sourceLabel: 'Conversation, 28 July 09:18',
      },
    ],
  },
  {
    id: 'FND-003',
    kind: 'requirement_gap',
    severity: 'major',
    summary: 'No module owns retention of the approval audit record.',
    detail:
      'OR-001 requires seven-year retention. MOD-AUD is proposed but not accepted, so the requirement has no owning module and no acceptance test.',
    version: 1,
    subjectIds: ['OR-001', 'MOD-AUD'],
  },
  {
    id: 'FND-004',
    kind: 'requirement_gap',
    severity: 'major',
    summary: 'The notification integration has no contract.',
    detail:
      'IR-APR-001 states that submitters are notified, but initiator, protocol, retry ownership, timeout, and failure behaviour are all undefined. The integration interview has not been run for this interface.',
    version: 1,
    subjectIds: ['IR-APR-001', 'IF-NTF-01'],
  },
  {
    id: 'FND-005',
    kind: 'unverified_requirement',
    severity: 'major',
    summary: 'Four requirements have no verifying acceptance test.',
    detail:
      'SR-APR-001, IR-APR-001, QR-001, and OR-001 are recorded but nothing verifies them. A requirement with no test cannot be shown to be met.',
    version: 1,
    subjectIds: ['SR-APR-001', 'IR-APR-001', 'QR-001', 'OR-001'],
  },
  {
    id: 'FND-006',
    kind: 'agent_proposal',
    severity: 'minor',
    summary: 'Coding agent reports the existing API accepts only one approver.',
    detail:
      'While inspecting the repository, an agent found that the current approval endpoint accepts a single approver identifier, which would not satisfy a multi-level approval if OD-012 resolves that way. Submitted as proposed knowledge; not confirmed.',
    version: 1,
    subjectIds: ['OD-012', 'MOD-APR'],
    agentOrigin: {
      agent: 'Claude Code via KAE MCP',
      repository: 'crismag/ministry-reporting',
      commit: 'a91f3c2',
      memoryRevision: 46,
    },
  },
  {
    id: 'FND-007',
    kind: 'agent_proposal',
    severity: 'minor',
    summary: 'Coding agent proposes an idempotency key on the approval decision endpoint.',
    detail:
      'Agent observed that a retried approval submission would currently create a duplicate decision record. Proposed as a new requirement; awaiting confirmation.',
    version: 1,
    subjectIds: ['MOD-APR'],
    agentOrigin: {
      agent: 'Codex via KAE MCP',
      repository: 'crismag/ministry-reporting',
      commit: 'a91f3c2',
      memoryRevision: 46,
    },
  },
]

/* ----------------------------------------------------------------- health */

export const health: ProjectHealth = {
  phase: 'Requirements forming',
  summary:
    'The submission and approval workflow is well understood. Approval authority and the correction path are unresolved, and both block work that depends on them.',
  coverage: [
    {
      key: 'problem_and_value',
      name: 'Problem and value',
      state: 'strong',
      detail: 'Problem, objectives, and value are confirmed.',
    },
    {
      key: 'users_and_stakeholders',
      name: 'Users and roles',
      state: 'strong',
      detail: 'Submitters and readers confirmed; the approver role is contested.',
    },
    {
      key: 'workflows',
      name: 'Business workflows',
      state: 'strong',
      detail: 'Submission and approval flows are confirmed end to end.',
    },
    {
      key: 'functional_requirements',
      name: 'Functional requirements',
      state: 'forming',
      detail: '8 confirmed, 1 contested.',
    },
    {
      key: 'interfaces',
      name: 'Interfaces and integrations',
      state: 'thin',
      detail: 'Two contracts undefined; the integration interview has not been run.',
    },
    {
      key: 'security',
      name: 'Security and permissions',
      state: 'thin',
      detail: 'Blocked on approval authority.',
    },
    {
      key: 'data',
      name: 'Domain model and data',
      state: 'forming',
      detail: 'Ownership assigned for reports and decisions; audit retention unowned.',
    },
    {
      key: 'acceptance',
      name: 'Acceptance criteria',
      state: 'forming',
      detail: '7 tests drafted; 4 requirements unverified.',
    },
    {
      key: 'operations',
      name: 'Delivery and operations',
      state: 'missing',
      detail: 'Not yet discussed.',
    },
  ],
  blockingDecisionIds: ['OD-011', 'OD-013'],
  recommendedNext: [
    'Resolve who holds approval authority (OD-011) — it blocks the most work.',
    'Decide the correction path for a published report (OD-013).',
    'Run the integration interview for the notification interface.',
  ],
}

/* ----------------------------------------------------------- deliverables */

export const deliverables: Deliverable[] = [
  {
    id: 'DLV-PROJECT-CONTEXT',
    name: 'Project context package',
    description:
      'The whole-project definition: charter, stakeholders, scope, workflows, requirements, module index, and open decisions.',
    scope: 'project',
    state: 'generated',
    version: 'v3',
    generatedAt: '2026-07-30T14:02:00Z',
    sourceMemoryRevision: 44,
    contentHash: 'sha256:7f3a…c081',
    includes: [
      'Charter and objectives',
      'Stakeholder register',
      'Scope and exclusions',
      'Business workflows',
      'All requirements',
      'Module index',
      'Open decisions',
    ],
    files: [
      {
        path: 'project-context/project-charter.md',
        summary: 'Problem, value, objectives.',
        tracedStatements: 9,
      },
      {
        path: 'project-context/stakeholder-register.md',
        summary: 'Four stakeholders, one contested.',
        tracedStatements: 4,
      },
      {
        path: 'project-context/scope-and-boundaries.md',
        summary: 'Four in scope, three excluded.',
        tracedStatements: 7,
      },
      {
        path: 'project-context/business-workflows.md',
        summary: 'Submission and approval flows.',
        tracedStatements: 2,
      },
      {
        path: 'project-context/requirements/functional-requirements.md',
        summary: '8 functional requirements.',
        tracedStatements: 8,
      },
      {
        path: 'project-context/modules/index.md',
        summary: 'Six proposed modules with readiness.',
        tracedStatements: 6,
      },
      {
        path: 'project-context/planning/actionable-items.md',
        summary: 'Four open decisions with owners.',
        tracedStatements: 4,
      },
    ],
    unresolvedDecisionIds: ['OD-011', 'OD-012', 'OD-013'],
  },
  {
    id: 'DLV-MOD-APR',
    name: 'Approval Workflow — module context',
    description:
      'Everything needed to implement MOD-APR without reading the whole project: requirements, interfaces, data, dependencies, failure behaviour, tests, and its unresolved decisions.',
    scope: 'module',
    moduleId: 'MOD-APR',
    state: 'not_generated',
    includes: [
      'Module specification',
      'Satisfied objectives and requirements',
      'Exposed and consumed interfaces',
      'Owned and read data entities',
      'Dependency stubs',
      'Acceptance tests',
      'Open decisions',
      'Per-dimension readiness',
      'agents/implementation-directive.md',
    ],
    files: [
      {
        path: 'project-context/modules/approval-workflow.md',
        summary: 'Canonical module specification.',
        tracedStatements: 14,
      },
      {
        path: 'project-context/interfaces/approval-contracts.md',
        summary: 'Two exposed, two consumed. Two undefined.',
        tracedStatements: 4,
      },
      {
        path: 'project-context/testing/approval-acceptance.md',
        summary: 'Four acceptance tests.',
        tracedStatements: 4,
      },
      {
        path: 'project-context/agents/module-contexts/approval-workflow.yaml',
        summary: 'Machine-facing bounded context.',
        tracedStatements: 14,
      },
      {
        path: 'project-context/agents/implementation-directives/approval-workflow.md',
        summary: 'What to build, what is out of scope, what must not be assumed.',
        tracedStatements: 3,
      },
    ],
    unresolvedDecisionIds: ['OD-011', 'OD-012', 'OD-014'],
  },
  {
    id: 'DLV-MOD-RPT',
    name: 'Report Management — module context',
    description: 'Bounded implementation context for MOD-RPT.',
    scope: 'module',
    moduleId: 'MOD-RPT',
    state: 'published',
    version: 'v2',
    generatedAt: '2026-07-29T11:20:00Z',
    sourceMemoryRevision: 41,
    contentHash: 'sha256:2b9e…44af',
    includes: ['Module specification', 'Requirements', 'Data entities', 'Acceptance tests'],
    files: [
      {
        path: 'project-context/modules/report-management.md',
        summary: 'Canonical module specification.',
        tracedStatements: 8,
      },
      {
        path: 'project-context/agents/module-contexts/report-management.yaml',
        summary: 'Machine-facing bounded context.',
        tracedStatements: 8,
      },
    ],
    unresolvedDecisionIds: [],
    publishedTo: {
      target: 'github',
      reference: 'crismag/ministry-reporting #14',
      at: '2026-07-29T11:24:00Z',
    },
  },
  {
    id: 'DLV-ARCHITECTURE',
    name: 'Architecture context',
    description: 'System context, component design, data model, and decision records.',
    scope: 'project',
    state: 'not_generated',
    includes: ['System context', 'Component design', 'Data model', 'Architecture decisions'],
    files: [],
    unresolvedDecisionIds: [],
    blockedReason:
      'The architecture interview has not been run. Generating this now would produce a design nobody has discussed.',
  },
  {
    id: 'DLV-PLAN',
    name: 'Implementation plan',
    description: 'Delivery phases, work packages, dependency order, and risks.',
    scope: 'project',
    state: 'not_generated',
    includes: ['Delivery phases', 'Work packages', 'Dependency order', 'Risk register'],
    files: [],
    unresolvedDecisionIds: [],
    blockedReason:
      'Dependency order cannot be derived while MOD-APR has a blocking dependency on an undecided authority model (OD-011).',
  },
]

export const publishTargets: PublishTarget[] = [
  {
    kind: 'github',
    label: 'GitHub repository',
    detail: 'crismag/ministry-reporting · docs/kae/ · draft pull request',
    available: true,
  },
  {
    kind: 'local',
    label: 'Local workspace',
    detail: 'Requires the KAE local agent to be connected',
    available: false,
    unavailableReason:
      'No local agent registered. Install kae-mcp-local to enable workspace writes.',
  },
  {
    kind: 's3',
    label: 'Managed download',
    detail: 'Stored securely in S3 and downloaded from Studio',
    available: true,
  },
]

export const recentChanges = [
  {
    id: 'chg-1',
    text: 'BR-APR-002 confirmed — editing an approved report invalidates approval',
    at: '2026-07-28T09:18:52Z',
  },
  {
    id: 'chg-2',
    text: 'Contradiction raised between BR-APR-002 and FR-PUB-002',
    at: '2026-07-28T09:18:52Z',
  },
  {
    id: 'chg-3',
    text: 'OD-013 opened — correction path for a published report',
    at: '2026-07-28T09:18:52Z',
  },
  {
    id: 'chg-4',
    text: 'FR-RPT-002 confirmed — drafts editable until submission',
    at: '2026-07-28T09:18:10Z',
  },
  {
    id: 'chg-5',
    text: 'STK-02 and STK-03 added — pastors and administrators as readers',
    at: '2026-07-28T09:15:44Z',
  },
]
