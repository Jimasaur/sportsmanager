/**
 * Presentation pieces used by more than one view.
 *
 * Views are pure `state -> HTML string` functions. Anything interactive carries
 * a `data-action` attribute; the shell has one delegated listener for all of it.
 */

import { html, join, raw } from '../util/dom.js';
import {
  TIER, TIER_META, DECISION_STATUS, DECISION_STATUS_META, WORKSTREAM_BY_ID,
} from '../data/schema.js';
import { fmtRelative, fmtShort, daysUntil } from '../util/date.js';

export function tierBadge(tier) {
  const meta = TIER_META[tier];
  return html`<span class="tier-badge tier-${tier}"><i class="guard-dot ${meta.dot}"></i>${meta.label}</span>`;
}

export function priorityBadge(priority) {
  const label = { high: 'HIGH', med: 'MED', low: 'LOW' }[priority] || 'MED';
  return html`<div class="priority ${priority}">${label}</div>`;
}

export function statusTag(status) {
  const meta = DECISION_STATUS_META[status] || DECISION_STATUS_META.open;
  return html`<span class="tag ${meta.tag}">${meta.label}</span>`;
}

export function dueLabel(decision) {
  if (!decision.dueAt) return '';
  const days = daysUntil(decision.dueAt);
  if (days < 0) return html`<span class="due overdue">Overdue</span>`;
  if (days === 0) return html`<span class="due overdue">Due today</span>`;
  if (days === 1) return html`<span class="due soon">Due tomorrow</span>`;
  return html`<span class="due">Due ${fmtShort(decision.dueAt)}</span>`;
}

/**
 * The receipts. Every decision shows the records it was built from, because a
 * recommendation the operator cannot check is a recommendation they have to
 * take on faith.
 */
export function evidenceList(evidence) {
  if (!evidence?.length) return html`<p class="muted-copy">No supporting records attached.</p>`;
  return html`<dl class="evidence">
    ${join(evidence.map((item) => html`
      <div class="evidence-row">
        <dt>${item.label}</dt>
        <dd>${item.value}<span class="evidence-source">${item.source}</span></dd>
      </div>`))}
  </dl>`;
}

export function agentAttribution(workstreamId, ix) {
  const agent = ix.agentByWorkstream[workstreamId];
  const workstream = WORKSTREAM_BY_ID[workstreamId];
  if (!agent) return html`<span class="attribution">${workstream?.name || 'Unassigned'}</span>`;
  return html`<span class="attribution"><i class="roster-icon ${workstream.color}">${workstream.icon}</i>${agent.name} · ${workstream.name}</span>`;
}

/** One row in the approval queue. */
export function decisionItem(decision, ix, { showStatus = false } = {}) {
  const resolved = decision.status !== DECISION_STATUS.OPEN;
  return html`<div class="approval-item">
    ${priorityBadge(decision.priority)}
    <div class="approval-copy">
      <strong>${decision.title}</strong>
      <p>${decision.summary}</p>
      <div class="approval-meta">
        ${tierBadge(decision.tier)}
        ${agentAttribution(decision.workstreamId, ix)}
        ${showStatus && resolved ? statusTag(decision.status) : ''}
        ${!resolved ? dueLabel(decision) : ''}
        <small>${resolved ? `${DECISION_STATUS_META[decision.status].label} ${fmtRelative(decision.resolvedAt)}` : fmtRelative(decision.createdAt)}</small>
      </div>
    </div>
    <button class="approve-btn" data-action="open-decision" data-id="${decision.id}">
      ${resolved ? 'View' : 'Review'}
    </button>
  </div>`;
}

export function emptyState(title, detail = '') {
  return html`<div class="empty-state">
    <strong>${title}</strong>
    ${detail ? html`<p>${detail}</p>` : ''}
  </div>`;
}

export function metricCard({ label, value, note, tone = '' }) {
  return html`<div class="metric-card">
    <span>${label}</span>
    <strong class="${tone ? `${tone}-number` : ''}">${value}</strong>
    <small class="${tone === 'red' || tone === 'orange' ? 'warning-text' : ''}">${note}</small>
  </div>`;
}

export function filterBar(key, options, active) {
  return join(options.map((option) => html`
    <button class="filter ${option.value === active ? 'active' : ''}"
            data-action="set-filter" data-key="${key}" data-value="${option.value}">
      ${option.label}
    </button>`));
}

export function pageIntro({ eyebrow, title, subhead, actions = '' }) {
  return html`<div class="page-intro">
    <div>
      <span class="eyebrow">${eyebrow}</span>
      <h2>${title}</h2>
      <p class="subhead">${subhead}</p>
    </div>
    <div class="top-actions">${raw(actions)}</div>
  </div>`;
}

export { TIER, TIER_META, DECISION_STATUS };
