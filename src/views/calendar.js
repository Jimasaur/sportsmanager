/**
 * Competition calendar — one canonical schedule, rendered from the fixture
 * records, with the conflict engine's findings alongside it.
 */

import { html, join } from '../util/dom.js';
import { selectSeason } from '../store.js';
import { FIXTURE_STATUS, SEVERITY, TIER } from '../data/schema.js';
import {
  parseDate, startOfMonth, startOfWeek, addDays, addMonths, toISODate,
  fmtMonthYear, fmtShort, fmtTime, isSameDay, daysUntil,
} from '../util/date.js';
import { pageIntro, filterBar, emptyState } from './shared.js';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MAX_EVENTS_PER_DAY = 3;

const CONFLICT_TONE = { critical: 'red-event', warning: 'orange-event', info: 'blue-event' };

/** Default to the current month, or the season opener if the season is ahead. */
export function defaultMonthKey(season) {
  const now = new Date();
  const start = parseDate(season.startDate);
  const anchor = now < start && daysUntil(season.startDate) > 45 ? start : now;
  return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyToDate(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

export function renderCalendar(state) {
  const { db, ix, derived } = state;
  const season = selectSeason();
  const conferenceFilter = state.ui.filters.calendarConference;
  const monthKey = state.ui.filters.calendarMonth || defaultMonthKey(season);
  const monthStart = startOfMonth(monthKeyToDate(monthKey));

  const conflictFixtureIds = new Set(
    derived.conflicts.findings.flatMap((f) => f.fixtureIds || []),
  );

  const fixtures = (ix.fixturesBySeason[season.id] || []).filter(
    (f) => conferenceFilter === 'all' || f.conferenceId === conferenceFilter,
  );

  // Bucket by day once rather than filtering per cell.
  const byDay = {};
  for (const fixture of fixtures) {
    (byDay[fixture.kickoff.slice(0, 10)] ||= []).push(fixture);
  }
  for (const list of Object.values(byDay)) list.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const milestonesByDay = {};
  for (const milestone of db.milestones) (milestonesByDay[milestone.date] ||= []).push(milestone);

  const gridStart = startOfWeek(monthStart);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    if (i >= 35 && day.getMonth() !== monthStart.getMonth()) break; // trim a trailing empty week
    cells.push(day);
  }

  const conferenceOptions = [
    { value: 'all', label: 'All conferences' },
    ...db.conferences.map((c) => ({ value: c.id, label: c.name })),
  ];

  const conflicts = [...derived.conflicts.findings].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  return html`
    ${pageIntro({
      eyebrow: 'OPERATIONS TOOL',
      title: 'Competition calendar',
      subhead: `${fixtures.length} fixtures in ${season.name}. The conflict scan watches double-bookings, venue clashes, rest periods, and travel load.`,
      actions: '<button class="primary-btn" data-action="run-brief">Scan for conflicts <span>✦</span></button>',
    })}

    <div class="toolbar">
      ${filterBar('calendarConference', conferenceOptions, conferenceFilter)}
    </div>

    <div class="calendar-card">
      <div class="calendar-header">
        <span>${fmtMonthYear(monthStart)}</span>
        <div class="calendar-nav">
          <button class="icon-nav" data-action="calendar-shift" data-delta="-1" aria-label="Previous month">‹</button>
          <button class="text-btn" data-action="calendar-today">Today</button>
          <button class="icon-nav" data-action="calendar-shift" data-delta="1" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="calendar-grid">
        ${join(WEEKDAYS.map((day) => html`<div class="day-label">${day}</div>`))}
        ${join(cells.map((day) => {
          const key = toISODate(day);
          const outside = day.getMonth() !== monthStart.getMonth();
          const today = isSameDay(day, new Date());
          const dayFixtures = byDay[key] || [];
          const dayMilestones = milestonesByDay[key] || [];
          const shown = dayFixtures.slice(0, MAX_EVENTS_PER_DAY - dayMilestones.length);
          const hidden = dayFixtures.length - shown.length;

          return html`<div class="day ${outside ? 'muted-day' : ''} ${today ? 'today' : ''}">
            <b>${day.getDate()}</b>
            ${join(dayMilestones.map((m) => html`<span class="event purple-event">${m.title}</span>`))}
            ${join(shown.map((fixture) => {
              const home = ix.teamById[fixture.homeTeamId];
              const away = ix.teamById[fixture.awayTeamId];
              const clash = conflictFixtureIds.has(fixture.id);
              return html`<span class="event ${clash ? 'red-event' : 'green-event'}" title="${home.name} v ${away.name} · ${fmtTime(fixture.kickoff)}">
                ${clash ? '⚠ ' : ''}${home.shortName} v ${away.shortName}
              </span>`;
            }))}
            ${hidden > 0 ? html`<span class="event more-event">+${hidden} more</span>` : ''}
          </div>`;
        }))}
      </div>
    </div>

    <section class="panel conflict-panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">CONFLICT SCAN</span>
          <h3>${conflicts.length} issue${conflicts.length === 1 ? '' : 's'} in the ${season.name} schedule</h3>
        </div>
        <button class="text-btn" data-action="navigate" data-view="decisions">Open the queue →</button>
      </div>
      ${conflicts.length === 0
        ? emptyState('No conflicts found.', 'Every fixture has a clear venue, a clear date, and adequate rest either side.')
        : join(conflicts.map((conflict) => html`
          <div class="conflict-row">
            <span class="event ${CONFLICT_TONE[conflict.severity]} conflict-chip">
              ${conflict.severity === SEVERITY.CRITICAL ? '⚠' : '•'}
            </span>
            <div>
              <strong>${conflict.title}</strong>
              <p>${conflict.message}</p>
            </div>
            ${conflict.tier === TIER.AUTONOMOUS
              ? html`<span class="tag green">Handled</span>`
              : html`<button class="approve-btn" data-action="open-decision" data-id="d-${conflict.id}">Review</button>`}
          </div>`))}
    </section>

    <p class="computed-note">
      ${(ix.fixturesBySeason[season.id] || []).filter((f) => f.status === FIXTURE_STATUS.SCHEDULED).length}
      scheduled · ${(ix.fixturesBySeason[season.id] || []).filter((f) => f.status === FIXTURE_STATUS.PLAYED).length} played ·
      season runs ${fmtShort(season.startDate)} – ${fmtShort(season.endDate)}
    </p>`;
}
