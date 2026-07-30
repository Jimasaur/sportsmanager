/**
 * Communications — drafting only. Nothing in this view can send anything; the
 * furthest an operator can take a draft here is "approved to send", which is a
 * separate gate from sending it.
 */

import { html, join, pct } from '../util/dom.js';
import { selectCommunications, selectSeason } from '../store.js';
import { COMM_STATUS } from '../data/schema.js';
import { fmtRelative } from '../util/date.js';
import { pageIntro, emptyState } from './shared.js';

/** Recipient counts are derived, so coverage gaps are real gaps. */
function audienceCoverage(db) {
  return [
    {
      id: 'team-contacts',
      label: 'Team contacts',
      reachable: db.teams.filter((t) => t.contactEmail).length,
      total: db.teams.length,
    },
    {
      id: 'conference-leads',
      label: 'Conference leads',
      reachable: db.conferences.length,
      total: db.conferences.length,
    },
    {
      id: 'officials',
      label: 'Officials',
      reachable: db.officials.filter((o) => o.email).length,
      total: db.officials.length,
    },
  ];
}

export function renderComms(state) {
  const { db } = state;
  const season = selectSeason();
  const communications = selectCommunications();
  const coverage = audienceCoverage(db);
  const gaps = coverage.filter((c) => c.reachable < c.total);

  return html`
    ${pageIntro({
      eyebrow: 'DRAFTING STUDIO',
      title: 'Communications',
      subhead: 'The agent turns operational changes into audience-ready updates. Approving a draft authorises sending; it does not send.',
      actions: '<button class="primary-btn" data-action="generate-bulletin">Draft an update <span>✦</span></button>',
    })}

    <div class="comms-grid">
      <div>
        ${communications.length === 0
          ? emptyState('No drafts.', 'Use “Draft an update” to have the agent assemble one from current state.')
          : join(communications.map((comm) => {
            const approved = comm.status === COMM_STATUS.APPROVED;
            return html`<div class="panel comm-panel">
              <div class="panel-head">
                <div>
                  <span class="eyebrow">${approved ? 'APPROVED TO SEND' : 'READY FOR APPROVAL'}</span>
                  <h3>${comm.title}</h3>
                </div>
                <span class="tag ${approved ? 'green' : ''}">${approved ? 'Approved' : 'Draft'}</span>
              </div>
              <div class="draft-preview">
                <div class="draft-meta">
                  TO · ${comm.audiences.map((id) => db.audiences.find((a) => a.id === id)?.label || id).join(', ')}
                  · ${comm.generated ? 'generated from live state' : 'prepared by Herald'}
                  · ${fmtRelative(comm.createdAt)}
                </div>
                ${join(comm.body.split('\n\n').map((para) => html`<p>${para}</p>`))}
                <div class="draft-actions">
                  ${approved
                    ? html`<span class="tag green">Approved ${fmtRelative(comm.approvedAt)} — sending is a separate gate</span>`
                    : html`<button class="primary-btn small" data-action="approve-comm" data-id="${comm.id}">Approve for sending</button>`}
                  ${comm.generated
                    ? html`<button class="ghost-btn" data-action="discard-comm" data-id="${comm.id}">Discard</button>`
                    : ''}
                </div>
              </div>
            </div>`;
          }))}
      </div>

      <div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">RECIPIENT HEALTH</span>
              <h3>Audience coverage</h3>
            </div>
          </div>
          <div class="coverage">
            ${join(coverage.map((entry) => html`<div>
              <span>${entry.label}</span>
              <strong>${entry.reachable} / ${entry.total}</strong>
              <div class="progress"><i style="width:${pct(entry.reachable, entry.total)}%"></i></div>
            </div>`))}
          </div>
          ${gaps.length ? html`<p class="muted-copy coverage-note">
            ${gaps.map((g) => `${g.total - g.reachable} ${g.label.toLowerCase()}`).join(' and ')}
            ${gaps.length === 1 && gaps[0].total - gaps[0].reachable === 1 ? 'has' : 'have'}
            no working address on file. They will not receive this update.
          </p>` : ''}
        </div>

        <div class="panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">WHAT THE DRAFT DRAWS ON</span>
              <h3>Sources</h3>
            </div>
          </div>
          <dl class="evidence">
            <div class="evidence-row">
              <dt>Season</dt>
              <dd>${season.name}<span class="evidence-source">Season configuration</span></dd>
            </div>
            <div class="evidence-row">
              <dt>Calendar</dt>
              <dd>${state.derived.conflicts.findings.length} open schedule findings<span class="evidence-source">Conflict scan</span></dd>
            </div>
            <div class="evidence-row">
              <dt>Eligibility</dt>
              <dd>${state.derived.teamStatus.summary.needsDocs} programs with document gaps<span class="evidence-source">Eligibility audit</span></dd>
            </div>
            <div class="evidence-row">
              <dt>Decisions</dt>
              <dd>${state.derived.decisions.length} routed to a human<span class="evidence-source">Decision queue</span></dd>
            </div>
          </dl>
        </div>
      </div>
    </div>`;
}
