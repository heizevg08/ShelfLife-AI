# Development authentication

Use Node 24 LTS. The canonical server compiles to CommonJS and always selects the
`shelflifeai` database on the cluster identified by `MONGO_URI`. It never uses the
legacy `test` database. No seed runs during server startup.

Keep configuration in ignored `server/.env`, using `server/.env.example` as the
field reference. Never put server secrets in Expo public variables.

- `JWT_SECRET`: independently generated secret of at least 32 random bytes,
  represented as hex or Base64. The server checks a minimum of 32 UTF-8 bytes;
  that check cannot establish randomness.
- `DEV_ADMIN_EMAIL`: email with exactly the `shelflife.com` domain.
- `DEV_ADMIN_FIRST_NAME`, `DEV_ADMIN_LAST_NAME`: nonempty names, up to 100 characters.
- `DEV_ADMIN_PASSWORD`: unique password of at least 12 characters and at most
  1,024 UTF-8 bytes. Passwords are never trimmed or lowercased.
- `CORS_ORIGINS`: exact browser origins, for example `http://localhost:8081`.
  An empty value permits no cross-origin browser access.

From the repository root, explicitly create the initial development account:

```sh
npm --prefix server run seed:dev-admin
```

The command requires development mode, creates a unique email index and one
hashed Super Admin account if absent, and leaves an existing account unchanged,
including its password, role, timestamps, and inactive state. Re-running it is
safe. Remove the `DEV_ADMIN_*` values after seeding if no longer needed. A seed
configuration change is not an account update or password reset.

Start the backend with `npm --prefix server run dev` and Expo with `npm run client`.
Use an origin allowed by CORS. The client defaults to the local backend on port
5000; `EXPO_PUBLIC_API_URL` may specify a different API origin (never a secret).

`POST /api/auth/login` accepts `{ email, password }` and returns
`{ message: "Login successful", accessToken, user }`. Safe user fields are
`id`, derived `name`, `email`, `role`, and `isActive`. `GET /api/auth/me` requires
`Authorization: Bearer <accessToken>` and returns `{ user }` with the same fields.
Failures use the canonical `{ error: { message } }` envelope.

JWTs use HS256, a 15-minute lifetime, issuer `shelflifeai`, audience
`shelflifeai-client`, and a user-ID subject. Each authenticated request reads the
current user; inactive, missing, invalid-domain, or invalid-role users are rejected.
Passwords use salted scrypt (N=131072, r=8, p=1). No plaintext fallback exists.

The client stores only the access token in browser tab session storage, with a
memory fallback; native sessions are memory-only. User identity comes from
`/api/auth/me`. Logout clears client state; it does not revoke a copied token,
which can remain valid until expiration. Session storage is accessible to scripts
on the same origin, so this is a development session boundary, not an XSS defense.

Role-based navigation is not API authorization. Backend account and ingredient
routes have authentication and role guards. Persistent login uses rotating,
hashed refresh tokens in an HttpOnly cookie. MFA and production secret management
remain separate work. Use HTTPS outside local development.

## Backend hardening

From the repository root, after configuring `server/.env`:

```sh
npm run maintenance:harden --workspace server
npm test --workspace server
npm run server
```

The maintenance command is idempotent. It explicitly creates/verifies the
case-insensitive unique ingredient-name index (English collation, strength 2)
and the login-attempt TTL index. It never drops unrelated indexes or deletes
conflicting ingredient records. Duplicate names or conflicting indexes stop
provisioning and need investigation. Startup provisions these indexes before
listening too, despite automatic Mongoose index/collection creation being disabled.

The command also migrates legacy `Manager` accounts to `Inventory Manager` in a
transaction, invalidates their existing access/refresh sessions and pending reset
tokens, and records sanitized before/after snapshots as a System audit event.
Canonical role strings are `Inventory Staff`, `Inventory Manager`, `Admin`, and
`Super Admin`. New writes reject `Manager`. Ingredient privileges now follow the brief;
ingredient reads permit all four roles, creation permits Inventory Manager and Inventory Staff, and update/removal permits Inventory Manager only. Removal is the existing permanent DELETE operation, not a soft archive. Run maintenance before starting this revision
against any database containing the old role.

**Client transition:** the Vite frontend now uses canonical role names and the ingredient permissions above.

Login allows five failed attempts per normalized email/socket-IP pair in a
15-minute fixed window. The sixth returns HTTP 429 and `Retry-After`, including
when the supplied password is correct. Success before lockout clears that pair's
counter. Expiry permits login again. Concurrent password checks reserve slots;
only credential failures retain them. Infrastructure errors release their slots.
Counters persist in MongoDB `loginAttempts`, with SHA-256 pair identifiers and a
TTL index; email/IP values and passwords are not stored in these records. Expiry
is checked during login, independently of asynchronous TTL cleanup. Express does
not trust forwarded IP headers; deployments behind a reverse proxy currently
use the proxy socket IP and need an explicit trusted-proxy configuration before
relying on end-user IP separation.

Audit records now expose `oldValue` and `newValue` for account lifecycle changes
and ingredient CREATE/UPDATE/DELETE. Creation has a null old value; deletion has a
null new value. Historical records without snapshots return null, not reconstructed
history. Mutation and audit insertion share a MongoDB transaction (replica set or
Atlas required). Snapshot allowlists omit credentials, hashes and reset tokens.
`targetType` accepts User, Ingredient, InventoryBatch, UsageRecord, WasteRecord,
AuditRecord, ChangeRequest, Alert, Forecast and SystemConfig. Future writers must
add a safe snapshot allowlist before exposing their fields. System migrations use
`actorType: System` and null `userId`; normal writes require the authenticated user.

Ingredient schema and request validators share these exact controlled lists:
- Categories: Dairy, Produce, Bakery, Pantry, Meat, Seafood, Frozen, Beverages, Other.
- Units: kg, g, L, mL, pcs, pack, box, bottle, can, tray.

The optional MongoDB integration test creates and removes only randomly named
`hardening_test_*` collections. Run from the repository root in PowerShell:

```powershell
npm run build --workspace server
$env:RUN_MONGO_HARDENING_TESTS = 'true'
node --env-file=server/.env --test server/tests/hardening-mongo.test.cjs
Remove-Item Env:RUN_MONGO_HARDENING_TESTS
```
