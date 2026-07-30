/**
 * Findings in, decisions out.
 *
 * This is where the guardrail model is actually enforced:
 *
 *   - `autonomous` findings never become decisions. They are work the agents
 *     completed, and they show up in the live feed and the audit log.
 *   - `approval` findings become decisions with a recommendation attached.
 *   - `human_only` findings become decisions with *no* recommendation. The
 *     agent supplies evidence and options and stops there.
 *
 * Low-priority findings of the same kind are rolled up into one decision. A
 * queue with fifteen near-identical items is a queue nobody reads.
 */

import {
  makeDecision, TIER, PRIORITY, PRIORITY_RANK, DECISION_STATUS,
  FINDING_CODE, SEVERITY,
} from '../data/schema.js';
import { seedFrom } from '../util/rng.js';
import { addDays, toISODateTime, fmtFull, fmtShort } from '../util/date.js';

/** Which specialist owns each kind of finding. */
const WORKSTREAM_FOR_CODE = {
  [FINDING_CODE.TEAM_DOC_MISSING]: 'competition',
  [FINDING_CODE.TEAM_DOC_EXPIRED]: 'competition',
  [FINDING_CODE.PLAYER_DOC_MISSING]: 'performance',
  [FINDING_CODE.DUPLICATE_REGISTRATION]: 'competition',
  [FINDING_CODE.LATE_REGISTRATION]: 'competition',
  [FINDING_CODE.TRANSFER_WINDOW]: 'competition',
  [FINDING_CODE.AGE_MINIMUM]: 'youth',
  [FINDING_CODE.ROSTER_MINIMUM]: 'competition',
  [FINDING_CODE.TEAM_DOUBLE_BOOKING]: 'competition',
  [FINDING_CODE.VENUE_DOUBLE_BOOKING]: 'championships',
  [FINDING_CODE.SHORT_TURNAROUND]: 'performance',
  [FINDING_CODE.TRAVEL_LOAD]: 'competition',
};

/** Codes that are individually low-signal and read better as one batched item. */
const BATCHED_CODES = new Set([FINDING_CODE.LATE_REGISTRATION]);

const BATCH_COPY = {
  [FINDING_CODE.LATE_REGISTRATION]: {
    title: (n) => `Approve ${n} late roster additions`,
    summary: (n, season) => `${n} players were added after the ${fmtShort(season.rosterDeadline)} roster deadline. Registration is still open, so none of them gain a competitive advantage.`,
    recommendation: 'Accept all as a batch',
    options: [
      { label: 'Accept all as a batch', status: DECISION_STATUS.APPROVED },
      { label: 'Review each one individually', status: DECISION_STATUS.INFO_REQUESTED },
      { label: 'Reject all', status: DECISION_STATUS.REJECTED },
    ],
  },
};

/**
 * Spread creation times over the last few hours, deterministically.
 * Real timestamps would come from the agent runtime; this keeps the feed
 * plausible without becoming random noise that changes on every reload.
 */
function createdAtFor(id, now) {
  const minutesAgo = 4 + (seedFrom(id) % 280);
  return toISODateTime(new Date(now.getTime() - minutesAgo * 60000));
}

function dueDateFor(finding, season, now) {
  if (finding.severity === SEVERITY.CRITICAL) return toISODateTime(addDays(now, 1));
  if (finding.code === FINDING_CODE.TEAM_DOUBLE_BOOKING || finding.code === FINDING_CODE.VENUE_DOUBLE_BOOKING) {
    return toISODateTime(addDays(now, 3));
  }
  return season.registrationCloses ? `${season.registrationCloses}T17:00` : null;
}

function decisionFromFinding(finding, season, now) {
  const workstreamId = WORKSTREAM_FOR_CODE[finding.code] || 'competition';
  return makeDecision({
    id: `d-${finding.id}`,
    title: finding.title,
    summary: finding.message,
    workstreamId,
    tier: finding.tier,
    priority: finding.priority,
    status: DECISION_STATUS.OPEN,
    createdAt: createdAtFor(finding.id, now),
    dueAt: dueDateFor(finding, season, now),
    // Human-only work carries no recommendation by construction.
    recommendation: finding.tier === TIER.HUMAN_ONLY ? null : finding.recommendation,
    recommendationTag: finding.tier === TIER.HUMAN_ONLY ? 'red' : finding.recommendationTag,
    rationale: finding.tier === TIER.HUMAN_ONLY ? '' : finding.rationale,
    confidence: finding.tier === TIER.HUMAN_ONLY ? null : finding.confidence,
    evidence: finding.evidence,
    options: finding.options,
    subjectType: finding.playerId ? 'player' : 'team',
    subjectId: finding.playerId || finding.teamId,
    findingCode: finding.code,
  });
}

