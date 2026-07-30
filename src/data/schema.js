/**
 * The canonical data model.
 *
 * One shared operating picture: every surface in the app reads these records
 * and nothing renders a number it cannot trace back to one. Entities are plain
 * objects so they serialise cleanly and can be swapped for API responses later
 * without touching the views.
 */

// --- Guardrail tiers -------------------------------------------------------
// Every action an agent can take is classified before it is offered to the
// operator. This is the product's central safety property, so it lives in the
// schema rather than in any single view.

export const TIER = {
  AUTONOMOUS: 'autonomous',
  APPROVAL: 'approval',
  HUMAN_ONLY: 'human_only',
};

export const TIER_META = {
  [TIER.AUTONOMOUS]: {
    label: 'Autonomous',
    blurb: 'Routine, reversible work',
    detail: 'The agent may complete this without asking. It is logged and can be reversed.',
    dot: 'green-dot',
    tag: 'green',
  },
  [TIER.APPROVAL]: {
    label: 'Approval required',
    blurb: 'External or consequential actions',
    detail: 'The agent prepares evidence and a recommendation. Nothing leaves the building until you approve.',
    dot: 'orange-dot',
    tag: 'orange',
  },
  [TIER.HUMAN_ONLY]: {
    label: 'Human only',
    blurb: 'Medical, legal, safeguarding, discipline',
    detail: 'The agent may gather context but must not recommend an outcome. You decide.',
    dot: 'red-dot',
    tag: 'red',
  },
};

// --- Decisions -------------------------------------------------------------

export const DECISION_STATUS = {
  OPEN: 'open',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ESCALATED: 'escalated',
  INFO_REQUESTED: 'info_requested',
};

export const DECISION_STATUS_META = {
  [DECISION_STATUS.OPEN]: { label: 'Open', tag: '' },
  [DECISION_STATUS.APPROVED]: { label: 'Approved', tag: 'green' },
  [DECISION_STATUS.REJECTED]: { label: 'Declined', tag: 'red' },
  [DECISION_STATUS.ESCALATED]: { label: 'Escalated', tag: 'orange' },
  [DECISION_STATUS.INFO_REQUESTED]: { label: 'Info requested', tag: 'orange' },
};

export const PRIORITY = { HIGH: 'high', MED: 'med', LOW: 'low' };
export const PRIORITY_RANK = { high: 0, med: 1, low: 2 };

// --- Workstreams and agents ------------------------------------------------
// The eight workstreams from the README, each with the gate that bounds it.

export const WORKSTREAMS = [
  {
    id: 'competition',
    name: 'Competition manager',
    work: 'Schedules, eligibility, rankings',
    gate: 'Exceptions + policy',
    icon: '◆',
    color: 'green-bg',
  },
  {
    id: 'player-systems',
    name: 'Player systems & development',
    work: 'Talent ID, pathways, camps',
    gate: 'Selection decisions',
    icon: '↗',
    color: 'blue-bg',
  },
  {
    id: 'training',
    name: 'Training & education',
    work: 'Courses, educator network',
    gate: 'Appointments',
    icon: '✦',
    color: 'purple-bg',
  },
  {
    id: 'comms',
    name: 'Marketing & communications',
    work: 'Campaigns, briefs, updates',
    gate: 'Publish / brand',
    icon: '◎',
    color: 'teal-bg',
  },
  {
    id: 'finance',
    name: 'Finance & administration',
    work: 'Budget, invoices, reporting',
    gate: 'Spend / commitments',
    icon: '$',
    color: 'orange-bg',
  },
  {
    id: 'performance',
    name: 'Performance & medical',
    work: 'Readiness, travel, care logistics',
    gate: 'Clinical judgment',
    icon: '+',
    color: 'red-bg',
  },
  {
    id: 'youth',
    name: 'Youth & pathway programs',
    work: 'U18/U23 programs, events',
    gate: 'Safeguarding / selection',
    icon: '☖',
    color: 'blue-bg',
  },
  {
    id: 'championships',
    name: 'Championship operations',
    work: 'Venues, officials, matchday',
    gate: 'Contracts / incidents',
    icon: '⚑',
    color: 'purple-bg',
  },
];

