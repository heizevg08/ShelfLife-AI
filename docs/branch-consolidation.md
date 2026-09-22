# Branch consolidation — 22 September 2026

## Trunk and scope

`stable` is the sole trunk/default branch. Its baseline for this cleanup is
`b72701d2d86395fa5505bd9f42e6a0981876620b`, including PR #2's systemConfig,
ingredient concurrency contract, and InventoryBatch implementation. No legacy
branch was merged into it during cleanup. The selected UI port is on
`codex/port-reviewed-ui` and needs a teammate's review before merge.

Archiving does **not** mean every feature on an old branch has been implemented.
Each former branch tip is preserved in an annotated tag on GitHub, including its
entire reachable history. The old remote branch names were removed after checking
for open PRs, verifying the remote tags' peeled commits, and using an atomic push
with an expected-tip lease for each deletion. A concurrent branch update would
abort the deletion. `stable` was neither reset nor rewritten.

## Branch disposition

All tag names below start with `archive/2026-09-22/`.

| Former branch | Exact preserved commit | Tag suffix | Disposition |
| --- | --- | --- | --- |
| `Version-0.01` | `d734139372aea3dfb0b66cf6a07a63b5aa80459d` | `version-0.01` | Already an ancestor of stable; obsolete runtime. |
| `Aj-Backend` | `ec44cc9db663159a2bcdf4b818e9fc3d2881de86` | `aj-backend` | Three legacy backend commits; retained for reference, not merged. |
| `typescript-migration-ni-kinit` | `3dead136cc8d9a7a826350c016ea4434d5f50783` | `typescript-models` | Includes AJ's commits and a conversion commit. InventoryBatch concept already adapted in PR #2; legacy implementation excluded. |
| `feat/shelflifeai-continuation-halog` | `e14c948c49d10310df13022a0d2c23a42fe7f2fc` | `halog-ui` | 25 UI commits outside stable; selected changes ported in this review branch; remaining designs archived. |
| `archive-stable-e14c948` | `e14c948c49d10310df13022a0d2c23a42fe7f2fc` | `previous-stable` | Exact duplicate of the UI tip, not a second trunk. |
| `inventory-batch-contract` | `1cab980f5255a8c888345310bb03aad48294972d` | `inventory-batch-contract` | Fully merged by PR #2; stable's merge tree matches this tip. |

The local `codex/inventory-batch-contract` and old local UI branch were also
checked for ancestry against stable/the archived UI tip before retirement.

## Selected UI port

The actual source diff was reviewed rather than relying on commit titles.

| Source in archived UI branch | Outcome in current Vite app |
| --- | --- |
| `client/src/components/application/AuditTable.tsx` | Keep column headings while loading, showing an error, or displaying an empty result. Retain current API/filter contracts and only show pagination once data exists. |
| `client/src/components/dashboard/SuperAdminDashboard.tsx` | Adapt the account role-distribution chart. Use canonical role strings and current account API; only chart when the entire result is loaded. Keep existing dashboard services/security sections. |
| `client/src/components/application/administration.ts` and `ApplicationShell.tsx` | Direct the Super Admin Users entry to `/UserManagement` and group it under Administration. Preserve `/AdminAccounts` compatibility and current route guards. |
| `client/src/styles/application.css` | Add only the chart's scoped styles, not the incoming 4,886-line global stylesheet expansion. |

No backend models, routes, dependencies, migrations, ingredient write controls,
or account lifecycle logic changed in this port. Browser tests cover the chart's
complete/incomplete results and audit failure/retry, as well as existing role,
account lifecycle, ingredient permissions, login, mobile navigation, and PWA tests.

## Explicitly excluded or deferred work

These decisions explain why archived commits must not be bulk-merged later.
Paths below refer to the archived source unless stated otherwise.

| Area | Decision and evidence |
| --- | --- |
| Legacy runtime (`Backend/services/server.ts`, `model.ts`) | Exclude. Old password/token handling, startup seeding, and a separate user/role schema conflict with the hardened server. Do not execute archived startup scripts against the shared database. |
| Converted backend (`Shelflife Ai Backend/`) | Exclude controllers, auth middleware, and models. Current `server/` already supplies canonical auth, roles, transactional audits, and validated APIs. Legacy batch quantity updates, persisted status, deletion, and response contracts do not meet the approved batch contract. |
| `AccountsTable.tsx`, `AdminAccounts.tsx`, `UserManagement.tsx`, `ActiveUser.tsx` | Preserve current account behavior. The incoming status predicate returns false for every inactive account, its distribution uses `Manager`, and creation is narrowed to Super Admin. The incoming AdminAccounts redirect would replace a working screen. |
| `ModulePage.tsx`, `IngredientInventory.tsx`, `workspace.ts` | Do not replace current code: incoming ingredient permissions and API calls precede canonical roles, PATCH, `limit`, expectedVersion, and soft archiving. New preview layouts can be independently ported when their data flows are implemented. |
| `SystemSettings.tsx` | Defer layout redesign. Local state/toast save behavior and static security assertions are not proof of persisted settings or enforced security. Wire supported settings to the current versioned systemConfig API as separate work. |
| `SecurityActivity.tsx` | Defer preview redesign; use actual audit/session capabilities when implementing it. Local preview controls are not a security-events service. |
| `Alerts.tsx`, `ChangeRequests.tsx`, `Reports.tsx`, `ExpirationMonitoring.tsx`, `Forecasting.tsx` | Preserve designs in archive. UI changes do not supply missing alerts, approvals, reports, forecasting, or recording APIs. Port alongside their scoped feature implementations. |
| `MyRequests.tsx`, `ReportsAnalytics.tsx`, `UsageRecording.tsx`, `WasteRecording.tsx` | Do not add old Expo aliases. Current `/ChangeRequests`, `/Reports`, `/Usage`, `/Waste` routes remain; any future aliases must use TanStack Router and the current access map. |
| `RoleDashboard.tsx` | Staff dashboard design is recoverable for later use. New preview panels and links do not implement recording or reporting. Preserve current permitted destinations. |
| `primitives.tsx`, `AdministrationPage.tsx`, remaining shell/dashboard/style changes | Defer cosmetic changes and the export menu until scoped use requires them. Keep visible preview notices; do not imply unavailable features are live. |

## Verification

- TypeScript checks passed for both workspaces.
- Backend: 45 passed, 3 opt-in database tests skipped; no persistence code changed.
- Frontend unit tests: 7 passed.
- Production Vite/PWA build passed.
- Browser suite: 20 passed (including both new regression checks).
- Rebuilt and reran the two affected browser checks after the final chart styling adjustment.

These are automated checks with mocked frontend APIs, not a live shared-database
acceptance test. No operational database records were changed by this cleanup.

## Teammate update and recovery

Preserve any uncommitted/unpublished work first. From a clean checkout:

```bash
git fetch origin --prune --tags
git switch stable
git pull --ff-only
git switch -c your-feature-branch
```

Remote pruning does not delete teammates' local branches. Check unpublished work
before removing those locally. Never reset a teammate's branch to discard changes.

To recover an archived design without changing stable:

```bash
git fetch origin --tags
git switch -c codex/recover-ui archive/2026-09-22/halog-ui
```

Use that branch for inspection. Implement selected changes on a new branch from
current stable and open a scoped PR; do not merge the recovery branch wholesale.
Archive tags preserve history, including historical mistakes; they are not a
credential-removal mechanism. PR/review enforcement remains manual until GitHub
branch protection is available; see [the team workflow](git-workflow.md).