function batchDecision(code, group, season, now, ix) {
  const copy = BATCH_COPY[code];
  const first = group[0];
  const evidence = group.slice(0, 6).map((f) => ({
    label: ix.teamById[f.teamId]?.shortName || 'Record',
    value: f.message.replace(/^.*?\(#/, '#').replace(/\.$/, ''),
    source: 'Registration system',
  }));
  if (group.length > evidence.length) {
    evidence.push({
      label: 'Additional',
      value: `${group.length - evidence.length} more of the same kind`,
      source: 'Registration system',
    });
  }

  return makeDecision({
    id: `d-batch-${code}`,
    title: copy.title(group.length),
    summary: copy.summary(group.length, season),
    workstreamId: WORKSTREAM_FOR_CODE[code] || 'competition',
    tier: first.tier,
    priority: PRIORITY.LOW,
    status: DECISION_STATUS.OPEN,
    createdAt: createdAtFor(`batch-${code}`, now),
    dueAt: dueDateFor(first, season, now),
    recommendation: copy.recommendation,
    recommendationTag: 'green',
    rationale: `All ${group.length} were filed before registration closes on ${fmtShort(season.registrationCloses)}.`,
    confidence: 0.9,
    evidence,
    options: copy.options,
    subjectType: 'batch',
    subjectId: code,
    findingCode: code,
  });
}

/**
 * Decisions that come from running the organisation rather than from a rule
 * breach. They are still derived — their contents reference live counts — but
 * they exist because the calendar and the mailing list need sign-off, not
 * because something is wrong.
 */
function operationalDecisions(db, ix, { season, conflictFindings, now }) {
  const scheduleChanges = conflictFindings.filter(
    (f) => f.code === FINDING_CODE.TEAM_DOUBLE_BOOKING || f.code === FINDING_CODE.VENUE_DOUBLE_BOOKING,
  ).length;
  const recipientCount = db.teams.length + db.conferences.length
    + db.officials.filter((o) => o.email).length;

  return [
    makeDecision({
      id: 'd-publish-bulletin',
      title: `Publish ${season.name} competition bulletin`,
      summary: `${recipientCount} recipients · ${scheduleChanges} schedule change${scheduleChanges === 1 ? '' : 's'} · draft is ready to send.`,
      workstreamId: 'comms',
      tier: TIER.APPROVAL,
      priority: PRIORITY.MED,
      createdAt: createdAtFor('publish-bulletin', now),
      dueAt: toISODateTime(addDays(now, 2)),
      recommendation: 'Send to all audiences',
      recommendationTag: 'green',
      rationale: 'Content is drawn from the approved calendar and the eligibility process note. Nothing in the draft pre-announces an undecided exception.',
      confidence: 0.93,
      evidence: [
        { label: 'Team contacts', value: `${db.teams.length} programs`, source: 'Team register' },
        { label: 'Conference leads', value: `${db.conferences.length} conferences`, source: 'Conference register' },
        { label: 'Officials', value: `${db.officials.filter((o) => o.email).length} of ${db.officials.length} reachable`, source: 'Officials register' },
        { label: 'Schedule changes referenced', value: String(scheduleChanges), source: 'Conflict scan' },
      ],
      options: [
        { label: 'Send to all audiences', status: DECISION_STATUS.APPROVED },
        { label: 'Send to team contacts only', status: DECISION_STATUS.APPROVED },
        { label: 'Return to draft', status: DECISION_STATUS.REJECTED },
      ],
      subjectType: 'communication',
      subjectId: 'comm-fall-bulletin',
    }),
    makeDecision({
      id: 'd-approve-calendar',
      title: `Approve revised ${season.name} calendar`,
      summary: scheduleChanges
        ? `${scheduleChanges} conflict${scheduleChanges === 1 ? '' : 's'} found in the latest scan. Approving locks the calendar for publication.`
        : 'The latest scan found no conflicts. Approving locks the calendar for publication.',
      workstreamId: 'competition',
      tier: TIER.APPROVAL,
      priority: PRIORITY.MED,
      createdAt: createdAtFor('approve-calendar', now),
      dueAt: `${season.registrationCloses}T17:00`,
      recommendation: scheduleChanges ? 'Approve once conflicts are resolved' : 'Approve and lock',
      recommendationTag: scheduleChanges ? 'orange' : 'green',
      rationale: 'Locking the calendar is what lets programs book travel. It should not happen while a fixture is still contested.',
      confidence: 0.87,
      evidence: [
        { label: 'Fixtures', value: `${(ix.fixturesBySeason[season.id] || []).length} scheduled`, source: 'Competition calendar' },
        { label: 'Open conflicts', value: String(scheduleChanges), source: 'Conflict scan' },
        { label: 'Committee review', value: fmtFull('2026-08-22'), source: 'Milestones' },
      ],
      options: [
        { label: 'Approve and lock the calendar', status: DECISION_STATUS.APPROVED },
        { label: 'Approve with exceptions noted', status: DECISION_STATUS.APPROVED },
        { label: 'Return for revision', status: DECISION_STATUS.REJECTED },
      ],
      subjectType: 'season',
      subjectId: season.id,
    }),
  ];
}

function sortDecisions(decisions) {
  return decisions.sort((a, b) => (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || (a.dueAt || '9999').localeCompare(b.dueAt || '9999')
    || b.createdAt.localeCompare(a.createdAt)
  ));
}

/**
 * @returns {{ decisions: object[], autonomousWork: object[] }}
 *   `autonomousWork` is what the agents handled without asking — it drives the
 *   live feed, the "completed autonomously" count, and the audit log.
 */
export function buildDecisions(db, ix, { eligibility, conflicts, now = new Date() }) {
  const season = ix.seasonById[db.activeSeasonId];
  const allFindings = [...eligibility.findings, ...conflicts.findings];

  const autonomousWork = allFindings.filter((f) => f.tier === TIER.AUTONOMOUS);
  const needsHuman = allFindings.filter((f) => f.tier !== TIER.AUTONOMOUS);

  const decisions = [];
  const batches = {};

  for (const finding of needsHuman) {
    if (BATCHED_CODES.has(finding.code)) {
      (batches[finding.code] ||= []).push(finding);
      continue;
    }
    decisions.push(decisionFromFinding(finding, season, now));
  }

  for (const [code, group] of Object.entries(batches)) {
    // A single instance is clearer on its own than as a batch of one.
    if (group.length === 1) decisions.push(decisionFromFinding(group[0], season, now));
    else decisions.push(batchDecision(code, group, season, now, ix));
  }

  decisions.push(...operationalDecisions(db, ix, {
    season,
    conflictFindings: conflicts.findings,
    now,
  }));

  return { decisions: sortDecisions(decisions), autonomousWork };
}

/**
 * Live feed entries describing what the agents actually did, grouped so the
 * feed reads like a colleague's summary rather than a log tail.
 */
export function buildActivityFeed(db, ix, { autonomousWork, eligibility, conflicts, now = new Date() }) {
  const season = ix.seasonById[db.activeSeasonId];
  const fixtureCount = (ix.fixturesBySeason[season.id] || []).length;
  const missingDocs = autonomousWork.filter((f) => f.code === FINDING_CODE.TEAM_DOC_MISSING);
  const travel = autonomousWork.filter((f) => f.code === FINDING_CODE.TRAVEL_LOAD);
  const shortRosters = autonomousWork.filter((f) => f.code === FINDING_CODE.ROSTER_MINIMUM);

  const entries = [
    {
      id: 'feed-reconcile',
      agentId: 'atlas',
      icon: '↻',
      tone: 'blue',
      title: 'Reconciled team rosters',
      detail: `${db.teams.length} teams and ${db.players.length.toLocaleString('en-US')} player records checked against the registration system.`,
      minutesAgo: 2,
    },
    {
      id: 'feed-conflicts',
      agentId: 'atlas',
      icon: '✓',
      tone: 'green',
      title: 'Scanned the competition calendar',
      detail: `${fixtureCount} fixtures checked · ${conflicts.findings.length} issue${conflicts.findings.length === 1 ? '' : 's'} raised.`,
      minutesAgo: 18,
    },
    {
      id: 'feed-bulletin',
      agentId: 'herald',
      icon: '✉',
      tone: 'purple',
      title: 'Drafted coach update',
      detail: `“Three things changing for ${season.name}.” Held for approval.`,
      minutesAgo: 41,
    },
  ];

  if (missingDocs.length) {
    entries.push({
      id: 'feed-docs',
      agentId: 'atlas',
      icon: '!',
      tone: 'amber',
      title: 'Chased missing documentation',
      detail: `${missingDocs.length} team${missingDocs.length === 1 ? '' : 's'} need follow-up before ${fmtShort(season.registrationCloses)}. Reminders sent.`,
      minutesAgo: 63,
    });
  }

  if (travel.length) {
    entries.push({
      id: 'feed-travel',
      agentId: 'atlas',
      icon: '↗',
      tone: 'blue',
      title: 'Flagged travel load',
      detail: `${travel.length} program${travel.length === 1 ? '' : 's'} with three or more consecutive away fixtures. Programs notified.`,
      minutesAgo: 96,
    });
  }

  if (shortRosters.length) {
    entries.push({
      id: 'feed-rosters',
      agentId: 'atlas',
      icon: '!',
      tone: 'amber',
      title: 'Notified short rosters',
      detail: `${shortRosters.length} program${shortRosters.length === 1 ? '' : 's'} below the ${season.rosterMinimum}-player minimum.`,
      minutesAgo: 124,
    });
  }

  entries.push({
    id: 'feed-eligibility',
    agentId: 'atlas',
    icon: '◆',
    tone: 'green',
    title: 'Completed eligibility audit',
    detail: `${eligibility.findings.length} finding${eligibility.findings.length === 1 ? '' : 's'} across ${db.teams.length} programs.`,
    minutesAgo: 152,
  });

  return entries
    .map((entry) => ({ ...entry, at: toISODateTime(new Date(now.getTime() - entry.minutesAgo * 60000)) }))
    .sort((a, b) => a.minutesAgo - b.minutesAgo);
}
