/**
 * Lookup tables over the database.
 *
 * Built once at load and passed to every rule engine and view, so nothing has
 * to scan 1,000+ players to answer "who is on this roster".
 */

export function groupBy(list, keyFn) {
  const out = {};
  for (const item of list) {
    const key = keyFn(item);
    if (key === null || key === undefined) continue;
    (out[key] ||= []).push(item);
  }
  return out;
}

export function indexBy(list, keyFn = (item) => item.id) {
  return Object.fromEntries(list.map((item) => [keyFn(item), item]));
}

export function buildIndexes(db) {
  const fixturesByTeam = {};
  for (const fixture of db.fixtures) {
    (fixturesByTeam[fixture.homeTeamId] ||= []).push(fixture);
    (fixturesByTeam[fixture.awayTeamId] ||= []).push(fixture);
  }
  for (const list of Object.values(fixturesByTeam)) {
    list.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  return {
    seasonById: indexBy(db.seasons),
    conferenceById: indexBy(db.conferences),
    venueById: indexBy(db.venues),
    teamById: indexBy(db.teams),
    playerById: indexBy(db.players),
    agentById: indexBy(db.agents),
    teamsByConference: groupBy(db.teams, (t) => t.conferenceId),
    playersByTeam: groupBy(db.players, (p) => p.teamId),
    documentsByOwner: groupBy(db.documents, (d) => `${d.ownerType}:${d.ownerId}`),
    fixturesBySeason: groupBy(db.fixtures, (f) => f.seasonId),
    fixturesByTeam,
    agentByWorkstream: indexBy(db.agents, (a) => a.workstreamId),
  };
}
