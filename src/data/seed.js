/**
 * Seed dataset.
 *
 * The database is rebuilt deterministically on every load; only the operator's
 * decisions are persisted on top of it (see `store.js`). That keeps the demo
 * honest — nothing on screen is a hand-written number, every figure is derived
 * from these records by the rule engines.
 *
 * The anomalies the original prototype described in prose (Life University's
 * conflicting registration, the Queens transfer question, six teams missing
 * insurance certificates, the Oct 10 Army/Queens clash) are injected here as
 * real records so the eligibility and conflict engines actually find them.
 */

import { makeRng, seedFrom, randInt, pick, clamp } from '../util/rng.js';
import { addDays, toISODate, toISODateTime } from '../util/date.js';
import {
  makeTeam, makePlayer, makeFixture, makeDocument,
  DOC_KIND, DOC_STATUS, FIXTURE_STATUS,
} from './schema.js';

// --- Reference tables ------------------------------------------------------

const CONFERENCES = [
  { id: 'd1a-east', name: 'D1A East', division: 'D1A' },
  { id: 'd1a-west', name: 'D1A West', division: 'D1A' },
  { id: 'd1aa-east', name: 'D1AA East', division: 'D1AA' },
  { id: 'd1aa-west', name: 'D1AA West', division: 'D1AA' },
  { id: 'sc-north', name: 'Small College North', division: 'Small College' },
  { id: 'sc-south', name: 'Small College South', division: 'Small College' },
];

// [id, name, city, state, strength] — strength drives generated results only.
const TEAM_TABLE = {
  'd1a-east': [
    ['life', 'Life University', 'Marietta', 'GA', 95],
    ['army', 'Army West Point', 'West Point', 'NY', 88],
    ['queens', 'Queens University', 'Charlotte', 'NC', 82],
    ['navy', 'Navy', 'Annapolis', 'MD', 79],
    ['notre-dame-college', 'Notre Dame College', 'South Euclid', 'OH', 74],
    ['mount-st-marys', "Mount St. Mary's", 'Emmitsburg', 'MD', 66],
  ],
  'd1a-west': [
    ['california', 'California', 'Berkeley', 'CA', 94],
    ['saint-marys', "Saint Mary's College", 'Moraga', 'CA', 86],
    ['lindenwood', 'Lindenwood', 'St. Charles', 'MO', 83],
    ['arkansas-state', 'Arkansas State', 'Jonesboro', 'AR', 78],
    ['central-washington', 'Central Washington', 'Ellensburg', 'WA', 72],
    ['air-force', 'Air Force', 'Colorado Springs', 'CO', 70],
  ],
  'd1aa-east': [
    ['kutztown', 'Kutztown', 'Kutztown', 'PA', 76],
    ['clemson', 'Clemson', 'Clemson', 'SC', 73],
    ['bowling-green', 'Bowling Green', 'Bowling Green', 'OH', 71],
    ['norwich', 'Norwich', 'Northfield', 'VT', 69],
    ['wheeling', 'Wheeling', 'Wheeling', 'WV', 67],
    ['tennessee', 'Tennessee', 'Knoxville', 'TN', 65],
  ],
  'd1aa-west': [
    ['iowa-state', 'Iowa State', 'Ames', 'IA', 74],
    ['michigan-state', 'Michigan State', 'East Lansing', 'MI', 72],
    ['colorado-state', 'Colorado State', 'Fort Collins', 'CO', 70],
    ['grand-canyon', 'Grand Canyon', 'Phoenix', 'AZ', 68],
    ['wayne-state', 'Wayne State', 'Detroit', 'MI', 64],
    ['northern-iowa', 'Northern Iowa', 'Cedar Falls', 'IA', 62],
  ],
  'sc-north': [
    ['davenport', 'Davenport', 'Grand Rapids', 'MI', 63],
    ['marquette', 'Marquette', 'Milwaukee', 'WI', 60],
    ['dayton', 'Dayton', 'Dayton', 'OH', 59],
    ['st-bonaventure', 'St. Bonaventure', 'St. Bonaventure', 'NY', 58],
    ['minnesota-state', 'Minnesota State', 'Mankato', 'MN', 57],
    ['castleton', 'Castleton', 'Castleton', 'VT', 56],
    ['salve-regina', 'Salve Regina', 'Newport', 'RI', 55],
    ['siena', 'Siena', 'Loudonville', 'NY', 54],
    ['fredonia', 'Fredonia', 'Fredonia', 'NY', 52],
  ],
  'sc-south': [
    ['berry', 'Berry College', 'Mount Berry', 'GA', 61],
    ['mary-washington', 'Mary Washington', 'Fredericksburg', 'VA', 58],
    ['christopher-newport', 'Christopher Newport', 'Newport News', 'VA', 56],
    ['emory', 'Emory', 'Atlanta', 'GA', 55],
    ['sewanee', 'Sewanee', 'Sewanee', 'TN', 54],
    ['rhodes', 'Rhodes College', 'Memphis', 'TN', 53],
    ['furman', 'Furman', 'Greenville', 'SC', 52],
    ['catawba', 'Catawba', 'Salisbury', 'NC', 51],
    ['wofford', 'Wofford', 'Spartanburg', 'SC', 50],
  ],
};

