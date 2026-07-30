/**
 * Eligibility rule engine.
 *
 * Reads registration records and documents, emits findings. It never decides
 * anything: each finding carries the guardrail tier that governs it, and
 * `rules/decisions.js` turns the ones that need a person into decisions.
 *
 * Every finding carries its evidence — the specific records that produced it —
 * so the operator can check the agent's work rather than trust it.
 */

import {
  FINDING_CODE, SEVERITY, TIER, PRIORITY, DECISION_STATUS,
  DOC_KIND, DOC_KIND_META, DOC_STATUS,
} from '../data/schema.js';
import { daysUntil, parseDate, fmtShort, fmtFull, toISODate } from '../util/date.js';

/** Age in whole years at a given date. */
function ageAt(dob, at) {
  const birth = parseDate(dob);
  const when = parseDate(at);
  let age = when.getFullYear() - birth.getFullYear();
  const beforeBirthday = when.getMonth() < birth.getMonth()
    || (when.getMonth() === birth.getMonth() && when.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function playerName(player) {
  return `${player.firstName} ${player.lastName}`;
}

function finding(input) {
  return {
    id: input.id,
    code: input.code,
    severity: input.severity,
    tier: input.tier,
    priority: input.priority || PRIORITY.MED,
    teamId: input.teamId || null,
    playerId: input.playerId || null,
    title: input.title,
    message: input.message,
    recommendation: input.recommendation ?? null,
    recommendationTag: input.recommendationTag || '',
    rationale: input.rationale || '',
    confidence: input.confidence ?? null,
    evidence: input.evidence || [],
    options: input.options || null,
  };
}

export function runEligibilityAudit(db, ix, seasonId = db.activeSeasonId) {
  const season = ix.seasonById[seasonId];
  const findings = [];

  // --- Team documentation --------------------------------------------------
  for (const team of db.teams) {
    const docs = (ix.documentsByOwner[`team:${team.id}`] || []).filter((d) => d.seasonId === seasonId);

    for (const kind of [DOC_KIND.INSURANCE, DOC_KIND.SAFEGUARDING]) {
      const doc = docs.find((d) => d.kind === kind);
      const label = DOC_KIND_META[kind].label;

      if (!doc || doc.status === DOC_STATUS.MISSING) {
        findings.push(finding({
          id: `f-doc-missing-${team.id}-${kind}`,
          code: FINDING_CODE.TEAM_DOC_MISSING,
          severity: SEVERITY.WARNING,
          // Chasing a missing document is routine and reversible.
          tier: TIER.AUTONOMOUS,
          priority: PRIORITY.MED,
          teamId: team.id,
          title: `${label} missing`,
          message: `${team.name} has not filed a ${label.toLowerCase()} for ${season.name}.`,
          recommendation: 'Send documentation reminder',
          recommendationTag: 'orange',
          rationale: `Registration closes ${fmtFull(season.registrationCloses)}. A reminder now leaves ${daysUntil(season.registrationCloses)} days to respond.`,
          confidence: 0.98,
          evidence: [
            { label: 'Required document', value: label, source: 'Competition regulations §4.2' },
            { label: 'Filed', value: 'No record', source: 'Document register' },
            { label: 'Deadline', value: fmtFull(season.registrationCloses), source: 'Season configuration' },
            { label: 'Program contact', value: team.contactEmail, source: 'Team record' },
          ],
        }));
        continue;
      }

      // A document that lapses mid-season is a gap even though it exists today.
      if (doc.expiresAt && parseDate(doc.expiresAt) < parseDate(season.endDate)) {
        findings.push(finding({
          id: `f-doc-expiring-${team.id}-${kind}`,
          code: FINDING_CODE.TEAM_DOC_EXPIRED,
          severity: SEVERITY.WARNING,
          tier: TIER.AUTONOMOUS,
          priority: PRIORITY.MED,
          teamId: team.id,
          title: `${label} lapses mid-season`,
          message: `${team.name}'s ${label.toLowerCase()} expires ${fmtShort(doc.expiresAt)}, before the season ends ${fmtShort(season.endDate)}.`,
          recommendation: 'Request renewal before expiry',
          recommendationTag: 'orange',
          rationale: 'Cover must be continuous for the whole competition period.',
          confidence: 0.95,
          evidence: [
            { label: 'Document', value: label, source: 'Document register' },
            { label: 'Expires', value: fmtFull(doc.expiresAt), source: 'Document register' },
            { label: 'Season ends', value: fmtFull(season.endDate), source: 'Season configuration' },
          ],
        }));
      }
    }

    // --- Roster size -------------------------------------------------------
    const roster = ix.playersByTeam[team.id] || [];
    if (roster.length < season.rosterMinimum) {
      findings.push(finding({
        id: `f-roster-${team.id}`,
        code: FINDING_CODE.ROSTER_MINIMUM,
        severity: SEVERITY.WARNING,
        tier: TIER.AUTONOMOUS,
        priority: PRIORITY.LOW,
        teamId: team.id,
        title: 'Roster below minimum',
        message: `${team.name} has ${roster.length} registered players; ${season.rosterMinimum} are required.`,
        recommendation: 'Notify program of shortfall',
        recommendationTag: 'orange',
        rationale: 'A short roster cannot field front-row cover, which forces uncontested scrums.',
        confidence: 0.99,
        evidence: [
          { label: 'Registered', value: `${roster.length} players`, source: 'Registration system' },
          { label: 'Required', value: `${season.rosterMinimum} players`, source: 'Competition regulations §3.1' },
        ],
      }));
    }
  }

  // --- Player documentation, age, lateness --------------------------------
  for (const player of db.players) {
    if (player.seasonId !== seasonId) continue;
    const team = ix.teamById[player.teamId];
    const docs = (ix.documentsByOwner[`player:${player.id}`] || []).filter((d) => d.seasonId === seasonId);

    const medical = docs.find((d) => d.kind === DOC_KIND.MEDICAL);
    if (!medical || medical.status !== DOC_STATUS.VALID) {
      findings.push(finding({
        id: `f-medical-${player.id}`,
        code: FINDING_CODE.PLAYER_DOC_MISSING,
        severity: SEVERITY.WARNING,
        // Withholding clearance affects a named individual, so a person signs off.
        tier: TIER.APPROVAL,
        priority: PRIORITY.MED,
        teamId: player.teamId,
        playerId: player.id,
        title: 'Medical clearance missing',
        message: `${playerName(player)} (#${player.registrationId}, ${team.shortName}) has no valid medical clearance on file.`,
        recommendation: 'Withhold clearance pending medical',
        recommendationTag: 'orange',
        rationale: 'Players without current medical clearance cannot be listed on a matchday squad.',
        confidence: 0.97,
        evidence: [
          { label: 'Player', value: `${playerName(player)} · #${player.registrationId}`, source: 'Registration system' },
          { label: 'Team', value: team.name, source: 'Registration system' },
          { label: 'Medical clearance', value: 'No valid record', source: 'Document register' },
          { label: 'Waiver', value: docs.some((d) => d.kind === DOC_KIND.WAIVER) ? 'On file' : 'Missing', source: 'Document register' },
        ],
        options: [
          { label: 'Withhold clearance pending medical', status: DECISION_STATUS.APPROVED },
          { label: 'Grant provisional clearance', status: DECISION_STATUS.APPROVED },
          { label: 'Request the document from the program', status: DECISION_STATUS.INFO_REQUESTED },
        ],
      }));
    }

    // --- Minimum age (safeguarding) ---------------------------------------
    const age = ageAt(player.dob, season.startDate);
    if (age < season.minimumAge) {
      findings.push(finding({
        id: `f-age-${player.id}`,
        code: FINDING_CODE.AGE_MINIMUM,
        severity: SEVERITY.CRITICAL,
        // Safeguarding: the agent gathers context and stops.
        tier: TIER.HUMAN_ONLY,
        priority: PRIORITY.HIGH,
        teamId: player.teamId,
        playerId: player.id,
        title: 'Player under minimum age',
        message: `${playerName(player)} (#${player.registrationId}, ${team.shortName}) will be ${age} at season start; the minimum is ${season.minimumAge}.`,
        recommendation: null, // deliberately none — safeguarding is not an agent call
        rationale: '',
        confidence: null,
        evidence: [
          { label: 'Player', value: `${playerName(player)} · #${player.registrationId}`, source: 'Registration system' },
          { label: 'Date of birth', value: fmtFull(player.dob), source: 'Registration system' },
          { label: 'Age at season start', value: `${age} years`, source: 'Derived' },
          { label: 'Minimum age', value: `${season.minimumAge} years`, source: 'Safeguarding policy §2' },
        ],
        options: [
          { label: 'Refer to the safeguarding lead', status: DECISION_STATUS.ESCALATED },
          { label: 'Reject the registration', status: DECISION_STATUS.REJECTED },
          { label: 'Approve with a documented dispensation', status: DECISION_STATUS.APPROVED },
        ],
      }));
    }

    // --- Late roster addition ---------------------------------------------
    if (parseDate(player.registeredAt) > parseDate(season.rosterDeadline)) {
      const daysLate = daysUntil(player.registeredAt, season.rosterDeadline);
      findings.push(finding({
        id: `f-late-${player.id}`,
        code: FINDING_CODE.LATE_REGISTRATION,
        severity: SEVERITY.INFO,
        tier: TIER.APPROVAL,
        priority: PRIORITY.LOW,
        teamId: player.teamId,
        playerId: player.id,
        title: 'Late roster addition',
        message: `${playerName(player)} (#${player.registrationId}, ${team.shortName}) was added ${daysLate} days after the roster deadline.`,
        recommendation: 'Accept late addition',
        recommendationTag: 'green',
        rationale: `Registration is still open until ${fmtFull(season.registrationCloses)} and no competitive advantage is implied.`,
        confidence: 0.88,
        evidence: [
          { label: 'Registered', value: fmtFull(player.registeredAt), source: 'Registration system' },
          { label: 'Roster deadline', value: fmtFull(season.rosterDeadline), source: 'Season configuration' },
          { label: 'Days late', value: String(daysLate), source: 'Derived' },
        ],
        options: [
          { label: 'Accept the late addition', status: DECISION_STATUS.APPROVED },
          { label: 'Reject the addition', status: DECISION_STATUS.REJECTED },
          { label: 'Request an explanation', status: DECISION_STATUS.INFO_REQUESTED },
        ],
      }));
    }

    // --- Transfer window ---------------------------------------------------
    if (player.transferFromTeamId && player.transferRequestedAt) {
      const requested = parseDate(player.transferRequestedAt);
      const outsideWindow = requested < parseDate(season.transferWindowOpens)
        || requested > parseDate(season.transferWindowCloses);
      if (outsideWindow) {
        const from = ix.teamById[player.transferFromTeamId];
        findings.push(finding({
          id: `f-transfer-${player.id}`,
          code: FINDING_CODE.TRANSFER_WINDOW,
          severity: SEVERITY.CRITICAL,
          // Policy interpretation, not a lookup — this is a committee question.
          tier: TIER.HUMAN_ONLY,
          priority: PRIORITY.HIGH,
          teamId: player.teamId,
          playerId: player.id,
          title: 'Transfer filed outside window',
          message: `${playerName(player)} (#${player.registrationId}) filed a transfer from ${from.name} to ${team.name} after the window closed.`,
          recommendation: null,
          rationale: '',
          confidence: null,
          evidence: [
            { label: 'Player', value: `${playerName(player)} · #${player.registrationId}`, source: 'Registration system' },
            { label: 'From', value: from.name, source: 'Registration system' },
            { label: 'To', value: team.name, source: 'Registration system' },
            { label: 'Transfer filed', value: fmtFull(player.transferRequestedAt), source: 'Transfer register' },
            { label: 'Window', value: `${fmtShort(season.transferWindowOpens)} – ${fmtShort(season.transferWindowCloses)}`, source: 'Competition regulations §6' },
            { label: 'Release document', value: 'Pending', source: 'Document register' },
          ],
          options: [
            { label: 'Escalate to the competition committee', status: DECISION_STATUS.ESCALATED },
            { label: 'Approve the transfer', status: DECISION_STATUS.APPROVED },
            { label: 'Reject the transfer', status: DECISION_STATUS.REJECTED },
          ],
        }));
      }
    }
  }

  // --- Duplicate registrations --------------------------------------------
  // Matched on identity rather than registration id: the same person filed by
  // two programs gets two different ids, which is precisely why an id check
  // would miss it.
  const byIdentity = {};
  for (const player of db.players) {
    if (player.seasonId !== seasonId) continue;
    const key = `${player.firstName.toLowerCase()}|${player.lastName.toLowerCase()}|${player.dob}`;
    (byIdentity[key] ||= []).push(player);
  }

  for (const group of Object.values(byIdentity)) {
    if (group.length < 2) continue;
    const teams = new Set(group.map((p) => p.teamId));
    if (teams.size < 2) continue; // same team twice is a data-entry issue, not a conflict

    const [first, second] = group;
    const firstTeam = ix.teamById[first.teamId];
    const secondTeam = ix.teamById[second.teamId];
    findings.push(finding({
      id: `f-duplicate-${first.id}`,
      code: FINDING_CODE.DUPLICATE_REGISTRATION,
      severity: SEVERITY.CRITICAL,
      tier: TIER.APPROVAL,
      priority: PRIORITY.HIGH,
      teamId: first.teamId,
      playerId: first.id,
      title: 'Conflicting registration',
      message: `${playerName(first)} appears on two rosters: ${firstTeam.name} (#${first.registrationId}) and ${secondTeam.name} (#${second.registrationId}).`,
      recommendation: 'Request clarification from both programs',
      recommendationTag: 'orange',
      rationale: `Identity matches on full name and date of birth. ${firstTeam.shortName} registered first (${fmtShort(first.registeredAt)}), which usually holds, but neither program has been asked yet.`,
      confidence: 0.82,
      evidence: [
        { label: 'Matched on', value: 'Full name + date of birth', source: 'Derived' },
        { label: 'Date of birth', value: fmtFull(first.dob), source: 'Registration system' },
        { label: firstTeam.name, value: `#${first.registrationId} · registered ${fmtShort(first.registeredAt)}`, source: 'Registration system' },
        { label: secondTeam.name, value: `#${second.registrationId} · registered ${fmtShort(second.registeredAt)}`, source: 'Registration system' },
        { label: 'Precedent', value: 'Earliest valid registration holds unless released', source: 'Competition regulations §5.4' },
      ],
      options: [
        { label: 'Request clarification from both programs', status: DECISION_STATUS.INFO_REQUESTED },
        { label: `Confirm registration with ${firstTeam.shortName}`, status: DECISION_STATUS.APPROVED },
        { label: `Confirm registration with ${secondTeam.shortName}`, status: DECISION_STATUS.APPROVED },
        { label: 'Escalate to the competition committee', status: DECISION_STATUS.ESCALATED },
      ],
    }));
  }

  return { findings, seasonId, generatedAt: toISODate(new Date()) };
}

/**
 * Roll findings up to one status per team, for the eligibility desk.
 * `exception` outranks `needs_docs`, which outranks `ready`.
 */
export function summariseByTeam(db, findings) {
  const byTeam = {};
  for (const team of db.teams) {
    byTeam[team.id] = { teamId: team.id, status: 'ready', findings: [] };
  }
  for (const item of findings) {
    if (!item.teamId || !byTeam[item.teamId]) continue;
    const entry = byTeam[item.teamId];
    entry.findings.push(item);
    if (item.severity === SEVERITY.CRITICAL) entry.status = 'exception';
    else if (entry.status !== 'exception') entry.status = 'needs_docs';
  }

  const values = Object.values(byTeam);
  return {
    byTeam,
    summary: {
      total: values.length,
      ready: values.filter((t) => t.status === 'ready').length,
      needsDocs: values.filter((t) => t.status === 'needs_docs').length,
      exceptions: values.filter((t) => t.status === 'exception').length,
    },
  };
}
