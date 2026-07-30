/**
 * The full decision queue — every item the agents routed to a human, plus the
 * ones already decided, so the record of what was decided is as visible as the
 * work still outstanding.
 */

import { html, join } from '../util/dom.js';
import { selectDecisions } from '../store.js';
import { DECISION_STATUS, TIER, TIER_META, WORKSTREAM_BY_ID } from '../data/schema.js';
import { decisionItem, emptyState, filterBar, pageIntro } from './shared.js';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'approval', label: 'Approval required' },
  { value: 'human', label: 'Human only' },
  { value: 'resolved', label: 'Decided' },
  { value: 'all', label: 'All' },
];

function applyFilter(decisions, filter) {
  switch (filter) {
    case 'open': return decisions.filter((d) => d.status === DECISION_STATUS.OPEN);
    case 'approval': return decisions.filter((d) => d.status === DECISION_STATUS.OPEN && d.tier === TIER.APPROVAL);
    case 'human': return decisions.filter((d) => d.status === DECISION_STATUS.OPEN && d.tier === TIER.HUMAN_ONLY);
    case 'resolved': return decisions.filter((d) => d.status !== DECISION_STATUS.OPEN);
    default: return decisions;
  }
}

export function renderDecisions(state) {
  const { ix } = state;
  const filter = state.ui.filters.decisionFilter;
  const all = selectDecisions();
  const shown = applyFilter(all, filter);

  const openCount = all.filter((d) => d.status === DECISION_STATUS.OPEN).length;
  const humanCount = all.filter((d) => d.status === DECISION_STATUS.OPEN && d.tier === TIER.HUMAN_ONLY).length;

  // Group by workstream so related decisions arrive together.
  const groups = {};
  for (const decision of shown) (groups[decision.workstreamId] ||= []).push(decision);

  return html`
    ${pageIntro({
      eyebrow: 'DECISION QUEUE',
      title: 'Decisions',
      subhead: `${openCount} open · ${humanCount} reserved for you alone · every outcome is written to the audit trail.`,
      actions: '<button class="primary-btn" data-action="run-brief">Re-run the brief <span>✦</span></button>',
    })}

    <div class="toolbar">${filterBar('decisionFilter', FILTERS, filter)}</div>

    ${shown.length === 0
      ? emptyState('Nothing here.', 'No decisions match this filter.')
      : join(Object.entries(groups).map(([workstreamId, items]) => {
        const workstream = WORKSTREAM_BY_ID[workstreamId];
        const agent = ix.agentByWorkstream[workstreamId];
        return html`<section class="panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">${agent ? agent.name.toUpperCase() : 'UNASSIGNED'}</span>
              <h3>${workstream.name}</h3>
            </div>
            <span class="tag">Gate: ${workstream.gate}</span>
          </div>
          ${join(items.map((decision) => decisionItem(decision, ix, { showStatus: true })))}
        </section>`;
      }))}

    <div class="panel legend-panel">
      <span class="eyebrow">HOW THESE ARE ROUTED</span>
      <div class="legend-grid">
        ${join([TIER.AUTONOMOUS, TIER.APPROVAL, TIER.HUMAN_ONLY].map((tier) => html`
          <div>
            <span><i class="guard-dot ${TIER_META[tier].dot}"></i>${TIER_META[tier].label}</span>
            <small>${TIER_META[tier].detail}</small>
          </div>`))}
      </div>
    </div>`;
}