const FIRST_NAMES = [
  'Marcus', 'Elliot', 'Tobias', 'Declan', 'Rhys', 'Callum', 'Jonah', 'Nathaniel', 'Grady', 'Isaiah',
  'Beau', 'Sione', 'Malakai', 'Everett', 'Finlay', 'Kwame', 'Dominic', 'Arlo', 'Tane', 'Ezra',
  'Sebastian', 'Hugo', 'Reuben', 'Kofi', 'Lachlan', 'Mateo', 'Oskar', 'Tavita', 'Emeka', 'Jasper',
  'Cormac', 'Andre', 'Kai', 'Silas', 'Bodhi', 'Ronan', 'Tomas', 'Levi', 'Nico', 'Osian',
];

const LAST_NAMES = [
  'Whitfield', 'Okonkwo', 'Marchetti', 'Tuilagi', 'Brennan', 'Alvarado', 'Kealoha', 'Fitzgerald', 'Nakamura', 'Duplessis',
  'Adeyemi', 'Vaughan', 'Sorensen', 'Castellanos', 'Mbeki', 'Harrington', 'Lomu', 'Petrov', 'Gallagher', 'Osei',
  'Rasmussen', 'Delacroix', 'Ngata', 'Beauchamp', 'Ferreira', 'Kowalski', 'Havili', 'Ashworth', 'Diallo', 'Moreau',
  'Sinclair', 'Barlowe', 'Ikeda', 'Mendoza', 'Faletau', 'Cavanaugh', 'Njoku', 'Radcliffe', 'Solano', 'Ainsworth',
];

const POSITIONS = [
  'Loosehead prop', 'Hooker', 'Tighthead prop', 'Lock', 'Lock', 'Blindside flanker',
  'Openside flanker', 'No. 8', 'Scrum-half', 'Fly-half', 'Left wing', 'Inside centre',
  'Outside centre', 'Right wing', 'Fullback',
];

const VENUE_SUFFIXES = ['Rugby Complex', 'Athletic Field', 'Memorial Pitch', 'Sports Park', 'Union Grounds'];

// --- Deliberate anomalies --------------------------------------------------
// Named explicitly so the narrative stays stable and so a reader can see
// exactly what the rule engines are expected to catch.

const TEAMS_MISSING_INSURANCE = ['clemson', 'norwich', 'wheeling', 'grand-canyon', 'wayne-state', 'furman'];
const TEAMS_EXPIRED_SAFEGUARDING = ['siena', 'wofford'];
const TEAMS_SHORT_ROSTER = ['fredonia', 'catawba'];
const TEAMS_MISSING_MEDICAL = ['navy', 'lindenwood', 'dayton'];
const TEAMS_LATE_REGISTRATION = ['army', 'kutztown', 'davenport', 'berry', 'michigan-state'];

const DUPLICATE_REGISTRATION_ID = 1842; // Life University — also registered at Mount St. Mary's
const TRANSFER_REGISTRATION_ID = 7611; // Queens University — transfer filed outside the window
const UNDERAGE_TEAM_ID = 'castleton';

