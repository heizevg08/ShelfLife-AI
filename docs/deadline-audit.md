# Deadline audit — 23 September 2026

## Scope and disposition

Part 1 alone changes application behavior: Helmet headers and rejection of
MongoDB operator/dotted keys. See [all implemented endpoints and Atlas privileges](implemented-endpoints.md).
Part 1 is committed independently as `af06148`. Parts 2 and 3 make no application,
account, database-permission, or RBAC changes. No production writes were performed.
Staff approval-gated ingredient creation is a **future enhancement**, deliberately
out of scope for this deadline; direct Staff creation remains permitted.

## Part 2 findings for owner triage

1. **Account display name disagrees with its role.** Read-only inspection of
   `shelflifeai.users` found `admin@shelflife.com` with `firstName: "Super"`,
   `lastName: "Admin"`, `role: "Admin"`, `isActive: true`; created 7 September,
   last updated 15 September. No matching `auditRecords` history was found.
   `server/src/services/administration-store.ts:12` composes the name from first/
   last names, so the directory displays "Super Admin". Conversely,
   `server/src/models/user.ts:24` normalizes that label to "Admin" for the auth
   response. `server/src/services/auth.ts:32` reads the current database role on
   each authenticated request. This is a misleading stored name/presentation
   inconsistency, not evidence that the current login or assignment code silently
   changes Super Admin to Admin. Historical cause cannot be proven: the current
   seed creates Super Admin but leaves existing accounts unchanged
   (`server/src/services/seed-admin.ts:5`). Do not promote the account merely to
   match its name. No account fields were changed.

2. **Ingredient frontend does not enforce text maximum lengths.**
   `client/src/components/application/ModulePage.tsx:35` inputs lack maxLength;
   its save validation at line 197 checks required values/numbers but not text
   bounds. A browser probe submitted a 101-character name to the mocked API.
   Backend `server/src/validators/ingredient.ts:18` rejects names/brands over
   100 and descriptions over 500. The server protects storage, but users wait
   for a failed request to learn the limit. Brand, description, minimum stock,
   standard unit cost, and shelf life display required stars although both the
   save handler and API permit omission.

3. **Whitespace-only account password inconsistency.**
   `client/src/components/application/AccountsTable.tsx:101` rejects values whose
   trim is empty. Backend `server/src/validators/auth.ts:8` preserves password
   bytes and only checks nonempty length/1024-byte maximum; accountInput adds a
   12-character minimum (`server/src/validators/administration.ts:77`). Twelve
   spaces therefore pass the API validator. Confirmed by a direct validator
   probe and a browser form probe. Nonempty passwords containing spaces are a
   separate case and must not be silently trimmed.

4. **InventoryBatch and systemConfig are backend-only integrations.**
   There are no frontend service calls to `/inventory-batches` or `/system-config`.
   Batch/stock-in screens remain previews in ModulePage; the General settings
   panel is read-only. Backend validation can be confirmed; an implemented,
   validating frontend for those write endpoints cannot. Staff's `/StockIn`
   preview still appears in navigation, while actual batch creation is Manager
   only. It does not send a write request or bypass authorization.

5. **Audit retry can remain stuck on an old error.** In
   `client/src/components/application/AuditTable.tsx:37`, error resets only when
   there is no previously loaded data; the successful response at line 48 does
   not clear it. Reproduced: successful load -> failed filter request -> successful
   Retry -> error still visible. No fix applied.

6. **Security settings contain nonfunctional/misleading controls.**
   `client/src/pages/workspace/SystemSettings.tsx:251` renders enabled-looking
   MFA and concurrent-session controls; lines 277 and 303 also imply account
   approval/retention policies. Lines 317-318 render enabled Discard/Save Settings
   buttons without handlers. These are not persisted settings or evidence those
   policies exist. Backend account creation activates immediately; persistent
   sessions allow multiple records; no MFA flow exists. The General panel's
   disabled save button correctly says it is unconnected, but the Security tab
   does not consistently communicate this.

7. **Account search/role/status filtering is page-local.**
   `client/src/components/application/AccountsTable.tsx:64` filters `data.items`
   after server pagination; `client/src/services/administration.ts` does not send
   those search/filter values. An account outside the loaded page can be missed.
   This is existing behavior, not a new inactive-account filter regression.

8. **Minor lifecycle body-shape gap.**
   `server/src/controllers/administration.controller.ts:6` rejects bodies only
   when Object.keys is nonempty. An empty array is accepted like an empty object
   for deactivate/reactivate. It introduces no writable fields and still goes
   through actor/target permission checks, but is less strict than other writes.

## Write validation coverage

No generic statement that "both sides validate everything" is warranted.
Dates/numbers are N/A for account writes; ingredient dates are forbidden because
they belong to batches. Unknown fields are rejected unless noted above.

