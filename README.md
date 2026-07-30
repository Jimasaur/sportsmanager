# sportsmanager

### A human-directed operating system for sports organizations.

**sportsmanager** is a control plane for running the work behind a federation, league, club, or tournament: schedules, eligibility, player pathways, training, communications, finance, performance, and championship operations—coordinated by specialist agents and governed by one accountable human.

> **One human. One well-built agent team. No black-box decisions.**

[Open the prototype](./index.html) · [View the roadmap](#roadmap) · [Contributing](#contributing)

---

## Why this exists

Sports organizations are held together by email, spreadsheets, calendar archaeology, and heroic people who remember everything. The work is operationally repetitive but contextually important.

`sportsmanager` turns that work into a visible operating system:

- agents handle reconciliation, drafting, monitoring, and preparation;
- the human sets direction, resolves ambiguity, and approves consequences;
- every important action has a clear status, owner, recommendation, and audit trail.

This is **not** an autonomous executive. It is a cockpit for accountable operations.

## The control plane

```text
                 ┌──────────────────────────────┐
                 │       HUMAN COMMANDER        │
                 │ direction · approvals · veto │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │       SPORTS MANAGER          │
                 │ shared context · guardrails   │
                 │ decisions · audit · memory    │
                 └──────┬───────┬───────┬────────┘
                        │       │       │
             ┌──────────▼─┐ ┌───▼────┐ ┌▼───────────┐
             │ Competition │ │ Player │ │ Comms &    │
             │ operations  │ │ systems │ │ admin      │
             └──────────────┘ └────────┘ └────────────┘
                   specialist agents with bounded authority
```

## Agent workstreams

| Workstream | Agent focus | Human gate |
|---|---|---|
| Competition management | schedules, eligibility, standings, conflicts | exceptions and policy |
| Player systems & development | pathways, talent ID, camps, development plans | selection decisions |
| Training & education | courses, educators, coverage, reminders | appointments and standards |
| Marketing & communications | briefs, campaigns, bulletins, stakeholder updates | publish and brand |
| Finance & administration | budgets, invoices, reporting, controls | spending and commitments |
| Performance & medical | readiness, travel, care logistics | clinical judgment |
| Youth & pathway programs | U18/U23 programs, events, regional coordination | safeguarding and selection |
| Championship operations | venues, officials, runbooks, matchday response | contracts and incidents |

## The application

Dependency-free ES modules. No build step, no framework, no credentials.

The important property is that **nothing on screen is a hard-coded number**. A canonical
dataset is built at load, rule engines run over it, and the views render whatever those
engines produce. Delete a fixture and the standings change; add a document and a finding
disappears.

### What is real

| Surface | What actually happens |
|---|---|
| Command center | Counts, confidence, and the live feed are derived from rule output |
| Decision queue | Findings routed by guardrail tier, grouped by workstream, low-signal items batched |
| Decision drawer | Recommendation, confidence, evidence records, options, and a note — written to the audit trail |
| Agent roster | Status derived from each agent's open decisions; pause-all is enforced |
| Competition calendar | 500+ fixtures across two seasons, with a live conflict scan |
| Eligibility desk | Eight rules over 1,078 registrations and 2,100+ documents |
| Standings | Recomputed from results on every render, World Rugby bonus points |
| Communications | Drafts assembled from current state; approval is a separate gate from sending |
| Championship ops | Runbook completion derived from the checklist |
| Audit trail | Every human and agent action, persisted |

### Rule engines

- **Eligibility** — missing and lapsing documents, duplicate registrations matched on
  identity rather than id, transfers outside the window, minimum age, late roster
  additions, roster minimums.
- **Schedule conflicts** — team double-bookings, venue clashes, short turnarounds,
  consecutive-away travel load.
- **Standings** — 4 for a win, 2 for a draw, a bonus point for four or more tries, a bonus
  point for losing by seven or fewer. Trend compares against the previous round.

### Run locally

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.

The app uses ES modules, so it must be served over HTTP — opening `index.html` from the
file system will not work.

### Seeded state

The dataset is generated deterministically, so every reload produces the same records and a
stored decision always points at a record that still exists. Anomalies are injected as
ordinary records — the engines have no knowledge of them and rediscover each one:

- a player registered to two programs under different registration ids;
- a transfer filed after the window closed;
- a player under the minimum age at season start;
- six programs with no certificate of insurance;
- a team double-booking, a venue clash, and a short turnaround.

Only your decisions are persisted, in `localStorage` under `sportsmanager:overlay:v1`.
"Reset workspace" on the audit trail screen clears them.

## Design principles

### Human direction, not human busywork

The system should remove repetitive coordination—not remove accountability.

### Guardrails are product features

Every agent action is classified as:

- **Autonomous** — routine and reversible;
- **Approval required** — external, consequential, or reputational;
- **Human only** — medical, legal, safeguarding, disciplinary, or policy judgment.

### Receipts over vibes

Every recommendation should carry its source records, assumptions, confidence, next action, and audit history.

### One shared operating picture

Agents should not create eight competing spreadsheets. They should contribute to one canonical state of the organization.

## Roadmap

- [x] Static command center prototype
- [x] Specialist agent roster and workstream model
- [x] Human approval gates in the interface
- [x] Canonical data model for teams, players, fixtures, documents, and decisions
- [x] Eligibility, schedule-conflict, and standings rule engines
- [x] Guardrail tiers enforced in the routing layer rather than described in prose
- [x] Evidence and confidence attached to every recommendation
- [x] Audit trail as a first-class surface
- [ ] Server-side persistence (the audit log is currently browser-local)
- [ ] Authentication and role-based access
- [ ] Integrations: registration, scheduling, email, calendar, finance
- [ ] Agent runtime with tool permissions and safe checkpoints
- [ ] Organization-specific policies and templates
- [ ] Multi-organization tenancy
- [ ] Mobile approval queue

## Suggested first production slice

1. Connect one competition-registration source. — *next*
2. ~~Build a canonical team / player / fixture data model.~~ — done, `src/data/schema.js`
3. ~~Add a read-only reconciliation agent.~~ — done, `src/rules/`
4. ~~Add draft-only communications.~~ — done, approval is a separate gate from sending
5. ~~Introduce approvals and audit receipts.~~ — done, `src/views/drawer.js`
6. Add writes only after the read path is trusted. — still nothing writes outward

The remaining work is mostly substitution rather than redesign: replace `buildDatabase()`
with an API client and `saveOverlay()` with a POST, and the rest of the app is unchanged.

## Repository layout

```text
.
├── index.html              # shell only — the app renders into #app
├── styles.css              # visual system and responsive layout
├── src/
│   ├── main.js             # shell, router, one delegated event listener
│   ├── store.js            # state, selectors, actions, audit, persistence
│   ├── data/
│   │   ├── schema.js       # canonical model, guardrail tiers, factories
│   │   ├── seed.js         # deterministic dataset and injected anomalies
│   │   └── indexes.js      # lookup tables
│   ├── rules/
│   │   ├── eligibility.js  # registration and document rules
│   │   ├── conflicts.js    # schedule conflict detection
│   │   ├── standings.js    # league points and rankings
│   │   └── decisions.js    # findings → decisions, tier routing, batching
│   ├── views/              # pure state → HTML per surface, plus the drawer
│   └── util/               # dates, deterministic RNG, escaped templating
├── README.md               # product and project guide
├── DEPLOY.md               # hosting requirements and what this is not
└── MVP-NOTES.md            # original prototype notes
```

### How a change flows

```text
seed.js ──▶ indexes.js ──▶ rules/*.js ──▶ decisions.js ──▶ store.js ──▶ views/*.js
                                              │                │
                                    guardrail tier decides     └── overlay + audit log
                                    autonomous / approval /         (the only thing
                                    human-only                       persisted)
```

Adding a rule means adding a finding with a tier and its evidence. Routing, batching,
queueing, the drawer, and the audit trail all follow from that — no view changes required.

## Contributing

The project is early and intentionally opinionated. Good contributions should make operations more legible, safer, or easier to audit.

Before opening a pull request:

- keep consequential actions approval-gated;
- explain what the agent can and cannot do;
- include the source of any new operational rule;
- prefer small, inspectable changes over opaque automation;
- document how a human can pause, correct, or reverse the behavior.

## License

MIT — see [LICENSE](./LICENSE).