const ROSTER_SIZE = 26;
const ROSTER_MINIMUM = 22;

// --- Seasons ---------------------------------------------------------------

const SEASONS = [
  {
    id: '2025-26',
    name: '2025–26',
    status: 'completed',
    startDate: '2025-09-06',
    endDate: '2026-04-25',
    doubleRoundRobin: true,
  },
  {
    id: 'fall-2026',
    name: 'Fall 2026',
    status: 'registration',
    startDate: '2026-09-05',
    endDate: '2026-11-21',
    doubleRoundRobin: false,
    registrationOpens: '2026-06-15',
    rosterDeadline: '2026-07-15',
    registrationCloses: '2026-08-14',
    transferWindowOpens: '2026-06-01',
    transferWindowCloses: '2026-07-15',
    minimumAge: 17,
    rosterMinimum: ROSTER_MINIMUM,
  },
];

export const ACTIVE_SEASON_ID = 'fall-2026';
export const COMPLETED_SEASON_ID = '2025-26';

// --- Helpers ---------------------------------------------------------------

/** Circle-method round robin. Returns an array of rounds, each an array of [homeId, awayId]. */
function roundRobin(teamIds) {
  const list = teamIds.slice();
  if (list.length % 2) list.push(null); // odd team count gets a rotating bye
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()); // rotate everything except the first slot
  }
  return rounds;
}

function generateResult(rng, home, away) {
  const edge = (home.strength - away.strength) / 7 + 2.5; // includes home advantage
  const homeTries = clamp(Math.round(3 + edge / 3 + (rng() * 3 - 1.5)), 0, 11);
  const awayTries = clamp(Math.round(3 - edge / 3 + (rng() * 3 - 1.5)), 0, 11);
  return {
    homeTries,
    awayTries,
    homeScore: homeTries * 5 + randInt(rng, 0, homeTries) * 2 + randInt(rng, 0, 3) * 3,
    awayScore: awayTries * 5 + randInt(rng, 0, awayTries) * 2 + randInt(rng, 0, 3) * 3,
  };
}

/** Saturdays only — college fixtures land on the weekend. */
function matchdayFor(seasonStart, round) {
  return addDays(seasonStart, round * 7);
}

// --- Builders --------------------------------------------------------------

function buildTeamsAndVenues() {
  const teams = [];
  const venues = [];
  for (const conference of CONFERENCES) {
    for (const [id, name, city, state, strength] of TEAM_TABLE[conference.id]) {
      const rng = makeRng(seedFrom(`venue:${id}`));
      const venueId = `venue-${id}`;
      venues.push({
        id: venueId,
        name: `${name.replace(/ (University|College)$/, '')} ${pick(rng, VENUE_SUFFIXES)}`,
        city,
        state,
        capacity: randInt(rng, 800, 6500),
      });
      teams.push(makeTeam({
        id,
        name,
        shortName: name.replace(/ (University|College)$/, ''),
        conferenceId: conference.id,
        venueId,
        city,
        state,
        strength,
        contactName: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
        contactEmail: `rugby@${id.replace(/-/g, '')}.edu`,
      }));
    }
  }
  return { teams, venues };
}

function buildPlayers(teams, season) {
  const players = [];
  let registrationCounter = 1000;

  for (const team of teams) {
    const rng = makeRng(seedFrom(`roster:${team.id}:${season.id}`));
    const size = TEAMS_SHORT_ROSTER.includes(team.id) ? 19 : ROSTER_SIZE;

    for (let i = 0; i < size; i++) {
      const registrationId = registrationCounter++;
      // Most rosters are filed well before the deadline; a few teams file late.
      const filesLate = TEAMS_LATE_REGISTRATION.includes(team.id) && i < 3;
      const registeredAt = filesLate
        ? toISODate(addDays(season.rosterDeadline, randInt(rng, 3, 12)))
        : toISODate(addDays(season.registrationOpens, randInt(rng, 0, 26)));

      const birthYear = randInt(rng, 2003, 2007);
      players.push(makePlayer({
        id: `${team.id}-p${i + 1}`,
        registrationId,
        teamId: team.id,
        seasonId: season.id,
        firstName: pick(rng, FIRST_NAMES),
        lastName: pick(rng, LAST_NAMES),
        dob: `${birthYear}-${String(randInt(rng, 1, 12)).padStart(2, '0')}-${String(randInt(rng, 1, 28)).padStart(2, '0')}`,
        position: POSITIONS[i % POSITIONS.length],
        registeredAt,
      }));
    }
  }

  applyPlayerAnomalies(players, season);
  return players;
}

