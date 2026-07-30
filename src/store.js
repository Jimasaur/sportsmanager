/**
 * Application state.
 *
 * The database is rebuilt deterministically from the seed on every load and is
 * treated as read-only. Everything the operator does lands in a separate
 * `overlay` — decision outcomes, runbook progress, communications, and the
 * audit log — and only the overlay is persisted.
 *
 * That split is deliberate. It keeps stored data small, it means a schema change
 * to the seed can never corrupt someone's saved decisions, and it makes the
 * eventual move to a server a matter of replacing two functions: load the
 * database from an API instead of the seed, and post overlay changes instead of
 * writing to localStorage.
 */

import { buildDatabase } from './data/seed.js';
import { buildIndexes } from './data/indexes.js';
import { runEligibilityAudit, summariseByTeam } from './rules/eligibility.js';
import { detectScheduleConflicts } from './rules/conflicts.js';
import { buildDecisions, buildActivityFeed } from './rules/decisions.js';
import { makeAuditEvent, DECISION_STATUS, TIER, COMM_STATUS, PRIORITY_RANK } from './data/schema.js';
import { toISODateTime, fmtShort, fmtFull, daysUntil } from './util/date.js';

const STORAGE_KEY = 'sportsmanager:overlay:v1';
const OPERATOR = 'Jimmy';

function emptyOverlay() {
  return {
    decisions: {}, // id -> { status, option, note, at }
    runbook: {}, // id -> boolean
    communications: {}, // id -> { status, body, title, approvedAt }
    drafts: [], // operator-generated communications
    agentsPaused: false,
    audit: [],
    seq: 0,
  };
}

function loadOverlay() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyOverlay();
    return { ...emptyOverlay(), ...JSON.parse(stored) };
  } catch (error) {
    // Private browsing, a quota error, or corrupted JSON — start clean rather
    // than take the whole app down over persistence.
    console.warn('sportsmanager: could not read saved workspace, starting fresh.', error);
    return emptyOverlay();
  }
}

function saveOverlay(overlay) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
  } catch (error) {
    console.warn('sportsmanager: could not save workspace.', error);
  }
}

// --- Store -----------------------------------------------------------------

const listeners = new Set();

const db = buildDatabase();
const ix = buildIndexes(db);

const state = {
  db,
  ix,
  overlay: loadOverlay(),
  ui: {
    view: 'command',
    openDecisionId: null,
    toast: null,
    filters: {
      calendarMonth: null, // set on first render from the season start
      calendarConference: 'all',
      standingsConference: 'd1a-east',
      standingsSeason: db.completedSeasonId,
      eligibilityFilter: 'all',
      decisionFilter: 'open',
    },
  },
  derived: null,
};

/** Run the rule engines. Cheap enough to redo on demand, never done per render. */
function recompute(now = new Date()) {
  const eligibility = runEligibilityAudit(db, ix);
  const conflicts = detectScheduleConflicts(db, ix);
  const { decisions, autonomousWork } = buildDecisions(db, ix, { eligibility, conflicts, now });
  const teamStatus = summariseByTeam(db, eligibility.findings);
  const feed = buildActivityFeed(db, ix, { autonomousWork, eligibility, conflicts, now });

  state.derived = {
    eligibility,
    conflicts,
    decisions,
    autonomousWork,
    feed,
    teamStatus,
    computedAt: toISODateTime(now),
  };
}

recompute();

