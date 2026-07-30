/**
 * Application shell.
 *
 * Renders the sidebar, the topbar, the active view and the drawer, and owns the
 * single delegated event listener that every `data-action` in the app flows
 * through. Views stay pure; all mutation happens here by calling the store.
 */

import * as store from './store.js';
import { html, join, raw } from './util/dom.js';
import { fmtWeekdayBanner, addMonths, toISODate } from './util/date.js';
import { DECISION_STATUS, TIER } from './data/schema.js';

import { renderCommand } from './views/command.js';
import { renderDecisions } from './views/decisions.js';
import { renderAgents } from './views/agents.js';
import { renderCalendar, defaultMonthKey } from './views/calendar.js';
import { renderEligibility } from './views/eligibility.js';
import { renderStandings, standingsToCsv } from './views/standings.js';
import { renderComms } from './views/comms.js';
import { renderChampionships } from './views/championships.js';
import { renderAudit } from './views/audit.js';
import { renderDrawer } from './views/drawer.js';

const VIEWS = {
  command: { label: 'Command center', icon: '⌘', render: renderCommand },
  decisions: { label: 'Decisions', icon: '◎', render: renderDecisions },
  agents: { label: 'Agent roster', icon: '◉', render: renderAgents },
  calendar: { label: 'Competition calendar', icon: '◫', render: renderCalendar },
  eligibility: { label: 'Eligibility desk', icon: '✓', render: renderEligibility },
  standings: { label: 'Standings & rankings', icon: '↗', render: renderStandings },
  comms: { label: 'Communications', icon: '✉', render: renderComms },
  championships: { label: 'Championship ops', icon: '◆', render: renderChampionships },
  audit: { label: 'Audit trail', icon: '❑', render: renderAudit },
};

const root = document.querySelector('#app');
let lastToastAt = 0;
let toastTimer = null;

// --- Shell chrome ----------------------------------------------------------

function badgeFor(view, state) {
  const open = store.selectOpenDecisions();
  if (view === 'decisions') return open.length || null;
  if (view === 'agents') return state.db.agents.length;
  if (view === 'eligibility') return state.derived.teamStatus.summary.exceptions || null;
  return null;
}

function renderSidebar(state) {
  const { db } = state;
  const agents = store.selectAgents();
  const lead = agents[0];
  const paused = state.overlay.agentsPaused;

  return html`
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">S</span>
        <span>sports<span class="muted">manager</span></span>
      </div>
      <div class="workspace-switcher">
        <span class="status-dot ${paused ? 'paused' : ''}"></span>
        <span>${db.organization.name}</span>
        <span class="chevron">⌄</span>
      </div>
      <nav class="nav">
        ${join(Object.entries(VIEWS).map(([key, view]) => {
          const badge = badgeFor(key, state);
          return html`<button class="nav-item ${state.ui.view === key ? 'active' : ''}"
                              data-action="navigate" data-view="${key}">
            <span>${view.icon}</span> ${view.label}
            ${badge ? html`<b>${badge}</b>` : ''}
          </button>`;
        }))}
      </nav>
      <div class="sidebar-bottom">
        <div class="agent-card">
          <div class="agent-avatar">${lead.name[0]}</div>
          <div>
            <strong>${lead.name}</strong>
            <small>Competition agent
              <span class="${paused ? 'offline' : 'online'}">● ${paused ? 'paused' : 'online'}</span>
            </small>
          </div>
          <button class="icon-btn" data-action="${paused ? 'resume-agents' : 'pause-agents'}"
                  title="${paused ? 'Resume all agents' : 'Pause all agents'}">
            ${paused ? '▶' : '❚❚'}
          </button>
        </div>
        <div class="audit-note">Every action is drafted, logged, and approval-gated.</div>
      </div>
    </aside>`;
}