function applyPlayerAnomalies(players, season) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));

  // 1. The same person registered to two teams. Same name and date of birth is
  //    what makes it detectable — the registration ids differ, which is exactly
  //    why a naive id-based check would miss it.
  const lifePlayer = byId['life-p7'];
  const duplicatePlayer = byId['mount-st-marys-p11'];
  lifePlayer.registrationId = DUPLICATE_REGISTRATION_ID;
  lifePlayer.firstName = 'Marcus';
  lifePlayer.lastName = 'Whitfield';
  lifePlayer.dob = '2004-03-19';
  lifePlayer.registeredAt = '2026-06-21';
  duplicatePlayer.firstName = 'Marcus';
  duplicatePlayer.lastName = 'Whitfield';
  duplicatePlayer.dob = '2004-03-19';
  duplicatePlayer.registeredAt = '2026-07-09';

  // 2. A transfer filed after the window closed — the rules cannot resolve this
  //    without a policy judgment, so it must reach a human.
  const transferPlayer = byId['queens-p4'];
  transferPlayer.registrationId = TRANSFER_REGISTRATION_ID;
  transferPlayer.firstName = 'Tobias';
  transferPlayer.lastName = 'Ngata';
  transferPlayer.transferFromTeamId = 'notre-dame-college';
  transferPlayer.transferRequestedAt = toISODate(addDays(season.transferWindowCloses, 7));
  transferPlayer.registeredAt = toISODate(addDays(season.transferWindowCloses, 9));

  // 3. A player under the minimum age at season start — safeguarding, human only.
  const minor = byId[`${UNDERAGE_TEAM_ID}-p14`];
  minor.dob = '2010-03-14';
}

function buildDocuments(teams, players, season) {
  const documents = [];
  const submitted = toISODate(addDays(season.registrationOpens, 5));

  for (const team of teams) {
    const rng = makeRng(seedFrom(`docs:${team.id}`));

    if (TEAMS_MISSING_INSURANCE.includes(team.id)) {
      documents.push(makeDocument({
        id: `doc-${team.id}-insurance`,
        kind: DOC_KIND.INSURANCE,
        ownerType: 'team',
        ownerId: team.id,
        seasonId: season.id,
        status: DOC_STATUS.MISSING,
      }));
    } else {
      documents.push(makeDocument({
        id: `doc-${team.id}-insurance`,
        kind: DOC_KIND.INSURANCE,
        ownerType: 'team',
        ownerId: team.id,
        seasonId: season.id,
        status: DOC_STATUS.VALID,
        submittedAt: toISODate(addDays(submitted, randInt(rng, 0, 20))),
        expiresAt: '2027-06-30',
      }));
    }

    const safeguardingExpired = TEAMS_EXPIRED_SAFEGUARDING.includes(team.id);
    documents.push(makeDocument({
      id: `doc-${team.id}-safeguarding`,
      kind: DOC_KIND.SAFEGUARDING,
      ownerType: 'team',
      ownerId: team.id,
      seasonId: season.id,
      status: safeguardingExpired ? DOC_STATUS.EXPIRED : DOC_STATUS.VALID,
      submittedAt: toISODate(addDays(submitted, randInt(rng, 0, 20))),
      // An expiry inside the season is what the engine flags, not the status field alone.
      expiresAt: safeguardingExpired ? '2026-09-30' : '2027-06-30',
    }));
  }

  for (const player of players) {
    const rng = makeRng(seedFrom(`pdocs:${player.id}`));
    const skipMedical = TEAMS_MISSING_MEDICAL.includes(player.teamId) && player.id.endsWith('-p3');

    documents.push(makeDocument({
      id: `doc-${player.id}-waiver`,
      kind: DOC_KIND.WAIVER,
      ownerType: 'player',
      ownerId: player.id,
      seasonId: season.id,
      status: DOC_STATUS.VALID,
      submittedAt: player.registeredAt,
    }));

    documents.push(makeDocument({
      id: `doc-${player.id}-medical`,
      kind: DOC_KIND.MEDICAL,
      ownerType: 'player',
      ownerId: player.id,
      seasonId: season.id,
      status: skipMedical ? DOC_STATUS.MISSING : DOC_STATUS.VALID,
      submittedAt: skipMedical ? null : toISODate(addDays(player.registeredAt, randInt(rng, 0, 9))),
      expiresAt: skipMedical ? null : '2027-05-31',
    }));

    if (player.transferFromTeamId) {
      documents.push(makeDocument({
        id: `doc-${player.id}-transfer`,
        kind: DOC_KIND.TRANSFER,
        ownerType: 'player',
        ownerId: player.id,
        seasonId: season.id,
        status: DOC_STATUS.PENDING,
        submittedAt: player.transferRequestedAt,
      }));
    }
  }

  return documents;
}