export const WORKSTREAM_BY_ID = Object.fromEntries(WORKSTREAMS.map((w) => [w.id, w]));

export const AGENT_STATUS = { WORKING: 'working', WAITING: 'waiting', REVIEW: 'review', PAUSED: 'paused' };

export const AGENT_STATUS_META = {
  working: { label: 'Working', cls: 'working' },
  waiting: { label: 'Waiting', cls: 'waiting' },
  review: { label: 'Review', cls: 'review' },
  paused: { label: 'Paused', cls: 'review' },
};

// --- Documents -------------------------------------------------------------

export const DOC_KIND = {
  INSURANCE: 'insurance',
  SAFEGUARDING: 'safeguarding',
  MEDICAL: 'medical',
  WAIVER: 'waiver',
  TRANSFER: 'transfer',
};

export const DOC_KIND_META = {
  insurance: { label: 'Certificate of insurance', owner: 'team', required: true },
  safeguarding: { label: 'Safeguarding policy', owner: 'team', required: true },
  medical: { label: 'Medical clearance', owner: 'player', required: true },
  waiver: { label: 'Participation waiver', owner: 'player', required: true },
  transfer: { label: 'Transfer release', owner: 'player', required: false },
};

export const DOC_STATUS = { VALID: 'valid', MISSING: 'missing', EXPIRED: 'expired', PENDING: 'pending' };

// --- Fixtures --------------------------------------------------------------

export const FIXTURE_STATUS = { SCHEDULED: 'scheduled', PLAYED: 'played', POSTPONED: 'postponed' };

/** World Rugby-style league points. */
export const SCORING = {
  win: 4,
  draw: 2,
  loss: 0,
  tryBonusThreshold: 4, // 4+ tries earns a bonus point
  tryBonus: 1,
  losingBonusMargin: 7, // losing by 7 or fewer earns a bonus point
  losingBonus: 1,
};

// --- Communications --------------------------------------------------------

export const COMM_STATUS = { DRAFT: 'draft', APPROVED: 'approved', SENT: 'sent' };

// --- Findings --------------------------------------------------------------
// Rule engines emit findings; `rules/decisions.js` turns the ones that need a
// human into Decision records. Keeping the codes here means the eligibility
// desk, the command center, and the audit log all describe an issue the same way.

export const FINDING_CODE = {
  TEAM_DOC_MISSING: 'TEAM_DOC_MISSING',
  TEAM_DOC_EXPIRED: 'TEAM_DOC_EXPIRED',
  PLAYER_DOC_MISSING: 'PLAYER_DOC_MISSING',
  DUPLICATE_REGISTRATION: 'DUPLICATE_REGISTRATION',
  LATE_REGISTRATION: 'LATE_REGISTRATION',
  TRANSFER_WINDOW: 'TRANSFER_WINDOW',
  AGE_MINIMUM: 'AGE_MINIMUM',
  ROSTER_MINIMUM: 'ROSTER_MINIMUM',
  TEAM_DOUBLE_BOOKING: 'TEAM_DOUBLE_BOOKING',
  VENUE_DOUBLE_BOOKING: 'VENUE_DOUBLE_BOOKING',
  SHORT_TURNAROUND: 'SHORT_TURNAROUND',
  TRAVEL_LOAD: 'TRAVEL_LOAD',
};

