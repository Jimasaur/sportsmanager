/**
 * Standings and rankings.
 *
 * Computed from fixture results every time they are displayed. Nothing is
 * stored, so a table can never drift from the results behind it, and the
 * "recalculate" action is genuinely just a recomputation.
 *
 * League points follow the World Rugby convention encoded in `SCORING`:
 * 4 for a win, 2 for a draw, a bonus point for scoring four or more tries, and
 * a bonus point for losing by seven or fewer.
 */

import { SCORING, FIXTURE_STATUS } from '../data/schema.js';

function emptyRow(team) {
  return {
    teamId: team.id,
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    tries: 0,
    tryBonus: 0,
    losingBonus: 0,
    points: 0,
  };
}

function applyResult(row, scored, conceded, triesScored) {
  row.played += 1;
  row.pointsFor += scored;
  row.pointsAgainst += conceded;
  row.tries += triesScored;

  if (scored > conceded) {
    row.won += 1;
    row.points += SCORING.win;
  } else if (scored === conceded) {
    row.drawn += 1;
    row.points += SCORING.draw;
  } else {
    row.lost += 1;
    row.points += SCORING.loss;
    if (conceded - scored <= SCORING.losingBonusMargin) {
      row.losingBonus += 1;
      row.points += SCORING.losingBonus;
    }
  }

  if (triesScored >= SCORING.tryBonusThreshold) {
    row.tryBonus += 1;
    row.points += SCORING.tryBonus;
  }
}

function sortRows(rows) {
  return rows.sort((a, b) => (
    b.points - a.points
    || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)
    || b.pointsFor - a.pointsFor
    || b.won - a.won
    || a.team.name.localeCompare(b.team.name)
  ));
}

/** Highest round with a played fixture, or 0 if the season has not started. */
export function latestPlayedRound(db, seasonId, conferenceId = null) {
  let latest = 0;
  for (const fixture of db.fixtures) {
    if (fixture.seasonId !== seasonId) continue;
    if (conferenceId && fixture.conferenceId !== conferenceId) continue;
    if (fixture.status !== FIXTURE_STATUS.PLAYED) continue;
    if (fixture.round > latest) latest = fixture.round;
  }
  return latest;
}

/**
 * @returns rows ordered by rank, each with `rank`, `diff` and (when a previous
 *   round exists) `trend` — the number of places gained since last round.
 */
export function computeStandings(db, ix, { seasonId, conferenceId, throughRound = Infinity }) {
  const teams = ix.teamsByConference[conferenceId] || [];
  const rows = {};
  for (const team of teams) rows[team.id] = emptyRow(team);

  for (const fixture of db.fixtures) {
    if (fixture.seasonId !== seasonId) continue;
    if (fixture.conferenceId !== conferenceId) continue;
    if (fixture.status !== FIXTURE_STATUS.PLAYED || !fixture.result) continue;
    if (fixture.round > throughRound) continue;
    // A neutral or cross-conference fixture can name a team that is not in this
    // table; skip it rather than inventing a row.
    const home = rows[fixture.homeTeamId];
    const away = rows[fixture.awayTeamId];
    if (!home || !away) continue;

    const { homeScore, awayScore, homeTries, awayTries } = fixture.result;
    applyResult(home, homeScore, awayScore, homeTries);
    applyResult(away, awayScore, homeScore, awayTries);
  }

  const ordered = sortRows(Object.values(rows));
  ordered.forEach((row, i) => {
    row.rank = i + 1;
    row.diff = row.pointsFor - row.pointsAgainst;
  });
  return ordered;
}

/** Standings for the latest round, annotated with movement against the round before. */
export function computeStandingsWithTrend(db, ix, { seasonId, conferenceId }) {
  const latest = latestPlayedRound(db, seasonId, conferenceId);
  const current = computeStandings(db, ix, { seasonId, conferenceId, throughRound: latest });

  if (latest <= 1) {
    current.forEach((row) => { row.trend = null; });
    return { rows: current, round: latest };
  }

  const previous = computeStandings(db, ix, { seasonId, conferenceId, throughRound: latest - 1 });
  const priorRank = Object.fromEntries(previous.map((row) => [row.teamId, row.rank]));
  current.forEach((row) => {
    // Positive means the team climbed.
    row.trend = priorRank[row.teamId] === undefined ? null : priorRank[row.teamId] - row.rank;
  });
  return { rows: current, round: latest };
}

/**
 * A cross-conference ranking. Conferences differ in strength, so this is an
 * explicitly rough national picture ordered by league points per game — it is
 * labelled as such wherever it is shown.
 */
export function computeNationalRanking(db, ix, { seasonId, limit = 10 }) {
  const all = [];
  for (const conference of db.conferences) {
    const rows = computeStandings(db, ix, { seasonId, conferenceId: conference.id });
    for (const row of rows) {
      if (!row.played) continue;
      all.push({ ...row, conference, pointsPerGame: row.points / row.played });
    }
  }
  all.sort((a, b) => (
    b.pointsPerGame - a.pointsPerGame
    || (b.diff / b.played) - (a.diff / a.played)
    || a.team.name.localeCompare(b.team.name)
  ));
  return all.slice(0, limit).map((row, i) => ({ ...row, nationalRank: i + 1 }));
}