function buildFixtures(teams, season) {
  const fixtures = [];
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const played = season.status === 'completed';

  for (const conference of CONFERENCES) {
    const ids = TEAM_TABLE[conference.id].map(([id]) => id);
    let rounds = roundRobin(ids);
    if (season.doubleRoundRobin) {
      rounds = rounds.concat(rounds.map((pairs) => pairs.map(([h, a]) => [a, h])));
    }

    rounds.forEach((pairs, roundIndex) => {
      const matchday = matchdayFor(season.startDate, roundIndex);
      pairs.forEach(([homeId, awayId], slot) => {
        const home = teamById[homeId];
        const away = teamById[awayId];
        const rng = makeRng(seedFrom(`fixture:${season.id}:${homeId}:${awayId}:${roundIndex}`));
        // Stagger kickoffs across the afternoon so venue clashes are meaningful.
        const kickoffHour = 12 + (slot % 4);
        fixtures.push(makeFixture({
          id: `fx-${season.id}-${conference.id}-r${roundIndex + 1}-${homeId}-${awayId}`,
          seasonId: season.id,
          conferenceId: conference.id,
          round: roundIndex + 1,
          kickoff: toISODateTime(new Date(matchday.getFullYear(), matchday.getMonth(), matchday.getDate(), kickoffHour, 0)),
          homeTeamId: homeId,
          awayTeamId: awayId,
          venueId: home.venueId,
          status: played ? FIXTURE_STATUS.PLAYED : FIXTURE_STATUS.SCHEDULED,
          result: played ? generateResult(rng, home, away) : null,
        }));
      });
    });
  }

  if (season.id === ACTIVE_SEASON_ID) applyScheduleAnomalies(fixtures, teamById, season);
  return fixtures;
}

/**
 * Inject the scheduling problems the conflict engine is meant to surface.
 *
 * These are added as ordinary fixtures on real generated matchdays — the engine
 * has no knowledge of them and rediscovers each one from the schedule alone.
 * Opponents are chosen from teams that are idle that day so each injection
 * produces exactly the one conflict it is meant to demonstrate.
 */