function emit() {
  for (const listener of listeners) listener(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

function persist() {
  saveOverlay(state.overlay);
}

function nextId(prefix) {
  state.overlay.seq += 1;
  return `${prefix}-${state.overlay.seq}`;
}

/** Append to the audit log. Every state-changing action goes through here. */
function audit({ action, detail, actor = OPERATOR, actorKind = 'human', subjectType = null, subjectId = null }) {
  state.overlay.audit.unshift(makeAuditEvent({
    id: nextId('ae'),
    at: toISODateTime(new Date()),
    actor,
    actorKind,
    action,
    detail,
    subjectType,
    subjectId,
  }));
  // Keep the log bounded so localStorage cannot grow without limit.
  if (state.overlay.audit.length > 500) state.overlay.audit.length = 500;
}

// --- Selectors -------------------------------------------------------------

/** Decisions with the operator's outcomes merged in. */
export function selectDecisions() {
  return state.derived.decisions.map((decision) => {
    const outcome = state.overlay.decisions[decision.id];
    if (!outcome) return decision;
    return {
      ...decision,
      status: outcome.status,
      resolvedAt: outcome.at,
      resolvedBy: outcome.actor || OPERATOR,
      chosenOption: outcome.option || null,
      note: outcome.note || '',
    };
  });
}

export function selectOpenDecisions() {
  return selectDecisions().filter((d) => d.status === DECISION_STATUS.OPEN);
}

export function selectDecision(id) {
  return selectDecisions().find((d) => d.id === id) || null;
}

export function selectDueToday() {
  return selectOpenDecisions().filter((d) => d.dueAt && daysUntil(d.dueAt) <= 0).length;
}

export function selectRunbook() {
  return state.db.runbook.map((item) => ({
    ...item,
    done: state.overlay.runbook[item.id] ?? item.done,
  }));
}

export function selectCommunications() {
  const seeded = state.db.communications.map((comm) => ({
    ...comm,
    ...(state.overlay.communications[comm.id] || {}),
  }));
  const drafts = state.overlay.drafts.map((comm) => ({
    ...comm,
    ...(state.overlay.communications[comm.id] || {}),
  }));
  return [...drafts, ...seeded];
}

export function selectAudit(limit = 40) {
  return state.overlay.audit.slice(0, limit);
}

export function selectAgents() {
  const paused = state.overlay.agentsPaused;
  const decisions = selectOpenDecisions();
  return state.db.agents.map((agent) => {
    const open = decisions.filter((d) => d.workstreamId === agent.workstreamId);
    let status = 'working';
    if (paused) status = 'paused';
    else if (open.some((d) => d.tier === TIER.HUMAN_ONLY)) status = 'waiting';
    else if (open.length) status = 'review';
    return { ...agent, status, openDecisions: open.length };
  });
}

/** The three-way split shown as the decision funnel. */
export function selectOperatingLoad() {
  const decisions = selectDecisions();
  return {
    autonomous: state.derived.autonomousWork.length,
    drafted: decisions.filter((d) => d.status === DECISION_STATUS.OPEN && d.tier === TIER.APPROVAL).length,
    blocked: decisions.filter((d) => d.status === DECISION_STATUS.OPEN && d.tier === TIER.HUMAN_ONLY).length,
    resolved: decisions.filter((d) => d.status !== DECISION_STATUS.OPEN).length,
  };
}

/**
 * Confidence shown on the command center: the mean confidence of the open
 * recommendations the agents are actually offering. Human-only items carry no
 * confidence and are excluded rather than counted as zero.
 */
export function selectAgentConfidence() {
  const scored = selectOpenDecisions().filter((d) => typeof d.confidence === 'number');
  if (!scored.length) return null;
  const mean = scored.reduce((sum, d) => sum + d.confidence, 0) / scored.length;
  return Math.round(mean * 100);
}

export function selectNextMilestone() {
  return state.db.milestones
    .filter((m) => daysUntil(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function selectSeason(id = state.db.activeSeasonId) {
  return state.ix.seasonById[id];
}

// --- Actions ---------------------------------------------------------------

export function navigate(view) {
  if (state.ui.view === view) return;
  state.ui.view = view;
  state.ui.openDecisionId = null;
  emit();
}

/**
 * Toasts carry a timestamp rather than being cleared through state. The shell
 * shows one when the timestamp changes and hides it on its own timer, so a
 * dismissal never triggers a re-render that would wipe a half-typed note.
 */
export function toast(message) {
  state.ui.toast = { message, at: Date.now() };
  emit();
}

export function openDecision(id) {
  state.ui.openDecisionId = id;
  emit();
}

export function closeDecision() {
  state.ui.openDecisionId = null;
  emit();
}

export function setFilter(key, value) {
  state.ui.filters[key] = value;
  emit();
}

/**
 * Record an outcome. Human-only decisions may not be resolved with the
 * agent's recommendation because there isn't one — the caller must pass an
 * explicit option, which the drawer enforces by only offering real choices.
 */
export function resolveDecision(id, { status, option = null, note = '' }) {
  const decision = selectDecision(id);
  if (!decision) return;

  state.overlay.decisions[id] = {
    status,
    option,
    note,
    at: toISODateTime(new Date()),
    actor: OPERATOR,
  };

  const verb = {
    [DECISION_STATUS.APPROVED]: 'Approved',
    [DECISION_STATUS.REJECTED]: 'Declined',
    [DECISION_STATUS.ESCALATED]: 'Escalated',
    [DECISION_STATUS.INFO_REQUESTED]: 'Requested more information on',
  }[status] || 'Updated';

  audit({
    action: `${verb} “${decision.title}”`,
    detail: [option, note].filter(Boolean).join(' · '),
    subjectType: 'decision',
    subjectId: id,
  });

  state.ui.openDecisionId = null;
  persist();
  toast(`${verb} · logged to the audit trail.`);
}

export function reopenDecision(id) {
  const decision = selectDecision(id);
  if (!decision) return;
  delete state.overlay.decisions[id];
  audit({
    action: `Reopened “${decision.title}”`,
    detail: 'Returned to the approval queue',
    subjectType: 'decision',
    subjectId: id,
  });
  persist();
  toast('Decision reopened.');
}

export function toggleRunbookItem(id) {
  const item = selectRunbook().find((entry) => entry.id === id);
  if (!item) return;
  state.overlay.runbook[id] = !item.done;
  audit({
    action: `${state.overlay.runbook[id] ? 'Completed' : 'Reopened'} runbook item “${item.label}”`,
    detail: `Owner: ${item.owner}`,
    subjectType: 'runbook',
    subjectId: id,
  });
  persist();
  emit();
}

export function setAgentsPaused(paused) {
  state.overlay.agentsPaused = paused;
  audit({
    action: paused ? 'Paused all agents' : 'Resumed all agents',
    detail: paused
      ? 'Running work stops at its next safe checkpoint'
      : 'Agents resumed from their last checkpoint',
    subjectType: 'system',
    subjectId: 'agents',
  });
  persist();
  toast(paused
    ? 'Pause requested. Running work stops at its next safe checkpoint.'
    : 'Agents resumed.');
}

/** Re-run every rule engine. This is what "recalculate" and "run audit" do. */
export function runOperatingBrief() {
  if (state.overlay.agentsPaused) {
    toast('Agents are paused. Resume them before running a brief.');
    return;
  }
  recompute();
  audit({
    action: 'Ran the operating brief',
    detail: `${state.derived.eligibility.findings.length} eligibility findings · ${state.derived.conflicts.findings.length} schedule findings`,
    actor: 'Atlas',
    actorKind: 'agent',
    subjectType: 'system',
    subjectId: 'brief',
  });
  persist();
  toast(`Brief complete · ${selectOpenDecisions().length} decisions waiting.`);
}

/**
 * Draft a bulletin from live state. The point of this action is that the copy
 * is assembled from records — if the numbers change, so does the draft.
 */
export function generateBulletin() {
  const season = selectSeason();
  const open = selectOpenDecisions();
  const conflicts = state.derived.conflicts.findings.length;
  const docGaps = state.derived.teamStatus.summary.needsDocs;
  const id = nextId('comm');

  const body = [
    `${season.name} operations update — prepared ${fmtFull(new Date())}.`,
    `The competition calendar is set. ${conflicts === 0
      ? 'The latest scan found no outstanding fixture conflicts.'
      : `The latest scan raised ${conflicts} fixture issue${conflicts === 1 ? '' : 's'}, each of which is being resolved with the programs involved.`}`,
    `Registration closes ${fmtShort(season.registrationCloses)}. ${docGaps === 0
      ? 'All programs have complete documentation on file.'
      : `${docGaps} program${docGaps === 1 ? ' has' : 's have'} outstanding documentation and will receive a direct follow-up naming the specific item required.`}`,
    `${open.length} item${open.length === 1 ? ' is' : 's are'} awaiting a decision from the competition office. No eligibility exception has been decided without review.`,
  ].join('\n\n');

  state.overlay.drafts.unshift({
    id,
    title: `${season.name} operations update`,
    workstreamId: 'comms',
    status: COMM_STATUS.DRAFT,
    audiences: ['team-contacts', 'conference-leads', 'officials'],
    createdAt: toISODateTime(new Date()),
    body,
    generated: true,
  });

  audit({
    action: 'Drafted a communications update',
    detail: 'Generated from current calendar, eligibility, and decision state',
    actor: 'Herald',
    actorKind: 'agent',
    subjectType: 'communication',
    subjectId: id,
  });
  persist();
  toast('Draft prepared. It needs your approval before it can be sent.');
}

export function approveCommunication(id) {
  const comm = selectCommunications().find((c) => c.id === id);
  if (!comm) return;
  state.overlay.communications[id] = {
    ...(state.overlay.communications[id] || {}),
    status: COMM_STATUS.APPROVED,
    approvedAt: toISODateTime(new Date()),
  };
  audit({
    action: `Approved “${comm.title}” for sending`,
    detail: `${comm.audiences.length} audiences`,
    subjectType: 'communication',
    subjectId: id,
  });
  persist();
  toast('Approved. Sending is the next gate — nothing has left yet.');
}

export function discardCommunication(id) {
  const comm = selectCommunications().find((c) => c.id === id);
  if (!comm) return;
  state.overlay.drafts = state.overlay.drafts.filter((c) => c.id !== id);
  delete state.overlay.communications[id];
  audit({
    action: `Discarded draft “${comm.title}”`,
    detail: '',
    subjectType: 'communication',
    subjectId: id,
  });
  persist();
  toast('Draft discarded.');
}

/** Clear every operator action and return to the seeded state. */
export function resetWorkspace() {
  state.overlay = emptyOverlay();
  recompute();
  persist();
  state.ui.openDecisionId = null;
  toast('Workspace reset to its seeded state.');
}

export { PRIORITY_RANK, DECISION_STATUS };
