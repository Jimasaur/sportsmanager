# manager.jimmys.tools

A static MVP for a one-human / one-agent competition operations control plane.

## Included product surfaces

- Command center with decision queue, live agent feed, metrics, and milestones
- Competition calendar with conflict-aware event view
- Eligibility desk with human-gated exception handling
- Standings and rankings snapshot
- Communications drafting studio
- Championship operations runbook

## Run locally

```bash
python3 -m http.server 4173 --bind 127.0.0.1 --directory manager.jimmys.tools
```

Then open `http://127.0.0.1:4173`.

## Next production steps

1. Put the static app behind the `manager.jimmys.tools` DNS record and TLS.
2. Add authentication and a server-side API layer.
3. Connect registration, scheduling, email, and calendar systems.
4. Persist drafts, approvals, audit events, and agent runs.
5. Keep consequential actions approval-gated by default.
