/**
 * Schedule conflict detection.
 *
 * Emits findings in the same shape as the eligibility engine so both feed the
 * same decision queue. The engine knows nothing about how the schedule was
 * built — it rediscovers every clash from the fixture list alone.
 */

import { FINDING_CODE, SEVERITY, TIER, PRIORITY, FIXTURE_STATUS, DECISION_STATUS } from '../data/schema.js';
import { hoursBetween, fmtFull, fmtShort, fmtTime, parseDate } from '../util/date.js';

const DOUBLE_BOOKING_HOURS = 24; // two fixtures inside a day is a clash, not a turnaround
const VENUE_OVERLAP_HOURS = 4; // a fixture plus warm-up and clear-down
const MIN_REST_DAYS = 6;
const TRAVEL_RUN_LENGTH = 3; // consecutive away fixtures before it counts as a load

function label(fixture, ix) {
  const home = ix.teamById[fixture.homeTeamId];
  const away = ix.teamById[fixture.awayTeamId];
  return `${home.shortName} v ${away.shortName}`;
}

function whenLabel(fixture) {
  return `${fmtFull(fixture.kickoff)} · ${fmtTime(fixture.kickoff)}`;
}

export function detectScheduleConflicts(db, ix, seasonId = db.activeSeasonId) {
  const fixtures = (ix.fixturesBySeason[seasonId] || [])
    .filter((f) => f.status !== FIXTURE_STATUS.POSTPONED);
  const findings = [];

  // --- Team double-bookings and short turnarounds --------------------------
  for (const team of db.teams) {
    const own = fixtures
      .filter((f) => f.homeTeamId === team.id || f.awayTeamId === team.id)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    for (let i = 1; i < own.length; i++) {
      const previous = own[i - 1];
      const current = own[i];
      const gapHours = hoursBetween(previous.kickoff, current.kickoff);

      if (gapHours <= DOUBLE_BOOKING_HOURS) {
        findings.push({
          id: `f-clash-${team.id}-${current.id}`,
          code: FINDING_CODE.TEAM_DOUBLE_BOOKING,
          severity: SEVERITY.CRITICAL,
          tier: TIER.APPROVAL,
          priority: PRIORITY.HIGH,
          teamId: team.id,
          fixtureIds: [previous.id, current.id],
          title: 'Team double-booked',
          message: `${team.name} is scheduled twice on ${fmtShort(current.kickoff)} — ${label(previous, ix)} and ${label(current, ix)}.`,
          recommendation: 'Move the non-conference fixture',
          recommendationTag: 'orange',
          rationale: 'League fixtures take precedence over non-conference bookings, and only the second fixture has an alternative date.',
          confidence: 0.91,
          evidence: [
            { label: 'Fixture 1', value: `${label(previous, ix)} · ${whenLabel(previous)}`, source: 'Competition calendar' },
            { label: 'Fixture 2', value: `${label(current, ix)} · ${whenLabel(current)}`, source: 'Competition calendar' },
            { label: 'Gap', value: `${Math.round(gapHours)} hours`, source: 'Derived' },
            { label: 'Precedence', value: 'League fixtures outrank non-conference', source: 'Competition regulations §7.1' },
          ],
          options: [
            { label: 'Move the non-conference fixture', status: DECISION_STATUS.APPROVED },
            { label: 'Move the league fixture', status: DECISION_STATUS.APPROVED },
            { label: 'Escalate to the competition committee', status: DECISION_STATUS.ESCALATED },
          ],
        });
        continue; // already the worst case for this pair
      }

      const restDays = gapHours / 24;
      if (restDays < MIN_REST_DAYS) {
        findings.push({
          id: `f-turnaround-${team.id}-${current.id}`,
          code: FINDING_CODE.SHORT_TURNAROUND,
          severity: SEVERITY.WARNING,
          // Rest periods are a welfare standard, so a person signs the change off.
          tier: TIER.APPROVAL,
          priority: PRIORITY.MED,
          teamId: team.id,
          fixtureIds: [previous.id, current.id],
          title: 'Short turnaround',
          message: `${team.name} plays again after ${Math.round(restDays)} days (${label(previous, ix)} → ${label(current, ix)}).`,
          recommendation: 'Request rescheduling',
          recommendationTag: 'orange',
          rationale: `The competition standard is ${MIN_REST_DAYS} days between fixtures.`,
          confidence: 0.86,
          evidence: [
            { label: 'First fixture', value: `${label(previous, ix)} · ${whenLabel(previous)}`, source: 'Competition calendar' },
            { label: 'Second fixture', value: `${label(current, ix)} · ${whenLabel(current)}`, source: 'Competition calendar' },
            { label: 'Rest', value: `${Math.round(restDays)} days`, source: 'Derived' },
            { label: 'Standard', value: `${MIN_REST_DAYS} days minimum`, source: 'Player welfare policy §3' },
          ],
          options: [
            { label: 'Request rescheduling', status: DECISION_STATUS.INFO_REQUESTED },
            { label: 'Accept with a welfare note on file', status: DECISION_STATUS.APPROVED },
            { label: 'Escalate to the competition committee', status: DECISION_STATUS.ESCALATED },
          ],
        });
      }
    }

    // --- Consecutive away fixtures ----------------------------------------
    let run = [];
    for (const fixture of own) {
      if (fixture.awayTeamId === team.id) {
        run.push(fixture);
      } else {
        if (run.length >= TRAVEL_RUN_LENGTH) findings.push(travelLoadFinding(team, run, ix));
        run = [];
      }
    }
    if (run.length >= TRAVEL_RUN_LENGTH) findings.push(travelLoadFinding(team, run, ix));
  }

  // --- Venue double-bookings ----------------------------------------------
  const byVenueDay = {};
  for (const fixture of fixtures) {
    if (!fixture.venueId) continue;
    const key = `${fixture.venueId}|${fixture.kickoff.slice(0, 10)}`;
    (byVenueDay[key] ||= []).push(fixture);
  }

  for (const [key, sameDay] of Object.entries(byVenueDay)) {
    if (sameDay.length < 2) continue;
    sameDay.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    const venue = ix.venueById[key.split('|')[0]];

    for (let i = 1; i < sameDay.length; i++) {
      const previous = sameDay[i - 1];
      const current = sameDay[i];
      const gapHours = hoursBetween(previous.kickoff, current.kickoff);
      if (gapHours > VENUE_OVERLAP_HOURS) continue;

      findings.push({
        id: `f-venue-${current.id}`,
        code: FINDING_CODE.VENUE_DOUBLE_BOOKING,
        severity: SEVERITY.CRITICAL,
        tier: TIER.APPROVAL,
        priority: PRIORITY.HIGH,
        teamId: current.homeTeamId,
        fixtureIds: [previous.id, current.id],
        title: 'Venue double-booked',
        message: `${venue.name} has two fixtures ${Math.round(gapHours)} hours apart on ${fmtShort(current.kickoff)}.`,
        recommendation: 'Relocate the later fixture',
        recommendationTag: 'orange',
        rationale: 'Neither kickoff can absorb the other\'s warm-up and clear-down. The later fixture has no broadcast commitment.',
        confidence: 0.93,
        evidence: [
          { label: 'Venue', value: `${venue.name}, ${venue.city} ${venue.state}`, source: 'Venue register' },
          { label: 'Fixture 1', value: `${label(previous, ix)} · ${fmtTime(previous.kickoff)}`, source: 'Competition calendar' },
          { label: 'Fixture 2', value: `${label(current, ix)} · ${fmtTime(current.kickoff)}`, source: 'Competition calendar' },
          { label: 'Turnaround needed', value: `${VENUE_OVERLAP_HOURS} hours`, source: 'Venue operations standard' },
        ],
        options: [
          { label: 'Relocate the later fixture', status: DECISION_STATUS.APPROVED },
          { label: 'Shift the kickoff time', status: DECISION_STATUS.APPROVED },
          { label: 'Escalate to the competition committee', status: DECISION_STATUS.ESCALATED },
        ],
      });
    }
  }

  return { findings, seasonId };
}

function travelLoadFinding(team, run, ix) {
  const first = run[0];
  const last = run[run.length - 1];
  const weeks = Math.round((parseDate(last.kickoff) - parseDate(first.kickoff)) / (7 * 86400000));
  return {
    id: `f-travel-${team.id}-${first.id}`,
    code: FINDING_CODE.TRAVEL_LOAD,
    severity: SEVERITY.INFO,
    tier: TIER.AUTONOMOUS,
    priority: PRIORITY.LOW,
    teamId: team.id,
    fixtureIds: run.map((f) => f.id),
    title: 'Consecutive away fixtures',
    message: `${team.name} travels for ${run.length} fixtures in a row across ${weeks} weeks.`,
    recommendation: 'Notify program of travel load',
    recommendationTag: 'green',
    rationale: 'Advance notice lets the program plan academic cover and budget.',
    confidence: 0.94,
    evidence: [
      { label: 'Away run', value: `${run.length} fixtures`, source: 'Derived' },
      { label: 'From', value: `${label(first, ix)} · ${fmtShort(first.kickoff)}`, source: 'Competition calendar' },
      { label: 'To', value: `${label(last, ix)} · ${fmtShort(last.kickoff)}`, source: 'Competition calendar' },
    ],
  };
}
