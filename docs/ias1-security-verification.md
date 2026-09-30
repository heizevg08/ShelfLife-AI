# IAS1 security verification — reapplication update

Current implementation baseline: `origin/stable` commit `34de09c` (merged PR
#9, `fix/restore-staff-ingredient-create`). This document records the manual
reapplication of the IAS1 validation/diagnostics work from `0334e2e` onto that
baseline. It does not claim a new Atlas credential cutover or live VAPT run.

## Reapplied controls

- `server/src/middleware/request-diagnostics.middleware.ts` assigns a request
  ID and logs failed requests using only a timestamp, method, API scope, status,
  allowlisted error class, and numeric database error code. It excludes URLs,
  query strings, headers, IP addresses, bodies, tokens, passwords, error
  messages, and stacks. The scope set includes `account-requests`,
  `ingredient-requests`, and `change-requests`.
- `server/src/app.ts` installs request diagnostics before Helmet/CORS/route
  handling and error diagnostics before the global error response. Local
  administration, ingredient, and inventory-router error handlers also pass
  errors through the redacting diagnostic middleware.
- `server/src/validators/administration.ts` accepts audit `from`/`to` only as
  valid `YYYY-MM-DD` values or ISO UTC timestamps, rejects normalized impossible
  calendar dates, and retains the existing `from <= to` check.
- `/server/.env.ias1` is ignored. It remains a local runtime file and is not
  included by this branch.

## Current route and RBAC facts relevant to IAS1

- Direct `POST /api/ingredients` permits **Inventory Manager** and
  **Inventory Staff**; PATCH and DELETE remain Manager-only. Super Admin and
  Admin can read ingredients but cannot mutate them.
- `/api/account-requests` is available to all four roles. Manager and Staff
  can create/list only their own requests; account approval/removal remains
  controlled by the route/service rules.
- `/api/ingredient-requests` remains an optional request workflow: Staff can
  submit/update their pending requests; Manager, Admin, and Super Admin can
  review or remove them. This does not replace Staff’s direct ingredient-create
  permission.
- `/api/change-requests` permits Staff create/update/delete and allows Staff,
  Manager, and Super Admin to list. The documented `/approve` endpoint does not
  exist; the ingredient-request review endpoint is
  `PATCH /api/ingredient-requests/:id/review`.
- Audit rows now distinguish `ChangeRequest`, `AccountRequest`, and
  `IngredientRequest` target types. Account-request writes use
  `AccountRequest`; ingredient-request writes use `IngredientRequest`.

## Verification on this branch

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed in both workspaces. |
| `RUN_MONGO_HARDENING_TESTS=false npm test --workspace server` | 68 tests: 65 passed, 3 opt-in MongoDB suites skipped, 0 failed. The six `ias1-validation` tests passed. |
| `npm test --workspace client` | 7 tests passed across 3 files. |

The raw VAPT artifacts beside this file are historical evidence generated on
24 September 2026 against baseline `4075124`. They remain useful evidence of
those requests and responses, but they are not a claim that the current
`34de09c` route set or deployment was tested live. Their metadata now states
that limitation explicitly.

## Claims revised from the original IAS1 record

1. The baseline changed from `4075124` to `34de09c`.
2. The current system has account-request, ingredient-request, and
   change-request routes, all covered by diagnostics.
3. Staff direct ingredient creation is allowed; a request workflow is optional,
   not an approval gate for direct creation.
4. Ingredient-request review exists at `PATCH /api/ingredient-requests/:id/review`.
5. Account-request and ingredient-request audit entries no longer share the
   `ChangeRequest` target type.
6. The historical VAPT/Atlas assertions are labelled historical rather than
   presented as verification of the current revision.
