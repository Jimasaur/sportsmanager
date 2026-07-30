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

## Prototype

The current prototype is a dependency-free static control panel. It includes:

- command center with live work feed;
- approval queue and human decision funnel;
- agent roster with status and current runs;
- pause-all and operating-brief controls;
- competition calendar;
- eligibility exception desk;
- standings and rankings;
- communications drafting studio;
- championship runbook.

### Run locally

```bash
python3 -m http.server 4173
```

Open <http://localhost:4173>.

No build step. No framework. No credentials required.

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
- [ ] Authentication and role-based access
- [ ] Durable events, decisions, and audit log
- [ ] Integrations: registration, scheduling, email, calendar, finance
- [ ] Agent runtime with tool permissions and safe checkpoints
- [ ] Organization-specific policies and templates
- [ ] Multi-organization tenancy
- [ ] Mobile approval queue

## Suggested first production slice

1. Connect one competition-registration source.
2. Build a canonical team / player / fixture data model.
3. Add a read-only reconciliation agent.
4. Add draft-only communications.
5. Introduce approvals and audit receipts.
6. Add writes only after the read path is trusted.

## Repository layout

```text
.
├── index.html       # prototype control panel
├── styles.css       # visual system and responsive layout
├── app.js           # lightweight interactions
├── README.md        # product and project guide
└── MVP-NOTES.md     # original prototype notes
```

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
