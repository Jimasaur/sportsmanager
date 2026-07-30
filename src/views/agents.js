/**
 * Agent roster — the control plane itself. What each specialist is doing, what
 * it may do without asking, and where the operator's hand stays on the wheel.
 */

import { html, join, pct } from '../util/dom.js';
import { selectAgents, selectOperatingLoad, selectOpenDecisions } from '../store.js';
import { WORKSTREAM_BY_ID, AGENT_STATUS_META, TIER, TIER_META } from '../data/schema.js';
import { pageIntro } from './shared.js';

export function renderAgents(state) {
  const agents = selectAgents();
  const load = selectOperatingLoad();
  const open = selectOpenDecisions();
  const paused = state.overlay.agentsPaused;
  const total = load.autonomous + load.drafted + load.blocked;

  const actions = paused
    ? `<button class="ghost-btn" data-action="resume-agents">Resume all agents</button>
       <button class="primary-btn" data-action="run-brief">Run operating brief <span>✦</span></button>`
    : `<button class="ghost-btn" data-action="pause-agents">Pause all agents</button>
       <button class="primary-btn" data-action="run-brief">Run operating brief <span>✦</span></button>`;

  return html`
    ${pageIntro({
      eyebrow: 'CONTROL PLANE',
      title: 'Agent roster',
      subhead: 'Specialists do the work. You set direction, approve consequential actions, and can pause anything.',
      actions,
    })}

    ${paused ? html`<div class="banner banner-warn">
      All agents are paused. Running work stopped at its last safe checkpoint; nothing new will be drafted until you resume.
    </div>` : ''}

    <div class="agent-control-grid">
      <div class="panel control-summary">
        <span class="eyebrow">SYSTEM STATUS</span>
        <h3>Human-directed autonomy</h3>
        <p>
          Agents read, reconcile, draft, calculate, and recommend. External sends, policy exceptions,
          spending, and personnel decisions stay behind your approval gate. Every tier below is enforced
          in the rules engine, not just described here.
        </p>
        <div class="guardrail-list">
          ${join([TIER.AUTONOMOUS, TIER.APPROVAL, TIER.HUMAN_ONLY].map((tier) => {
            const meta = TIER_META[tier];
            const count = tier === TIER.AUTONOMOUS
              ? load.autonomous
              : open.filter((d) => d.tier === tier).length;
            return html`<div>
              <span><i class="guard-dot ${meta.dot}"></i>${meta.label}</span>
              <small>${meta.blurb}</small>
              <em class="guard-count">${count} today</em>
            </div>`;
          }))}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">DECISION FUNNEL</span>
            <h3>Today's operating load</h3>
          </div>
        </div>
        <div class="funnel">
          <div>
            <span>Completed autonomously</span>
            <strong>${load.autonomous}</strong>
            <i style="width:${pct(load.autonomous, total || 1)}%"></i>
          </div>
          <div>
            <span>Drafted for approval</span>
            <strong>${load.drafted}</strong>
            <i style="width:${pct(load.drafted, total || 1)}%"></i>
          </div>
          <div>
            <span>Reserved for you</span>
            <strong>${load.blocked}</strong>
            <i style="width:${pct(load.blocked, total || 1)}%"></i>
          </div>
          <div>
            <span>Decided and logged</span>
            <strong>${load.resolved}</strong>
            <i style="width:${pct(load.resolved, total || 1)}%"></i>
          </div>
        </div>
        <p class="funnel-note">
          ${load.autonomous} of ${total} actions needed no one's attention. That ratio is the product.
        </p>
      </div>
    </div>

    <div class="panel roster-table-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">WORKSTREAMS</span>
          <h3>Eight specialist agents, one command surface</h3>
        </div>
        <button class="text-btn" data-action="navigate" data-view="audit">View audit trail →</button>
      </div>
      <div class="roster-table">
        <div class="roster-table-row roster-table-head">
          <span>Agent</span><span>Primary work</span><span>Current run</span><span>Human gate</span><span>Status</span>
        </div>
        ${join(agents.map((agent) => {
          const workstream = WORKSTREAM_BY_ID[agent.workstreamId];
          const meta = AGENT_STATUS_META[agent.status];
          return html`<div class="roster-table-row">
            <strong>${agent.name}<small class="row-sub">${workstream.name}</small></strong>
            <span>${workstream.work}</span>
            <span>${paused ? 'Stopped at checkpoint' : agent.currentRun}</span>
            <span>${workstream.gate}</span>
            <span class="agent-state ${meta.cls}">${meta.label}${agent.openDecisions ? ` · ${agent.openDecisions}` : ''}</span>
          </div>`;
        }))}
      </div>
    </div>`;
}
