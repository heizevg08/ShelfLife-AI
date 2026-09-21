# Inventory backend contract

All endpoints require the existing Bearer access token and return `Cache-Control:
no-store`. IDs are normalized strings, never raw `_id`. Errors use the existing
`{ error: { code, message, details } }` envelope. No InventoryBatch UI is included.

## System configuration

`GET /api/system-config` permits all four roles. With no configured document it
returns `{ approachingDays: 7, criticalDays: 2, lowStockMultiplier: "1.000",
version: 0 }` without persisting defaults. `PATCH /api/system-config` permits only
Super Admin and accepts `expectedVersion` plus one or more settings.

The explicit `systemConfig` collection uses one fixed ObjectId. Each successful
save increments version (first persisted version is 1) and writes a transactional
CREATE/UPDATE audit snapshot. Thresholds are integer days, 0 through 36500, with
`criticalDays <= approachingDays`. `lowStockMultiplier` is a nonnegative Decimal128
with three decimal places, exposed as a decimal string. No settings UI is wired.

## Ingredient contract transition

`GET /api/ingredients?page=1&limit=25` returns `{ items, page, limit, total }`.
`pageSize` is no longer accepted. `includeArchived=true` permits historical lookup.
`POST` permissions are unchanged (Manager and Staff); reads permit all four roles.

Manager-only `PATCH /api/ingredients/:id` replaces PUT and accepts
`{ expectedVersion, ...changedFields }`. Omitted fields are preserved. Manager-only
`DELETE /api/ingredients/:id` accepts JSON `{ expectedVersion }` and soft-archives.
Each ingredient response includes `version`, starting at 0; old documents without
the field are treated as version 0. Successful changes increment it atomically
with their audit snapshots. Stale updates/archives return 409 `VERSION_CONFLICT`;
missing/invalid expectedVersion returns 400. Current-version attempts to modify
an archived record return 404. Archived names remain reserved.

The frontend ingredient service maps `limit` to the existing pagination widget's
`pageSize` and sends the selected record's version. No silent conflict retries occur.

## Verification

Run the ordinary workspace typecheck, backend/frontend tests, and production
build. Persistence tests are opt-in and use isolated collections on the configured
database (not operational records):

```powershell
npm run build --workspace server
$env:RUN_MONGO_HARDENING_TESTS = 'true'
node --env-file=server/.env --test server/tests/hardening-mongo.test.cjs server/tests/system-config.test.cjs
Remove-Item Env:RUN_MONGO_HARDENING_TESTS
```