function applyScheduleAnomalies(fixtures, teamById, season) {
  const dayOf = (fixture) => fixture.kickoff.slice(0, 10);
  const inSeason = () => fixtures.filter((f) => f.seasonId === season.id);
  const allTeamIds = Object.keys(teamById);

  const teamsBusyOn = (day) => new Set(
    inSeason().filter((f) => dayOf(f) === day).flatMap((f) => [f.homeTeamId, f.awayTeamId]),
  );
  const idleOn = (day, exclude = []) => {
    const busy = teamsBusyOn(day);
    return allTeamIds.filter((id) => !busy.has(id) && !exclude.includes(id));
  };

  // 1. Team double-booking. Army is picked on a matchday where it travels, so
  //    adding a home fixture clashes the team without also clashing the venue.
  const armyAway = inSeason().find((f) => f.awayTeamId === 'army');
  if (armyAway) {
    const day = dayOf(armyAway);
    const opponent = idleOn(day)[0];
    if (opponent) {
      fixtures.push(makeFixture({
        id: `fx-${season.id}-nonconf-army`,
        seasonId: season.id,
        conferenceId: 'd1a-east',
        round: armyAway.round,
        kickoff: `${day}T16:00`,
        homeTeamId: 'army',
        awayTeamId: opponent,
        venueId: teamById.army.venueId,
        status: FIXTURE_STATUS.SCHEDULED,
      }));
    }
  }

  // 2. Venue double-booking: a neutral-site fixture booked into Life
  //    University's ground on a day it is already hosting.
  const lifeHome = inSeason().find((f) => f.homeTeamId === 'life');
  if (lifeHome) {
    const day = dayOf(lifeHome);
    const [teamA, teamB] = idleOn(day);
    if (teamA && teamB) {
      fixtures.push(makeFixture({
        id: `fx-${season.id}-neutral-life-venue`,
        seasonId: season.id,
        conferenceId: teamById[teamA].conferenceId,
        round: lifeHome.round,
        kickoff: `${day}T${String(Number(lifeHome.kickoff.slice(11, 13)) + 1).padStart(2, '0')}:30`,
        homeTeamId: teamA,
        awayTeamId: teamB,
        venueId: teamById.life.venueId,
        status: FIXTURE_STATUS.SCHEDULED,
      }));
    }
  }

  // 3. Short turnaround: a midweek fixture three days after a league game.
  //    Wednesdays are otherwise empty, so nobody is double-booked by it.
  const cwuFixture = inSeason().find(
    (f) => f.homeTeamId === 'central-washington' || f.awayTeamId === 'central-washington',
  );
  if (cwuFixture) {
    const midweek = toISODate(addDays(cwuFixture.kickoff, 3));
    const opponent = idleOn(midweek, ['central-washington'])[0];
    if (opponent) {
      fixtures.push(makeFixture({
        id: `fx-${season.id}-midweek-cwu`,
        seasonId: season.id,
        conferenceId: 'd1a-west',
        round: cwuFixture.round,
        kickoff: `${midweek}T19:00`,
        homeTeamId: 'central-washington',
        awayTeamId: opponent,
        venueId: teamById['central-washington'].venueId,
        status: FIXTURE_STATUS.SCHEDULED,
      }));
    }
  }
}

function buildAgents() {
  // One specialist per workstream. `gate` lives on the workstream itself.
  return [
    { id: 'atlas', name: 'Atlas', workstreamId: 'competition', currentRun: 'Roster reconciliation' },
    { id: 'vector', name: 'Vector', workstreamId: 'player-systems', currentRun: 'Talent ID scouting brief' },
    { id: 'mentor', name: 'Mentor', workstreamId: 'training', currentRun: 'Educator coverage gap analysis' },
    { id: 'herald', name: 'Herald', workstreamId: 'comms', currentRun: 'Fall bulletin draft' },
    { id: 'ledger', name: 'Ledger', workstreamId: 'finance', currentRun: 'Camp expense audit' },
    { id: 'vitals', name: 'Vitals', workstreamId: 'performance', currentRun: 'Camp readiness checklist' },
    { id: 'pathway', name: 'Pathway', workstreamId: 'youth', currentRun: 'Regional event plan' },
    { id: 'marshal', name: 'Marshal', workstreamId: 'championships', currentRun: '2026 championship runbook' },
  ];
}

function buildMilestones(season) {
  return [
    {
      id: 'ms-roster-deadline',
      title: 'Preliminary roster deadline',
      date: season.rosterDeadline,
      description: 'Late additions require an approved exception',
      workstreamId: 'competition',
    },
    {
      id: 'ms-registration-close',
      title: 'Fall registration closes',
      date: season.registrationCloses,
      description: 'All team and player documentation must be valid',
      workstreamId: 'competition',
    },
    {
      id: 'ms-committee',
      title: 'Competition committee review',
      date: '2026-08-22',
      description: 'Calendar, eligibility, and ranking proposals',
      workstreamId: 'competition',
    },
    {
      id: 'ms-kickoff',
      title: 'Fall 2026 season kickoff',
      date: season.startDate,
      description: 'National bulletin and match operations live',
      workstreamId: 'comms',
    },
    {
      id: 'ms-regular-season-end',
      title: 'Regular season concludes',
      date: season.endDate,
      description: 'Final standings lock for championship seeding',
      workstreamId: 'competition',
    },
    {
      id: 'ms-championship',
      title: '2026 D1A Championship',
      date: '2026-12-05',
      description: 'Venue, officials, broadcast, and matchday operations',
      workstreamId: 'championships',
    },
  ];
}

