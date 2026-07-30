/**
 * Command center — the one screen that answers "what needs me today".
 */

import { html, join } from '../util/dom.js';
import {
  selectOpenDecisions, selectDueToday, selectAgents, selectAgentConfidence,
  selectNextMilestone, selectSeason,
} from '../store.js';
import { WORKSTREAM_BY_ID, AGENT_STATUS_META, TIER } from '../data/schema.js';
import { fmtRelative, fmtCountdown, fmtMonthAbbr, parseDate, daysUntil } from '../util/date.js';
import { decisionItem, metricCard, emptyState } from './shared.js';

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function renderCommand(state) {
  const { db, ix, derived } = state;
  const open = selectOpenDecisions();
  const dueToday = selectDueToday();
  const agents = selectAgents();
  const confidence = selectAgentConfidence();
  const milestone = selectNextMilestone();
  const season = selectSeason();
  const online = agents.filter((a) => a.status !== 'paused').length;
  const humanOnly = open.filter((d) => d.tier === TIER.HUMAN_ONLY).length;

  return html`
    <div class="hero-row">
      <div>
        <h2>${greeting()}, ${db.organization.operator.name}.</h2>
        <p class="subhead">
          ${db.agents.length} specialist agents are running ${db.organization.name}.
          ${open.length === 0
            ? 'Nothing is waiting on you.'
            : html`You have <strong>${open.length} decision${open.length === 1 ? '' : 's'}</strong> waiting${humanOnly ? html`, ${humanOnly} of which ${humanOnly === 1 ? 'is' : 'are'} yours alone to make` : ''}.`}
        </p>
      </div>
      <button class="primary-btn" data-action="run-brief">Run the operating brief <span>✦</span></button>
    </div>

    <div class="metric-grid">
      ${metricCard({
        label: 'Open decisions',
        value: open.length,
        note: dueToday ? `${dueToday} due today` : 'None due today',
        tone: dueToday ? 'orange' : '',
      })}
      ${metricCard({
        label: 'Agents online',
        value: `${online} / ${db.agents.length}`,
        note: state.overlay.agentsPaused ? 'All agents paused' : `Across ${new Set(db.agents.map((a) => a.workstreamId)).size} workstreams`,
      })}
      ${metricCard({
        label: 'Next milestone',
        value: milestone ? fmtCountdown(milestone.date).replace(' days', 'd') : '—',
        note: milestone ? milestone.title : 'Nothing scheduled',
      })}
      ${metricCard({
        label: 'Agent confidence',
        value: confidence === null ? '—' : `${confidence}%`,
        note: confidence === null
          ? 'No open recommendations'
          : `Mean across ${open.filter((d) => typeof d.confidence === 'number').length} recommendations`,
      })}
    </div>

    <section class="panel agent-overview">
      <div class="panel-head">
        <div>
          <span class="eyebrow">FEDERATION OPERATING SYSTEM</span>
          <h3>Agent roster</h3>
        </div>
        <button class="text-btn" data-action="navigate" data-view="agents">Manage agents →</button>
      </div>
      <div class="agent-roster">
        ${join(agents.slice(0, 6).map((agent) => {
          const workstream = WORKSTREAM_BY_ID[agent.workstreamId];
          const meta = AGENT_STATUS_META[agent.status];
          return html`<div class="roster-card">
            <span class="roster-icon ${workstream.color}">${workstream.icon}</span>
            <div>
              <strong>${agent.name} · ${workstream.name}</strong>
              <small>${agent.currentRun}</small>
            </div>
            <span class="agent-state ${meta.cls}">${meta.label}</span>
          </div>`;
        }))}
      </div>
    </section>

    <div class="section-grid">
      <section class="panel approvals">
        <div class="panel-head">
          <div>
            <span class="eyebrow">NEEDS YOU</span>
            <h3>Approval queue</h3>
          </div>
          <button class="text-btn" data-action="navigate" data-view="decisions">View all →</button>
        </div>
        ${open.length
          ? join(open.slice(0, 4).map((decision) => decisionItem(decision, ix)))
          : emptyState('The queue is clear.', 'Every open item has been decided and logged.')}
      </section>

      <section class="panel activity">
        <div class="panel-head">
          <div>
            <span class="eyebrow">LIVE FEED</span>
            <h3>What the agents are doing</h3>
          </div>
          <span class="live-pill"><i></i> ${state.overlay.agentsPaused ? 'Paused' : 'Live'}</span>
        </div>
        <div class="feed">
          ${join(derived.feed.map((entry) => {
            const agent = ix.agentById[entry.agentId];
            return html`<div class="feed-item">
              <span class="feed-icon ${entry.tone}">${entry.icon}</span>
              <div>
                <strong>${entry.title}</strong>
                <p>${entry.detail}</p>
                <small>${agent ? `${agent.name} · ` : ''}${fmtRelative(entry.at)}</small>
              </div>
            </div>`;
          }))}
        </div>
      </section>
    </div>

    <section class="panel next-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">UP NEXT</span>
          <h3>Milestones & deadlines</h3>
        </div>
        <button class="text-btn" data-action="navigate" data-view="calendar">Open calendar →</button>
      </div>
      <div class="timeline">
        ${join(db.milestones
          .filter((m) => daysUntil(m.date) >= 0)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 4)
          .map((m) => {
            const days = daysUntil(m.date);
            return html`<div class="timeline-item">
              <span class="date-box">
                <b>${fmtMonthAbbr(m.date)}</b>
                <strong>${String(parseDate(m.date).getDate()).padStart(2, '0')}</strong>
              </span>
              <div>
                <strong>${m.title}</strong>
                <p>${m.description}</p>
              </div>
              <span class="tag ${days <= 21 ? 'orange' : ''}">${fmtCountdown(m.date)}</span>
            </div>`;
          }))}
      </div>
    </section>

    <p class="computed-note">
      Every figure on this page is computed from ${db.teams.length} teams,
      ${db.players.length.toLocaleString('en-US')} player records and
      ${db.fixtures.length.toLocaleString('en-US')} fixtures ·
      last recomputed ${fmtRelative(derived.computedAt)} · season ${season.name}
    </p>`;
}
