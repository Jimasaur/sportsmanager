/**
 * Standings and rankings.
 *
 * Every column here is recomputed from fixture results on render. Nothing is
 * stored, so the table cannot disagree with the results that produced it.
 */

import { html, join } from '../util/dom.js';
import { computeStandingsWithTrend, computeNationalRanking, latestPlayedRound } from '../rules/standings.js';
import { SCORING } from '../data/schema.js';
import { pageIntro, filterBar, emptyState } from './shared.js';

function trendCell(trend) {
  if (trend === null || trend === undefined) return html`<span class="trend-flat">—</span>`;
  if (trend > 0) return html`<span class="trend-up">↑ ${trend}</span>`;
  if (trend < 0) return html`<span class="trend-down">↓ ${Math.abs(trend)}</span>`;
  return html`<span class="trend-flat">—</span>`;
}

export function renderStandings(state) {
  const { db, ix } = state;
  const seasonId = state.ui.filters.standingsSeason;
  const conferenceId = state.ui.filters.standingsConference;
  const season = ix.seasonById[seasonId];
  const conference = ix.conferenceById[conferenceId];

  const { rows, round } = computeStandingsWithTrend(db, ix, { seasonId, conferenceId });
  const played = rows.some((row) => row.played > 0);
  const national = played ? computeNationalRanking(db, ix, { seasonId, limit: 10 }) : [];

  const seasonOptions = db.seasons.map((s) => ({ value: s.id, label: s.name }));
  const conferenceOptions = db.conferences.map((c) => ({ value: c.id, label: c.name }));

  return html`
    ${pageIntro({
      eyebrow: 'DATA PRODUCT',
      title: 'Standings & rankings',
      subhead: 'Recomputed from results on every view. Bonus points follow the World Rugby convention: four for a win, one for four or more tries, one for losing by seven or fewer.',
      actions: '<button class="primary-btn" data-action="recalculate">Recalculate rankings <span>✦</span></button>',
    })}

    <div class="toolbar">${filterBar('standingsSeason', seasonOptions, seasonId)}</div>
    <div class="toolbar">${filterBar('standingsConference', conferenceOptions, conferenceId)}</div>

    <div class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">${conference.name.toUpperCase()} · ${played ? `ROUND ${round}` : 'NOT STARTED'}</span>
          <h3>${season.name} table</h3>
        </div>
        <button class="text-btn" data-action="export-standings">Download CSV ↗</button>
      </div>
      ${!played
        ? emptyState(
          `${season.name} has not started.`,
          `The first ${conference.name} fixture is scheduled for ${season.startDate}. Standings appear once results are recorded.`,
        )
        : html`<div class="rank-list">
            <div class="rank-row rank-header">
              <span>#</span><span>Team</span><span>P</span><span>W–D–L</span><span>PF</span><span>PA</span>
              <span>+/−</span><span>BP</span><span>Pts</span><span>Trend</span>
            </div>
            ${join(rows.map((row) => html`<div class="rank-row">
              <b>${row.rank}</b>
              <strong>${row.team.name}</strong>
              <span>${row.played}</span>
              <span>${row.won}–${row.drawn}–${row.lost}</span>
              <span>${row.pointsFor}</span>
              <span>${row.pointsAgainst}</span>
              <span class="${row.diff > 0 ? 'trend-up' : row.diff < 0 ? 'trend-down' : ''}">${row.diff > 0 ? '+' : ''}${row.diff}</span>
              <span>${row.tryBonus + row.losingBonus}</span>
              <strong>${row.points}</strong>
              ${trendCell(row.trend)}
            </div>`))}
          </div>`}
    </div>

    ${national.length ? html`<div class="panel">
      <div class="panel-head">
        <div>
          <span class="eyebrow">CROSS-CONFERENCE</span>
          <h3>National picture</h3>
        </div>
        <span class="tag orange">Indicative</span>
      </div>
      <p class="muted-copy">
        Ordered by league points per game across all conferences. Conferences differ in strength and do not
        play each other, so this is a rough picture and is labelled as one — it is not a qualification table.
      </p>
      <div class="rank-list national-list">
        <div class="rank-row rank-header">
          <span>#</span><span>Team</span><span>Conference</span><span>P</span><span>Pts/game</span><span>+/−</span>
        </div>
        ${join(national.map((row) => html`<div class="rank-row">
          <b>${row.nationalRank}</b>
          <strong>${row.team.name}</strong>
          <span>${row.conference.name}</span>
          <span>${row.played}</span>
          <span>${row.pointsPerGame.toFixed(2)}</span>
          <span class="${row.diff > 0 ? 'trend-up' : 'trend-down'}">${row.diff > 0 ? '+' : ''}${row.diff}</span>
        </div>`))}
      </div>
    </div>` : ''}

    <p class="computed-note">
      Win ${SCORING.win} · draw ${SCORING.draw} · try bonus at ${SCORING.tryBonusThreshold}+ tries ·
      losing bonus within ${SCORING.losingBonusMargin} points ·
      ${latestPlayedRound(db, seasonId, conferenceId)} rounds played
    </p>`;
}

/** CSV of the current table — the same numbers the view renders. */
export function standingsToCsv(state) {
  const { db, ix } = state;
  const seasonId = state.ui.filters.standingsSeason;
  const conferenceId = state.ui.filters.standingsConference;
  const { rows } = computeStandingsWithTrend(db, ix, { seasonId, conferenceId });

  const header = ['Rank', 'Team', 'Played', 'Won', 'Drawn', 'Lost', 'PointsFor', 'PointsAgainst', 'Difference', 'Tries', 'TryBonus', 'LosingBonus', 'LeaguePoints'];
  const lines = rows.map((row) => [
    row.rank, `"${row.team.name}"`, row.played, row.won, row.drawn, row.lost,
    row.pointsFor, row.pointsAgainst, row.diff, row.tries, row.tryBonus, row.losingBonus, row.points,
  ].join(','));
  return [header.join(','), ...lines].join('\n');
}
