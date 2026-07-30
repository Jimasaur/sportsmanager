/**
 * Audit trail.
 *
 * "Receipts over vibes" only means something if the record is a first-class
 * screen rather than a debug log. Human actions and agent actions are shown in
 * the same stream and labelled by actor.
 */

import { html, join } from '../util/dom.js';
import { selectAudit, selectDecisions } from '../store.js';
import { DECISION_STATUS } from '../data/schema.js';
import { fmtRelative, fmtFull } from '../util/date.js';
import { pageIntro, emptyState } from './shared.js';

export function renderAudit(state) {
  const events = selectAudit(80);
  const decided = selectDecisions().filter((d) => d.status !== DECISION_STATUS.OPEN);
  const humanEvents = events.filter((e) => e.actorKind === 'human').length;

  return html`
    ${pageIntro({
      eyebrow: 'ACCOUNTABILITY',
      title: 'Audit trail',
      subhead: 'Every action taken in this workspace, by a person or an agent, in the order it happened.',
      actions: '<button class="ghost-btn" data-action="reset-workspace">Reset workspace</button>',
    })}

    <div class="metric-grid">
      <div class="metric-card">
        <span>Logged events</span><strong>${events.length}</strong><small>This workspace</small>
      </div>
      <div class="metric-card">
        <span>Human actions</span><strong>${humanEvents}</strong><small>Taken by the operator</small>
      </div>
      <div class="metric-card">
        <span>Decisions recorded</span><strong>${decided.length}</strong><small>With outcome and note</small>
      </div>
      <div class="metric-card">
        <span>Retention</span><strong>500</strong><small>Most recent events kept locally</small>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">EVENT LOG</span>
          <h3>What has happened here</h3>
        </div>
      </div>
      ${events.length === 0
        ? emptyState(
          'Nothing logged yet.',
          'Approve a decision, tick a runbook item, or pause the agents and it will appear here.',
        )
        : html`<div class="audit-list">
            ${join(events.map((event) => html`<div class="audit-row">
              <span class="audit-actor ${event.actorKind}">${event.actorKind === 'human' ? 'YOU' : event.actor}</span>
              <div>
                <strong>${event.action}</strong>
                ${event.detail ? html`<p>${event.detail}</p>` : ''}
                <small title="${fmtFull(event.at)}">${fmtRelative(event.at)}${event.subjectType ? ` · ${event.subjectType}` : ''}</small>
              </div>
            </div>`))}
          </div>`}
    </div>

    <p class="computed-note">
      The audit trail is stored in this browser only. A production deployment would write these events
      to a durable, append-only log with the operator's identity attached.
    </p>`;
}
