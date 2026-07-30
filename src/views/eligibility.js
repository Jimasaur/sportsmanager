/**
 * Eligibility desk — the agent checks the records, the operator decides the
 * exceptions. The team table below the queue is the receipt for the summary
 * numbers at the top.
 */

import { html, join } from '../util/dom.js';
import { selectDecisions, selectSeason } from '../store.js';
import { DECISION_STATUS, TIER, SEVERITY, SEVERITY_RANK, FINDING_CODE } from '../data/schema.js';
import { fmtRelative, fmtShort, daysUntil } from '../util/date.js';
import { pageIntro, metricCard, filterBar, emptyState, tierBadge, statusTag } from './shared.js';

const TEAM_FILTERS = [
  { value: 'all', label: 'All teams' },
  { value: 'exception', label: 'Exceptions' },
  { value: 'needs_docs', label: 'Needs documents' },
  { value: 'ready', label: 'Ready' },
];

const STATUS_LABEL = {
  ready: { label: 'Ready', tag: 'green' },
  needs_docs: { label: 'Needs documents', tag: 'orange' },
  exception: { label: 'Exception', tag: 'red' },
};

/** Finding codes the eligibility engine owns — used to filter the shared queue. */
const ELIGIBILITY_CODES = new Set([
  FINDING_CODE.TEAM_DOC_MISSING, FINDING_CODE.TEAM_DOC_EXPIRED, FINDING_CODE.PLAYER_DOC_MISSING,
  FINDING_CODE.DUPLICATE_REGISTRATION, FINDING_CODE.LATE_REGISTRATION,
  FINDING_CODE.TRANSFER_WINDOW, FINDING_CODE.AGE_MINIMUM, FINDING_CODE.ROSTER_MINIMUM,
]);

export function renderEligibility(state) {
  const { db, ix, derived } = state;
  const season = selectSeason();
  const { summary, byTeam } = derived.teamStatus;
  const filter = state.ui.filters.eligibilityFilter;

  const exceptions = selectDecisions()
    .filter((d) => ELIGIBILITY_CODES.has(d.findingCode))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === DECISION_STATUS.OPEN ? -1 : 1;
      return (SEVERITY_RANK[a.priority === 'high' ? 'critical' : 'warning'] ?? 1)
        - (SEVERITY_RANK[b.priority === 'high' ? 'critical' : 'warning'] ?? 1);
    });

  const teams = db.teams
    .map((team) => ({ team, entry: byTeam[team.id] }))
    .filter(({ entry }) => filter === 'all' || entry.status === filter)
    .sort((a, b) => {
      const rank = { exception: 0, needs_docs: 1, ready: 2 };
      return rank[a.entry.status] - rank[b.entry.status] || a.team.name.localeCompare(b.team.name);
    });

  const criticalCount = derived.eligibility.findings.filter((f) => f.severity === SEVERITY.CRITICAL).length;

  return html`
    ${pageIntro({
      eyebrow: 'DECISION DESK',
      title: 'Eligibility desk',
      subhead: `The agent checks ${db.players.length.toLocaleString('en-US')} registrations against ${db.documents.length.toLocaleString('en-US')} documents. You decide the exceptions.`,
      actions: '<button class="primary-btn" data-action="run-brief">Run full audit <span>✦</span></button>',
    })}

    <div class="metric-grid">
      ${metricCard({
        label: 'Ready',
        value: summary.ready,
        note: `${Math.round((summary.ready / summary.total) * 100)}% of teams`,
        tone: 'green',
      })}
      ${metricCard({
        label: 'Needs documents',
        value: summary.needsDocs,
        note: 'Follow-up drafted',
        tone: 'orange',
      })}
      ${metricCard({
        label: 'Exceptions',
        value: summary.exceptions,
        note: `${criticalCount} require human review`,
        tone: 'red',
      })}
      ${metricCard({
        label: 'Registration closes',
        value: `${daysUntil(season.registrationCloses)}d`,
        note: fmtShort(season.registrationCloses),
      })}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">EXCEPTION QUEUE</span>
          <h3>Decisions the agent will not make alone</h3>
        </div>
        <span class="tag">${exceptions.filter((d) => d.status === DECISION_STATUS.OPEN).length} open</span>
      </div>
      ${exceptions.length === 0
        ? emptyState('No exceptions.', 'Every registration cleared the rules without needing a judgment call.')
        : html`<div class="table eligibility-table">
            <div class="table-row table-head">
              <span>Record</span><span>Issue</span><span>Recommendation</span><span>Action</span>
            </div>
            ${join(exceptions.map((decision) => {
              const team = decision.subjectType === 'team' || decision.subjectType === 'player'
                ? ix.teamById[decision.subjectId] || ix.teamById[ix.playerById[decision.subjectId]?.teamId]
                : null;
              const player = ix.playerById[decision.subjectId];
              return html`<div class="table-row">
                <span>
                  <strong>${team ? team.name : 'Multiple programs'}</strong>
                  <small>${player ? `${player.firstName} ${player.lastName} · #${player.registrationId}` : decision.summary.slice(0, 48)}</small>
                </span>
                <span>${decision.title}<small class="row-sub">${tierBadge(decision.tier)}</small></span>
                <span>
                  ${decision.tier === TIER.HUMAN_ONLY
                    ? html`<span class="tag red">No recommendation — yours to make</span>`
                    : html`<span class="tag ${decision.recommendationTag || 'orange'}">${decision.recommendation}</span>`}
                </span>
                ${decision.status === DECISION_STATUS.OPEN
                  ? html`<button class="approve-btn" data-action="open-decision" data-id="${decision.id}">Review</button>`
                  : html`<span class="resolved-cell">${statusTag(decision.status)}<small>${fmtRelative(decision.resolvedAt)}</small></span>`}
              </div>`;
            }))}
          </div>`}
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">PROGRAM STATUS</span>
          <h3>All ${db.teams.length} programs</h3>
        </div>
      </div>
      <div class="toolbar">${filterBar('eligibilityFilter', TEAM_FILTERS, filter)}</div>
      ${teams.length === 0
        ? emptyState('No programs match this filter.')
        : html`<div class="table team-table">
            <div class="table-row table-head">
              <span>Program</span><span>Conference</span><span>Roster</span><span>Status</span>
            </div>
            ${join(teams.map(({ team, entry }) => {
              const meta = STATUS_LABEL[entry.status];
              const roster = ix.playersByTeam[team.id] || [];
              const issues = entry.findings;
              return html`<div class="table-row">
                <span>
                  <strong>${team.name}</strong>
                  <small>${team.city}, ${team.state}</small>
                </span>
                <span>${ix.conferenceById[team.conferenceId].name}</span>
                <span>${roster.length} players${issues.length ? html`<small class="row-sub">${issues.map((f) => f.title).join(' · ')}</small>` : ''}</span>
                <span><span class="tag ${meta.tag}">${meta.label}</span></span>
              </div>`;
            }))}
          </div>`}
    </div>

    <p class="computed-note">
      ${derived.eligibility.findings.length} findings from
      ${db.players.length.toLocaleString('en-US')} registrations ·
      recomputed ${fmtRelative(derived.computedAt)}
    </p>`;
}
