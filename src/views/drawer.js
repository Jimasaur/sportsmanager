/**
 * Decision drawer — the receipts.
 *
 * This is the screen the whole product exists to make possible: the agent's
 * recommendation, the confidence behind it, the records it was built from, the
 * options available, and a note field, all in one place before anything is
 * committed. For human-only work the recommendation block is deliberately
 * replaced with a statement that the agent has not formed one.
 */

import { html, join, raw } from '../util/dom.js';
import { selectDecision } from '../store.js';
import { TIER, TIER_META, DECISION_STATUS, DECISION_STATUS_META, WORKSTREAM_BY_ID } from '../data/schema.js';
import { fmtRelative, fmtFull, daysUntil } from '../util/date.js';
import { evidenceList, tierBadge, priorityBadge, statusTag } from './shared.js';

const FALLBACK_OPTIONS = [
  { label: 'Approve', status: DECISION_STATUS.APPROVED },
  { label: 'Decline', status: DECISION_STATUS.REJECTED },
  { label: 'Escalate to the competition committee', status: DECISION_STATUS.ESCALATED },
];

export function renderDrawer(state) {
  const id = state.ui.openDecisionId;
  if (!id) return raw('');

  const decision = selectDecision(id);
  if (!decision) return raw('');

  const { ix } = state;
  const workstream = WORKSTREAM_BY_ID[decision.workstreamId];
  const agent = ix.agentByWorkstream[decision.workstreamId];
  const tierMeta = TIER_META[decision.tier];
  const resolved = decision.status !== DECISION_STATUS.OPEN;
  const options = decision.options?.length ? decision.options : FALLBACK_OPTIONS;

  // The agent's recommendation is preselected for approval-tier work, and
  // nothing is preselected when the call is the operator's alone.
  const recommendedIndex = decision.tier === TIER.HUMAN_ONLY
    ? -1
    : options.findIndex((option) => option.label === decision.recommendation);

  return html`
    <div class="drawer-scrim" data-action="close-drawer"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="${decision.title}">
      <header class="drawer-head">
        <div class="drawer-head-top">
          ${priorityBadge(decision.priority)}
          ${tierBadge(decision.tier)}
          ${resolved ? statusTag(decision.status) : ''}
          <button class="icon-nav drawer-close" data-action="close-drawer" aria-label="Close">×</button>
        </div>
        <h2>${decision.title}</h2>
        <p class="drawer-summary">${decision.summary}</p>
        <div class="drawer-attribution">
          ${agent ? html`<span><i class="roster-icon ${workstream.color}">${workstream.icon}</i>${agent.name} · ${workstream.name}</span>` : ''}
          <span>Raised ${fmtRelative(decision.createdAt)}</span>
          ${decision.dueAt ? html`<span class="${daysUntil(decision.dueAt) <= 0 ? 'overdue' : ''}">Due ${fmtFull(decision.dueAt)}</span>` : ''}
        </div>
      </header>

      <div class="drawer-body">
        <section class="drawer-section">
          <span class="eyebrow">GUARDRAIL</span>
          <p class="tier-explainer"><i class="guard-dot ${tierMeta.dot}"></i>${tierMeta.detail}</p>
        </section>

        <section class="drawer-section">
          <span class="eyebrow">${decision.tier === TIER.HUMAN_ONLY ? 'NO RECOMMENDATION' : 'RECOMMENDATION'}</span>
          ${decision.tier === TIER.HUMAN_ONLY
            ? html`<div class="recommendation human-only">
                <strong>The agent has not formed a recommendation.</strong>
                <p>
                  This decision falls under ${workstream.gate.toLowerCase()}. The agent gathered the
                  records below and stopped. The judgment is yours.
                </p>
              </div>`
            : html`<div class="recommendation">
                <strong>${decision.recommendation}</strong>
                ${decision.rationale ? html`<p>${decision.rationale}</p>` : ''}
                ${typeof decision.confidence === 'number' ? html`
                  <div class="confidence">
                    <span>Confidence</span>
                    <div class="progress"><i style="width:${Math.round(decision.confidence * 100)}%"></i></div>
                    <strong>${Math.round(decision.confidence * 100)}%</strong>
                  </div>` : ''}
              </div>`}
        </section>

        <section class="drawer-section">
          <span class="eyebrow">EVIDENCE</span>
          <p class="muted-copy">Every record this was built from. Check the work rather than trust it.</p>
          ${evidenceList(decision.evidence)}
        </section>

        ${resolved
          ? html`<section class="drawer-section">
              <span class="eyebrow">OUTCOME</span>
              <div class="outcome-block">
                <strong>${DECISION_STATUS_META[decision.status].label}${decision.chosenOption ? ` · ${decision.chosenOption}` : ''}</strong>
                <p>Recorded by ${decision.resolvedBy} ${fmtRelative(decision.resolvedAt)}.</p>
                ${decision.note ? html`<p class="outcome-note">“${decision.note}”</p>` : ''}
              </div>
              <button class="ghost-btn" data-action="reopen-decision" data-id="${decision.id}">
                Reopen this decision
              </button>
            </section>`
          : html`<section class="drawer-section">
              <span class="eyebrow">YOUR DECISION</span>
              <div class="option-list">
                ${join(options.map((option, i) => html`
                  <label class="option ${i === recommendedIndex ? 'recommended' : ''}">
                    <input type="radio" name="decision-option" value="${i}"
                           data-status="${option.status}" ${i === recommendedIndex ? 'checked' : ''}>
                    <span>${option.label}</span>
                    ${i === recommendedIndex ? html`<em>Agent's recommendation</em>` : ''}
                  </label>`))}
              </div>
              <label class="note-field">
                <span class="eyebrow">NOTE FOR THE RECORD</span>
                <textarea id="decision-note" rows="3"
                          placeholder="Why you decided this. Stored with the decision in the audit trail."></textarea>
              </label>
              <div class="drawer-actions">
                <button class="primary-btn" data-action="record-decision" data-id="${decision.id}">
                  Record decision <span>✦</span>
                </button>
                <button class="ghost-btn" data-action="close-drawer">Cancel</button>
              </div>
              <p class="drawer-footnote">
                Recording writes the outcome, the option you chose, and your note to the audit trail.
                Nothing is sent to anyone outside the organisation by this action.
              </p>
            </section>`}
      </div>
    </aside>`;
}
