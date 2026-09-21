# Frontend: Vite + React + TypeScript

Run from the repository root with Node 24 and npm:

```sh
npm install
npm run server
# In a second terminal:
npm run client
```

Open http://localhost:8081. `dev`, `start`, and `web` in this workspace all run
Vite. The API defaults to http://localhost:5000. For another API origin, copy
`client/.env.example` to ignored `client/.env.local`, set `VITE_API_URL`, and
restart Vite. This value is public and baked into the production build. Never
put secrets here. The backend must allow the exact frontend origin in CORS.
The migration kept the backend intact. The acceptance follow-up changes only ingredient endpoint role guards to match the brief.

## Build and verify

```sh
npm run typecheck
npm test --workspace client
npm run build:web
npm run preview --workspace client
# Stop preview before running browser tests (they start their own preview):
npm run test:e2e --workspace client
```

Browser tests use installed Microsoft Edge by default, with mocked API responses.
For another installed Playwright browser set `PLAYWRIGHT_CHANNEL`, or install
Chromium with `npx playwright install chromium` and set that variable to `chromium`.
Tests exercise all four roles against 22 protected paths, API guard alignment,
account forms, login/logout, recovery, mobile navigation, and offline shell caching.
They do not prove email delivery or mutate real shared accounts.

Deploy **only `client/dist`** to a static host with HTTPS. Configure history
fallback to `index.html` for SPA paths; never rewrite `/api/*`, missing static
assets, `sw.js`, or `manifest.webmanifest` to HTML. Route `/api` to the backend
when using a same-origin API. Use `VITE_API_URL=/` for that build. This is a
client-only TanStack Router SPA, with no SSR or TanStack Start.

## PWA

The public manifest and existing 192/512 PNG icons are retained. `vite-plugin-pwa`
generates `dist/sw.js` and precaches build assets, fonts, icons, and `index.html`.
There are no runtime API/data caching rules. Offline launch displays the shell;
authentication and data still require the network. Browser install UI is available
on supported browsers with HTTPS or localhost. Actual installation prompts and
iOS Add to Home Screen should be checked on target devices.

Updates offer **Reload app / Later** instead of interrupting open forms. The new
worker removes only the previous app's `shelflifeai-pwa-*` caches when activated.
Service workers are disabled during development. If you previously used production
preview on localhost:8081, unregister its worker in browser Application tools
before switching to Vite development on that same origin.

## Routing and permissions

`src/routing/router.tsx` declares lazy-loaded routes and checks the current user
before protected screens mount. `components/application/workspace.ts` is the one
permission map used by route guards, sidebar links, dashboard links, and tabs.
Old bookmarks redirect to protected canonical routes. Unknown paths fail closed.

| API-backed screen | Super Admin | Admin | Inventory Manager | Inventory Staff |
| --- | --- | --- | --- | --- |
| User management / account summary | Yes | Yes, scoped by API | No | No |
| Audit records | Yes | Yes | No | No |
| System dashboard summary | Yes | No | No | No |
| Ingredient reads | Yes | Yes | Yes | Yes |
| Ingredient creation | No | No | Yes | Yes |
| Ingredient update/removal | No | No | Yes | No |

Admin dashboard uses `/users/summary`, not the Super Admin-only dashboard API.
Ingredients is readable by all roles. Admin and Super Admin have no ingredient write controls; Inventory Staff can create, and Inventory Manager can create/update/remove. Staff's Alerts link and Admin's expiration link remain removed. Admin can create Inventory Manager / Inventory Staff accounts;
Super Admin can also create Admin accounts. Existing backend self-protection and
target-role checks still apply. Role strings are canonical everywhere; legacy
route names such as `/ManagerDashboard` remain stable for bookmarks.

Other operational routes retain their existing preview access policy. There are
no backend guards to reconcile for APIs that do not yet exist; UI visibility is
not permission to access a future API.

Ingredient removal uses DELETE with `expectedVersion` and soft-archives the record. Updates use PATCH with the selected version; the ingredient service adapts API `limit` pagination to the existing widget. A 409 conflict requires reloading before retrying. See the [inventory API contract](../docs/inventory-api.md).

## Migration review and remaining verification

- Removed Expo, React Native/Web, NativeWind, Metro/Babel/Tailwind configuration,
  Expo route layouts and obsolete native sidebar/components. Retained current HTML
  screens, styles, local fonts and brand assets; moved screens into `src/pages`.
- Preserved recovery fragment links (`/ShelfLifeAILogin#reset=...`), HTTP-only
  refresh-cookie flow, tab access-token storage, account lifecycle forms, and
  ingredient CRUD. Added direct `/forgot-password` and `/reset-password` entries.
- Exposed previously unreachable Admin creation and account edit/lifecycle controls
  according to the existing backend permissions. Successful 204 deletion no longer
  attempts JSON parsing. Login lockout now has explicit feedback.
- Verify real email delivery, remember-me cookie rotation across tabs, and browser
  CORS/HTTPS cookie settings against the team's deployment. Current configuration and available repository history identify one actual cluster, `shelflifeai.r3dcblh.mongodb.net`, database `shelflifeai`. It has no legacy Manager accounts. The earlier second-cluster note was unsupported carryover; no second migration is outstanding in this repository.
- Inventory batches, stock-in, usage/waste, change approvals, forecasts/reports and
  settings/security controls still include previews/disabled actions. They were
  preserved, not connected to new APIs. Notifications remain local browser data.
- Recheck exports/filters, responsive charts, dialogs and keyboard interactions
  with realistic datasets. Account filtering still operates on the loaded page;
  unsupported summaries remain pending. Audit snapshots are typed but the existing
  table does not yet provide a before/after inspection UI.
- The large existing stylesheet and module component were retained to avoid an
  unrelated redesign. CSS consolidation is separate work.

Reference implementation docs: [TanStack Router](https://tanstack.com/router/latest/docs/quick-start)
and [Vite PWA](https://vite-pwa-org.netlify.app/guide/).