function buildRunbook() {
  return [
    { id: 'rb-venue', label: 'Venue contract and insurance', done: true, owner: 'Marshal', tier: 'approval' },
    { id: 'rb-officials', label: 'Officials assignment matrix', done: true, owner: 'Marshal', tier: 'autonomous' },
    { id: 'rb-broadcast', label: 'Broadcast / streaming brief', done: true, owner: 'Herald', tier: 'approval' },
    { id: 'rb-medical', label: 'Medical and emergency action plan', done: true, owner: 'Vitals', tier: 'human_only' },
    { id: 'rb-travel', label: 'Team travel confirmation', done: false, owner: 'Marshal', tier: 'approval' },
    { id: 'rb-incident', label: 'Match-day incident protocol', done: false, owner: 'Vitals', tier: 'human_only' },
    { id: 'rb-volunteers', label: 'Volunteer and marshal rota', done: false, owner: 'Pathway', tier: 'autonomous' },
  ];
}

function buildCommunications(season) {
  return [
    {
      id: 'comm-fall-bulletin',
      title: 'Three things changing for Fall 2026',
      workstreamId: 'comms',
      status: 'draft',
      audiences: ['team-contacts', 'conference-leads', 'officials'],
      createdAt: toISODateTime(addDays(new Date(), 0)),
      // The body is regenerated from live state when the operator drafts an
      // update; this is the version Herald prepared earlier.
      body: [
        `We have finalized the ${season.name} competition calendar, clarified the eligibility review process, and added a deadline reminder workflow.`,
        'Registration closes on August 14. Teams with outstanding documentation will receive a direct follow-up with the specific item required.',
        'Schedule conflicts identified during the calendar scan have been resolved or flagged for committee review. No fixture has been moved without notifying both programs.',
      ].join('\n\n'),
      generated: false,
    },
  ];
}

/** Audience definitions — recipient counts are derived from the database. */
export const AUDIENCES = [
  { id: 'team-contacts', label: 'Team contacts' },
  { id: 'conference-leads', label: 'Conference leads' },
  { id: 'officials', label: 'Officials' },
];

// --- Entry point -----------------------------------------------------------

export function buildDatabase() {
  const seasons = SEASONS;
  const activeSeason = seasons.find((s) => s.id === ACTIVE_SEASON_ID);
  const { teams, venues } = buildTeamsAndVenues();
  const players = buildPlayers(teams, activeSeason);
  const documents = buildDocuments(teams, players, activeSeason);

  const fixtures = [];
  for (const season of seasons) fixtures.push(...buildFixtures(teams, season));

  // Officials are only needed as a recipient count for communications coverage.
  const officials = Array.from({ length: 35 }, (_, i) => {
    const rng = makeRng(seedFrom(`official:${i}`));
    return {
      id: `official-${i + 1}`,
      name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
      email: i % 9 === 0 ? '' : `official${i + 1}@example.org`, // 4 without a working address
      grade: pick(rng, ['A', 'B', 'C']),
    };
  });

  return {
    organization: {
      id: 'usa-rugby-college',
      name: 'USA Rugby / College',
      sport: 'Rugby union',
      operator: { name: 'Jimmy', initial: 'J' },
    },
    activeSeasonId: ACTIVE_SEASON_ID,
    completedSeasonId: COMPLETED_SEASON_ID,
    seasons,
    conferences: CONFERENCES,
    venues,
    teams,
    players,
    documents,
    fixtures,
    officials,
    agents: buildAgents(),
    milestones: buildMilestones(activeSeason),
    runbook: buildRunbook(),
    communications: buildCommunications(activeSeason),
    audiences: AUDIENCES,
  };
}
