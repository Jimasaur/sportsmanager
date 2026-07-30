/**
 * Championship operations — the runbook, with its completion figure derived
 * from the checklist rather than asserted.
 */

import { html, join, pct } from '../util/dom.js';
import { selectRunbook } from '../store.js';
import { TIER_META } from '../data/schema.js';
import { daysUntil, fmtFull } from '../util/date.js';
import { pageIntro, metricCard } from './shared.js';

export function renderChampionships(state) {
  const { db, ix } = state;
  const runbook = selectRunbook();
  const done = runbook.filter((item) => item.done).length;
  const complete = pct(done, runbook.length);
  const event = db.milestones.find((m) => m.workstreamId === 'championships');
  const days = event ? daysUntil(event.date) : null;

  const venue = ix.venueById['venue-life'];
  const remaining = runbook.filter((item) => !item.done);

  return html`
    ${pageIntro({
      eyebrow: 'EVENT CONTROL',
      title: 'Championship ops',
      subhead: 'Run the event without losing the plot. Each runbook item carries an owner and the gate that governs it.',
      actions: '<button class="ghost-btn" data-action="navigate" data-view="calendar">Open the calendar ↗</button>',
    })}

    <div class="metric-grid">
      ${metricCard({
        label: 'Days to kickoff',
        value: days === null ? '—' : days,
        note: event ? fmtFull(event.date) : 'Not scheduled',
        tone: days !== null && days < 30 ? 'orange' : '',
      })}
      ${metricCard({ label: 'Runbook complete', value: `${complete}%`, note: `${done} of ${runbook.length} items` })}
      ${metricCard({
        label: 'Outstanding',
        value: remaining.length,
        note: remaining.length ? remaining[0].label : 'Nothing outstanding',
        tone: remaining.length ? 'orange' : 'green',
      })}
      ${metricCard({ label: 'Venue', value: venue ? venue.capacity.toLocaleString('en-US') : '—', note: venue ? venue.name : 'To be confirmed' })}
    </div>

    <div class="champ-grid">
      <div class="panel checklist">
        <div class="panel-head">
          <div>
            <span class="eyebrow">RUNBOOK</span>
            <h3>Critical path</h3>
          </div>
          <span class="tag ${remaining.length === 0 ? 'green' : complete >= 60 ? '' : 'orange'}">
            ${remaining.length === 0 ? 'Complete' : complete >= 60 ? 'On track' : 'Behind'}
          </span>
        </div>
        <div class="mini-progress runbook-progress"><i style="width:${complete}%"></i></div>
        ${join(runbook.map((item) => {
          const meta = TIER_META[item.tier];
          return html`<label class="runbook-item ${item.done ? 'done' : ''}">
            <input type="checkbox" ${item.done ? 'checked' : ''} data-action="toggle-runbook" data-id="${item.id}">
            <span class="runbook-label">${item.label}</span>
            <span class="runbook-meta">
              <i class="guard-dot ${meta.dot}"></i>${meta.label} · ${item.owner}
            </span>
          </label>`;
        }))}
      </div>

      <div class="panel big-stat">
        <span class="eyebrow">NEXT EVENT</span>
        <h3>${event ? event.title : 'No event scheduled'}</h3>
        <strong>${days === null ? '—' : days}</strong>
        <span>days to kickoff</span>
        <div class="mini-progress"><i style="width:${complete}%"></i></div>
        <small>${complete}% of the runbook complete · ${remaining.length} item${remaining.length === 1 ? '' : 's'} left</small>
        ${remaining.length ? html`<div class="remaining-list">
          ${join(remaining.map((item) => html`<div><strong>${item.label}</strong><small>${item.owner} · ${TIER_META[item.tier].label}</small></div>`))}
        </div>` : ''}
      </div>
    </div>`;
}
