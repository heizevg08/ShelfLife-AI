# Implemented backend endpoints

Verified from `server/src/app.ts` and `server/src/routes/*.ts`, 23 September 2026.
30 explicit method/path combinations. Base URL locally: `http://localhost:5000`.
Production server composition mounts all listed services. No public registration,
emergency override, usage/waste recording, change-request, alert, forecast, or
report-generation endpoint exists.

Roles: **SA** = Super Admin; **A** = Admin; **M** = Inventory Manager;
**S** = Inventory Staff; **All** = all four active authenticated roles.
Protected routes verify the bearer JWT and current account state, not just the
role claimed by a client. Public means no bearer JWT is required, not unrestricted
access to protected data.

| Method | Path | Required role / credential | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health/live` | Public | Process liveness. |
| GET | `/api/health/ready` | Public | Database readiness (200/503). |
| POST | `/api/auth/login` | Public; valid account email/password | Issue access JWT; optional remembered-session cookie; login failure limiter. |
| POST | `/api/auth/refresh` | Valid refresh cookie + allowed Origin | Rotate refresh token and issue access JWT; validates current account. |
| POST | `/api/auth/logout` | Allowed Origin; refresh cookie if present | Revoke presented refresh session and clear cookie (204). |
| GET | `/api/auth/password-reset/availability` | Public | Report whether email recovery is configured. |
| POST | `/api/auth/password-reset/request` | Public | Request email recovery; generic response; delivery must be configured. |
| POST | `/api/auth/password-reset/complete` | Valid single-use reset token | Set new password and revoke prior credentials by authVersion. |
| GET | `/api/auth/me` | All | Return current authenticated account. |
| GET | `/api/users` | SA, A | Paginated account directory; A sees only M/S accounts. |
| GET | `/api/users/summary` | SA, A | Account counts; A counts only managed M/S roles. |
| GET | `/api/users/:id` | SA, A; target restrictions below | Read an account. |
| POST | `/api/users` | SA, A; assignable-role restrictions below | Create account with hashed password and transactional audit. |
| PATCH | `/api/users/:id` | SA, A; target restrictions below | Update permitted account fields and audit. |
| POST | `/api/users/:id/deactivate` | SA, A; target restrictions below | Deactivate account and revoke credentials; audit when changed. |
| POST | `/api/users/:id/reactivate` | SA, A; target restrictions below | Reactivate account; audit when changed. |
| GET | `/api/dashboard/summary` | SA | System-wide account summary. |
| GET | `/api/audit-records` | SA, A | Paginated/filterable audit records (not actor-role scoped). |
| GET | `/api/ingredients` | All | Paginated ingredient list; optional archived records. |
| POST | `/api/ingredients` | M, S | Create ingredient directly; transactional audit. |
| PATCH | `/api/ingredients/:id` | M | Update permitted fields with required expectedVersion. |
| DELETE | `/api/ingredients/:id` | M | Soft archive with required expectedVersion; never physical deletion. |
| GET | `/api/inventory-batches` | All | Paginated FEFO list with current Manila-date status. |
| GET | `/api/inventory-batches/:id` | All | Read batch with dynamically computed status. |
| POST | `/api/inventory-batches` | M | Create batch against active ingredient; transactional audit. |
| PATCH | `/api/inventory-batches/:id` | M | Edit allowed non-quantity fields with expectedVersion. |
| POST | `/api/inventory-batches/:id/quantity-corrections` | M | Direct approved quantity correction; reason, approved=true, and expectedVersion required. |
| DELETE | `/api/inventory-batches/:id` | M | Soft archive batch with expectedVersion. |
| GET | `/api/system-config` | All | Read singleton settings or non-persisted defaults. |
| PATCH | `/api/system-config` | SA | Save permitted settings with expectedVersion and transactional audit. |

## Account target restrictions and HTTP behavior

- SA may read all accounts but may create/manage only A/M/S accounts.
- A may read/create/manage only M/S accounts. Self-edit/lifecycle changes are
  prohibited; neither role can assign Super Admin through these APIs.
- Account lifecycle calls accept no fields. Ingredient/batch archive calls use a
  JSON body containing expectedVersion. Stale versions return 409.
- Account/audit pagination uses `{items,page,pageSize,total}`. Ingredient/batch
  pagination uses `{items,page,limit,total}`.
- Express implicitly serves **HEAD** for every listed GET with the same guards
  and no response body. CORS middleware handles **OPTIONS** preflight globally;
  it does not grant authorization to the subsequent application request.
- Unknown routes and unsupported methods fall through to 404. There is no PUT
  update route or ingredient `GET /:id` route.

## Part 1 security hardening

Helmet is installed before CORS and routing: HSTS
`max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`, `nosniff`, and
an API-only CSP (`default-src 'none'; base-uri 'none'; frame-ancestors 'none';
form-action 'none'`). These are **Express API response headers**. The separately
hosted Vite HTML/PWA needs its own hosting headers; this does not configure TLS
or add a frontend hosting policy. HSTS takes effect when received over HTTPS.

`express-mongo-sanitize` is used by the request-security middleware through its
recursive `has` detector. Requests with `$`-prefixed or dotted object keys are
rejected with 400, including nested keys; data is not silently stripped. Ordinary
string values containing `$` or dots, including passwords, are unchanged. This
avoids the package default middleware's assignment to Express 5's read-only
`req.query`. Existing per-route authorization still precedes protected-write JSON
parsing; the 100 KB body limit and schema validators remain in place.

## Atlas privilege observation (read-only)

The configured connection to database `shelflifeai` reported role **atlasAdmin**
on `admin` through `connectionStatus` on 23 September 2026. Its effective
privileges include database-wide `dropDatabase`, `dropCollection`, and broad
cluster administration. This is substantially broader than this application needs.
No database role or application account was changed.

A narrower built-in starting point is `readWrite` restricted to `shelflifeai`
and the relevant cluster, not `readWriteAnyDatabase` or `atlasAdmin`. It still
includes destructive collection privileges, so it is not the strict minimum.
A custom role should allow only required operations on `users`, `ingredients`,
`inventoryBatches`, `systemConfig`, `auditRecords`, `authSessions`, and
`loginAttempts`: read/insert/update as used by each store; remove only for session
revocation/counter cleanup; audit read/insert without update/remove. Current startup
also needs createCollection/createIndex/listIndexes for explicit provisioning.
Those provisioning permissions can be separated into a maintenance credential
after changing the startup workflow; do not remove them from this runtime user
without accounting for existing startup calls. No cluster-wide administration,
user/role management, cross-database access, or dropDatabase is required.

References: [Helmet](https://helmetjs.github.io/),
[express-mongo-sanitize](https://github.com/fiznool/express-mongo-sanitize),
[MongoDB built-in roles](https://www.mongodb.com/docs/manual/reference/built-in-roles/).