function renderTopbar(state) {
  const { db } = state;
  const open = store.selectOpenDecisions();
  const humanOnly = open.filter((d) => d.tier === TIER.HUMAN_ONLY).length;

  return html`
    <header class="topbar">
      <div>
        <div class="eyebrow">${fmtWeekdayBanner()}</div>
        <h1>${VIEWS[state.ui.view].label}</h1>
      </div>
      <div class="top-actions">
        ${open.length ? html`<button class="ghost-btn" data-action="navigate" data-view="decisions">
          ${open.length} waiting${humanOnly ? ` · ${humanOnly} yours` : ''} <span>↗</span>
        </button>` : html`<span class="tag green">Queue clear</span>`}
        <div class="user-chip" title="${db.organization.operator.name}">${db.organization.operator.initial}</div>
      </div>
    </header>`;
}

function render(state) {
  const view = VIEWS[state.ui.view] || VIEWS.command;
  root.innerHTML = html`
    <div class="app-shell">
      ${renderSidebar(state)}
      <main class="main">
        ${renderTopbar(state)}
        <section class="content">${view.render(state)}</section>
      </main>
    </div>
    ${renderDrawer(state)}
    <div class="toast" id="toast"></div>`.toString();

  showToastIfNew(state);
}

function showToastIfNew(state) {
  const toast = state.ui.toast;
  const node = document.querySelector('#toast');
  if (!node || !toast || toast.at === lastToastAt) return;
  lastToastAt = toast.at;
  node.textContent = toast.message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

// --- Actions ---------------------------------------------------------------

function downloadCsv(filename, contents) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Read the drawer's selected option and note, then record the outcome. */
function recordDecision(id) {
  const selected = document.querySelector('input[name="decision-option"]:checked');
  if (!selected) {
    store.toast('Choose an option before recording the decision.');
    return;
  }
  const decision = store.selectDecision(id);
  const options = decision.options?.length ? decision.options : null;
  const option = options ? options[Number(selected.value)] : null;

  store.resolveDecision(id, {
    status: selected.dataset.status || DECISION_STATUS.APPROVED,
    option: option ? option.label : null,
    note: document.querySelector('#decision-note')?.value.trim() || '',
  });
}

function shiftCalendar(delta) {
  const state = store.getState();
  // Fall back to whatever the calendar is actually showing, not to today, so
  // the first click steps from the visible month.
  const key = state.ui.filters.calendarMonth || defaultMonthKey(store.selectSeason());
  const [year, month] = key.split('-').map(Number);
  const next = addMonths(new Date(year, month - 1, 1, 12, 0, 0, 0), delta);
  store.setFilter('calendarMonth', toISODate(next).slice(0, 7));
}

const ACTIONS = {
  navigate: (el) => store.navigate(el.dataset.view),
  'open-decision': (el) => store.openDecision(el.dataset.id),
  'close-drawer': () => store.closeDecision(),
  'record-decision': (el) => recordDecision(el.dataset.id),
  'reopen-decision': (el) => store.reopenDecision(el.dataset.id),
  'toggle-runbook': (el) => store.toggleRunbookItem(el.dataset.id),
  'pause-agents': () => store.setAgentsPaused(true),
  'resume-agents': () => store.setAgentsPaused(false),
  'run-brief': () => store.runOperatingBrief(),
  recalculate: () => {
    store.runOperatingBrief();
    store.toast('Rankings recalculated from the recorded results.');
  },
  'generate-bulletin': () => store.generateBulletin(),
  'approve-comm': (el) => store.approveCommunication(el.dataset.id),
  'discard-comm': (el) => store.discardCommunication(el.dataset.id),
  'set-filter': (el) => store.setFilter(el.dataset.key, el.dataset.value),
  'calendar-shift': (el) => shiftCalendar(Number(el.dataset.delta)),
  'calendar-today': () => store.setFilter('calendarMonth', toISODate(new Date()).slice(0, 7)),
  'export-standings': () => {
    const state = store.getState();
    const { standingsSeason, standingsConference } = state.ui.filters;
    downloadCsv(`standings-${standingsSeason}-${standingsConference}.csv`, standingsToCsv(state));
    store.toast('CSV exported from the current table.');
  },
  'reset-workspace': () => store.resetWorkspace(),
};

root.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const handler = ACTIONS[el.dataset.action];
  if (!handler) return;
  // Checkboxes drive their own state; everything else is a button.
  if (el.tagName !== 'INPUT') event.preventDefault();
  handler(el);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && store.getState().ui.openDecisionId) store.closeDecision();
});

store.subscribe(render);
render(store.getState());