export const SEVERITY = { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' };

export const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

// --- Factories -------------------------------------------------------------
// Thin constructors that normalise shape and defaults. They exist so a missing
// field fails loudly here rather than rendering as `undefined` three layers up.

function required(value, field, kind) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${kind}: missing required field "${field}"`);
  }
  return value;
}

export function makeTeam(input) {
  return {
    id: required(input.id, 'id', 'Team'),
    name: required(input.name, 'name', 'Team'),
    shortName: input.shortName || input.name,
    conferenceId: required(input.conferenceId, 'conferenceId', 'Team'),
    venueId: input.venueId || null,
    contactName: input.contactName || '',
    contactEmail: input.contactEmail || '',
    strength: input.strength ?? 70,
    city: input.city || '',
    state: input.state || '',
  };
}

export function makePlayer(input) {
  return {
    id: required(input.id, 'id', 'Player'),
    registrationId: required(input.registrationId, 'registrationId', 'Player'),
    teamId: required(input.teamId, 'teamId', 'Player'),
    seasonId: required(input.seasonId, 'seasonId', 'Player'),
    firstName: required(input.firstName, 'firstName', 'Player'),
    lastName: required(input.lastName, 'lastName', 'Player'),
    dob: required(input.dob, 'dob', 'Player'),
    position: input.position || '',
    registeredAt: required(input.registeredAt, 'registeredAt', 'Player'),
    transferFromTeamId: input.transferFromTeamId || null,
    transferRequestedAt: input.transferRequestedAt || null,
  };
}

export function makeFixture(input) {
  return {
    id: required(input.id, 'id', 'Fixture'),
    seasonId: required(input.seasonId, 'seasonId', 'Fixture'),
    conferenceId: required(input.conferenceId, 'conferenceId', 'Fixture'),
    round: input.round ?? 1,
    kickoff: required(input.kickoff, 'kickoff', 'Fixture'),
    homeTeamId: required(input.homeTeamId, 'homeTeamId', 'Fixture'),
    awayTeamId: required(input.awayTeamId, 'awayTeamId', 'Fixture'),
    venueId: input.venueId || null,
    status: input.status || FIXTURE_STATUS.SCHEDULED,
    result: input.result || null, // { homeScore, awayScore, homeTries, awayTries }
  };
}

export function makeDocument(input) {
  return {
    id: required(input.id, 'id', 'Document'),
    kind: required(input.kind, 'kind', 'Document'),
    ownerType: required(input.ownerType, 'ownerType', 'Document'),
    ownerId: required(input.ownerId, 'ownerId', 'Document'),
    seasonId: input.seasonId || null,
    status: input.status || DOC_STATUS.VALID,
    submittedAt: input.submittedAt || null,
    expiresAt: input.expiresAt || null,
  };
}

export function makeDecision(input) {
  return {
    id: required(input.id, 'id', 'Decision'),
    title: required(input.title, 'title', 'Decision'),
    summary: input.summary || '',
    workstreamId: required(input.workstreamId, 'workstreamId', 'Decision'),
    tier: input.tier || TIER.APPROVAL,
    priority: input.priority || PRIORITY.MED,
    status: input.status || DECISION_STATUS.OPEN,
    createdAt: required(input.createdAt, 'createdAt', 'Decision'),
    dueAt: input.dueAt || null,
    recommendation: input.recommendation || null, // null is correct for human-only work
    recommendationTag: input.recommendationTag || '',
    rationale: input.rationale || '',
    confidence: input.confidence ?? null,
    evidence: input.evidence || [], // [{ label, value, source }]
    options: input.options || null,
    subjectType: input.subjectType || null,
    subjectId: input.subjectId || null,
    findingCode: input.findingCode || null,
  };
}

export function makeAuditEvent(input) {
  return {
    id: required(input.id, 'id', 'AuditEvent'),
    at: required(input.at, 'at', 'AuditEvent'),
    actor: input.actor || 'system',
    actorKind: input.actorKind || 'agent', // 'human' | 'agent' | 'system'
    action: required(input.action, 'action', 'AuditEvent'),
    detail: input.detail || '',
    subjectType: input.subjectType || null,
    subjectId: input.subjectId || null,
  };
}