| Implemented write endpoint | Backend checks | Frontend checks / gap |
| --- | --- | --- |
| `POST /api/users` | Required trimmed first/last names 1–25; organization email <=254; canonical role; password >=12 characters and <=1024 UTF-8 bytes; target-role authorization. | Same name/email/role/size checks; rejects whitespace-only password unlike backend. |
| `PATCH /api/users/:id` | Valid ID; nonempty allowlisted patch; name/email/role checks when supplied; password field forbidden; actor/target restrictions. | Shared account form validates names/email/assignable roles. |
| `POST /api/users/:id/deactivate` | Valid ID, no fields, actor/target/self restrictions, idempotent status change. | Confirmation for selected permitted account; no freeform input. Empty-array API gap above. |
| `POST /api/users/:id/reactivate` | Same lifecycle checks. | Same lifecycle behavior. |
| `POST /api/ingredients` | Name 1–100; brand <=100; description <=500; controlled category/unit; optional finite stock/cost >=0; shelf life integer >=1; no dates accepted. | Required name/category/unit and numeric range/integer checks; missing text maximums; optional-field labels misleading. |
| `PATCH /api/ingredients/:id` | Same supplied-field checks; nonempty allowlist; valid expectedVersion; stale version 409. | Shared ingredient form, same text gaps; submits loaded version. |
| `DELETE /api/ingredients/:id` | Only required nonnegative safe-integer expectedVersion; valid ID; stale version 409; soft archive. | Confirmation, no freeform input; sends loaded version. |
| `POST /api/inventory-batches` | Required active ingredient ID, batchCode 1–100; controlled unit; positive decimal-string initialQuantity (3 places), nonnegative unitCost (4 places), at most 18 integer digits; valid calendar dates and expiry after receipt. | No API-connected creation form. |
| `PATCH /api/inventory-batches/:id` | Version + nonempty allowlist of unit/cost/dates; validates merged date ordering; rejects quantity, initialQuantity, identity and unknown fields. | No API-connected edit form. |
| `POST /api/inventory-batches/:id/quantity-corrections` | Version; approved=true; reason 1–500; nonnegative 3-place decimal; service enforces corrected <= initialQuantity. | No API-connected correction form. |
| `DELETE /api/inventory-batches/:id` | Only version + valid ID; stale version 409; soft archive. | No API-connected archive form. |
| `PATCH /api/system-config` | Version + nonempty allowlist; integer days 0–36500; nonnegative 3-place decimal multiplier; service checks critical <= approaching. | No API-connected config form. Existing settings UI is not this API's editor. |

Sources: `server/src/validators/administration.ts`, `ingredient.ts`,
`inventory-batch.ts`, `inventory-contract.ts`; `server/src/services/system-config.ts`
and `inventory-batches.ts`. Seventy-three direct invalid-input probes passed for
empty/oversized fields, negative values, precision, malformed/impossible dates,
unknown fields, and versions. Cross-record conditions (correction upper bound,
merged dates, configuration threshold order) were source-reviewed; no live
database writes were used to repeat those transaction tests tonight.

## Actual RBAC result

| Operation | Super Admin | Admin | Inventory Manager | Inventory Staff |
| --- | --- | --- | --- | --- |
| Ingredient read | Yes | Yes | Yes | Yes |
| Ingredient create | No | No | Yes | Yes |
| Ingredient update/archive | No | No | Yes | No |
| Batch read | Yes | Yes | Yes | Yes |
| Batch create/update/correct/archive | No | No | Yes | No |
| Config read | Yes | Yes | Yes | Yes |
| Config write | Yes | No | No | No |
| Accounts/audit read | Yes | Restricted accounts; audit allowed | No | No |
| Account writes | A/M/S targets only | M/S targets only | No | No |

The ingredient/batch guards match the requested matrix. All 22 protected
method/path combinations were exercised over HTTP against all four real signed
JWT roles plus anonymous requests (110 checks), using stubbed services to avoid
database mutation. Existing account service tests separately cover target-role
and self-management restrictions. The eight public/credential-based endpoints
(health, login, refresh/logout, recovery) are intentionally not role-gated;
existing auth/session/recovery tests cover their credential behavior.

Admin audit access is system-wide, including permitted before/after account
snapshots. The route allows Admin and the audit service does not apply the
account-directory target-role filter. The supplied ingredient/batch matrix does
not specify a narrower audit policy, so this is disclosed scope, not an assumed
permission change. No roles or endpoint access rules were changed.

## Emergency override and frontend smoke checks

No emergency-override endpoint, approval mechanism, or frontend link exists.
Thus no role, including Super Admin, can execute it; this is **not implemented**,
not a tested Super-Admin-only override. Existing "Threshold override" preview
vocabulary is unrelated to an ingredient emergency API.

The 20 existing browser tests passed: four-role deep-link/navigation checks,
ingredient controls, account lifecycle, login/logout, recovery, mobile navigation,
and PWA shell caching. Additional temporary probes reproduced frontend validation
gaps and the later-failure audit retry bug. Five Super Admin screens were sampled
at 1440px and 390px, with no page/console errors or document-width overflow.
Desktop collapsed/expanded sidebar screenshots were checked after animations
settled; no persistent broken layout was found. The User Management screen does
repeat account-summary cards (cosmetic). Known preview/dead settings controls are
listed above. Tests use mocked APIs and are not full live-data acceptance tests.

No Part 2 behavior was fixed. Owner triage is required before follow-up changes.
