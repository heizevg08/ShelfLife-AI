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

Role-based navigation is not API authorization. RBAC, account management,
refresh/revocation, rate limiting, lockout, MFA and production secret management
remain separate milestones. Use HTTPS outside local development.
