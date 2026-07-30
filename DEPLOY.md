# Deploying sportsmanager

The whole repository is the deployable artifact. There is no build step, no server,
no environment variables, and no secrets.

```text
Document root   /              index.html sits at the top level
Entry point     index.html
Must ship       index.html · styles.css · src/**
Build command   (none)
```

`src/` is the application, not source to be compiled. It has to be published.

## Host configuration

**Serve `.js` as `application/javascript` or `text/javascript`.** This is an ES-module
application, and browsers refuse modules served as `text/plain` or
`application/octet-stream`. Netlify, Vercel, and Cloudflare Pages get this right by
default; a hand-configured nginx or a plain S3 bucket often does not.

**No SPA rewrite is needed.** One page, no client-side routing, no History API. A
catch-all `/* → /index.html` rule is harmless but does nothing.

**Do not let the platform infer a build.** There is no `package.json`, so most hosts
treat the repository as static automatically. If yours guesses, set the framework to
none, leave the build command empty, and set the publish directory to `.`.

**Cache headers.** Nothing is content-hashed yet, so a long `max-age` on `src/*.js` or
`styles.css` will strand visitors on stale modules after a deploy. Until asset
fingerprinting exists, use `Cache-Control: no-cache` — or a short `max-age=300` — for
`.html`, `.js`, and `.css`.

**Content Security Policy.** The only external requests are Google Fonts, for Inter and
DM Mono:

- `fonts.googleapis.com` — needs `style-src`
- `fonts.gstatic.com` — needs `font-src`

If those are blocked the page still works; it renders in a system font.

## Verifying a deployment

1. The page renders a sidebar and a command center rather than a blank screen. A blank
   screen with a console error about MIME types means the `.js` content type is wrong.
2. The command center footer reads "computed from 42 teams, 1,078 player records and
   … fixtures". If those numbers are present, the data layer and rule engines ran.
3. Open a decision from the approval queue. The drawer should show evidence rows with
   sources. If it does, the full path from seed through rules to view is working.

## What this is not

It is a front-end-only application. All operator state — decision outcomes, runbook
progress, generated drafts, and the audit trail — lives in the visitor's browser under
the `localStorage` key `sportsmanager:overlay:v1`.

That means:

- decisions do not sync between people, browsers, or devices;
- anyone with the URL sees the same seeded dataset;
- clearing site data resets the workspace;
- the audit trail is local and is not a durable record.

This is appropriate for a demonstration or an internal review. It is not appropriate for
anything that needs a shared or defensible record. If the URL is public, say so plainly
to anyone who might assume otherwise.

The seeded dataset is fictional. Team names are real programs, but every player,
document, result, and fixture is generated.

## When there is a backend

The substitution points are deliberately narrow:

- `buildDatabase()` in `src/data/seed.js` — replace with an API client.
- `loadOverlay()` / `saveOverlay()` in `src/store.js` — replace with fetches.

The rule engines and views do not change.
