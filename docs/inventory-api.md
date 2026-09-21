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

## Inventory batches

The explicit collection is `inventoryBatches`. Startup additively provisions and
verifies `ingredient_batch_code_unique` on `(ingredientId, batchCode)` with no
partial/sparse filter, including archived batches. Batch codes are trimmed and
case-sensitive. The FEFO index orders `expirationDate`, `dateReceived`, then `_id`,
all ascending; API pagination uses that exact order.

| Endpoint | Permission | Response |
| --- | --- | --- |
| GET `/api/inventory-batches` | All four roles | `{ items, page, limit, total }` |
| GET `/api/inventory-batches/:id` | All four roles | `{ batch }`, including archived history |
| POST `/api/inventory-batches` | Inventory Manager | 201 `{ batch }` |
| PATCH `/api/inventory-batches/:id` | Inventory Manager | `{ batch }` |
| POST `/api/inventory-batches/:id/quantity-corrections` | Inventory Manager | `{ batch }` |
| DELETE `/api/inventory-batches/:id` | Inventory Manager | 204, soft archive |

List query parameters: `page` (default 1), `limit` (default 25, maximum 100),
`ingredientId`, and `includeArchived=true` (default false).

Create input example (the referenced ingredient must exist and be active):

```json
{
  "ingredientId": "0123456789abcdef01234567",
  "batchCode": "DELIVERY-001",
  "initialQuantity": "10.500",
  "unit": "kg",
  "unitCost": "125.2500",
  "dateReceived": "2026-09-22",
  "expirationDate": "2026-09-30"
}
```

`quantity` starts equal to `initialQuantity`. Both are Decimal128 at scale 3;
`unitCost` is Decimal128 at scale 4. Inputs and outputs use decimal strings, never
JSON numbers; excess precision, negatives, scientific notation, nonfinite values,
and more than 18 integer digits are rejected. Shorter fractions are zero-padded,
not rounded. Initial quantity must be positive; unitCost may be zero. Currency is
server-controlled `PHP`. The unit enum is exactly the ingredient unit enum.

Dates are validated `YYYY-MM-DD` strings representing Asia/Manila calendar dates,
not timestamps. Expiration must be strictly after receipt, including after PATCH
merges changed fields with the stored document. Responses contain `id`,
`ingredientId`, `batchCode`, `initialQuantity`, `quantity`, `unit`, `unitCost`,
`currency`, `dateReceived`, `expirationDate`, `isActive`, `version`, `createdBy`,
`createdAt`, `updatedAt`, and derived `status`. IDs are strings; timestamps are ISO
instants. Status is not stored or included in persisted mutation snapshots.

PATCH allows only `unit`, `unitCost`, `dateReceived`, and `expirationDate`, plus
required `expectedVersion`. `ingredientId`, `batchCode`, `initialQuantity`, and
currency are immutable. Generic PATCH cannot change quantity, archive state,
version, actor, or status. DELETE requires `{ "expectedVersion": 0 }`.

Quantity correction example:

```json
{
  "expectedVersion": 0,
  "correctedQuantity": "9.125",
  "approved": true,
  "reason": "Manager approved correction after recount"
}
```

The authenticated Manager approves and executes this operation directly; no
change-request row is required. The same service method is available for future
approved change-request orchestration. It requires a 1–500-character reason and
checks `0 <= correctedQuantity <= initialQuantity` with exact scaled integers.
The reason is stored on the immutable audit entry. No usage/waste endpoint or
other quantity writer is implemented in this pass.

Every mutation is transactional with a sanitized before/after audit entry;
failure to write the audit rolls back the batch. Creation uses CREATE, edits and
corrections UPDATE, and archive DEACTIVATE. Versions begin at 0 and increment on
every successful mutation. Missing/invalid expectedVersion is 400; stale writes
are 409 `VERSION_CONFLICT`. Duplicate batch identity, even after archive, is 409.
Current-version writes to archived or missing batches are 404.

Status is recomputed for each read using one settings snapshot and one current
Manila date per request: expiration before today is Expired; otherwise days
remaining <= criticalDays is Critical, <= approachingDays is Approaching Expiry,
and the rest Normal. A batch expiring today is Critical. Config changes and the
passage of time take effect without any batch write or scheduler. Unconfigured
settings use the non-persisted defaults described above.

## Verification

Run the ordinary workspace typecheck, backend/frontend tests, and production
build. Persistence tests are opt-in and use isolated collections on the configured
database (not operational records):

```powershell
npm run build --workspace server
$env:RUN_MONGO_HARDENING_TESTS = 'true'
node --env-file=server/.env --test server/tests/hardening-mongo.test.cjs server/tests/system-config.test.cjs server/tests/inventory-batches-mongo.test.cjs
Remove-Item Env:RUN_MONGO_HARDENING_TESTS
```

These tests verify raw Decimal128 storage, retained archive documents/identities,
threshold changes and Manila-midnight boundaries, FEFO ties across pages, Manager
authorization, immutable quantities, bounded corrections, concurrent writes,
singleton first-save races, and audit rollback. Test collections are removed after
verification. Shared operational collections are not modified by these tests.
