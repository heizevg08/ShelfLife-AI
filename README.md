# ShelfLife AI

Expo SDK 57 web client and an Express/Mongoose API, managed with npm workspaces.
Run commands below from `C:\Final_Project\ShelfLife-AI` unless noted otherwise.

## Requirements

- Node.js 24.x and npm. `.nvmrc` records 24.20.0; a newer Node 24 patch also satisfies the backend's engine requirement.
- A reachable MongoDB database. Account administration uses transactions, so use MongoDB Atlas or a replica set for those operations.

## First-time setup

```powershell
npm install
```

Install from the repository root so npm installs both workspaces and uses the root `package-lock.json`.

If `server/.env` does not already exist:

```powershell
Copy-Item server/.env.example server/.env
```

Fill in `MONGO_URI` and `JWT_SECRET` locally. For the default web setup, use:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=5000
CORS_ORIGINS=http://localhost:8081
```

Generate a JWT secret and paste it into `server/.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Do not commit `.env` or put server secrets in Expo public variables.
The API always selects the `shelflifeai` database.

To create the initial development account, fill in `DEV_ADMIN_EMAIL`,
`DEV_ADMIN_FIRST_NAME`, `DEV_ADMIN_LAST_NAME`, and `DEV_ADMIN_PASSWORD` in
`server/.env`, then run:

```powershell
npm --prefix server run seed:dev-admin
```

The email must use the `shelflife.com` domain and the password must be at least
12 characters. Seeding leaves an existing account unchanged, including its password.
Email recovery settings are optional for normal login.

## Run locally: two terminals

Terminal 1 (API, automatically reloads source changes and reads `server/.env`):

```powershell
npm run server
```

Terminal 2 (Expo web client):

```powershell
npm run client
```

Open http://localhost:8081 and keep both terminals running. Ctrl+C stops each process.
`npm run dev` is an alias for the web client only; it does not start both services.
Inside `client`, `npm run dev` or `npm run web` starts the web client and `npm start`
starts the general Expo development server. Inside `server`, use `npm run dev`.

The API readiness URL is http://127.0.0.1:5000/api/health/ready; a healthy response
is `{"status":"ready"}`. Use `localhost` consistently in the browser for login and
persistent cookies. If Expo uses another port, update `CORS_ORIGINS` and restart
the API. `EXPO_PUBLIC_API_URL` can override the API origin when needed.

## Verification and compiled backend

```powershell
npm run typecheck
npm test --workspace server
npm run build:web
npm run build --workspace server
npm run start --workspace server
```

The last command runs the compiled backend and reads `server/.env`; run the build
first, and stop the development API before starting a second API on the same port.

## Common startup failures

- `'expo' is not recognized`: run `npm install` from the root; the client manifest must contain its Expo/React dependencies.
- `Cannot find module .../dist/server.js`: use `npm run server` for development, or build the server before its production-style `start` command.
- `EADDRINUSE`: another process already occupies the configured port. Check the readiness URL before starting another API; stop the existing server in its terminal if a restart is needed.
- `Invalid configuration`: check the named fields in `server/.env`.
- `database-connection` failure: check the MongoDB URI, database availability, network access, and database credentials.
- Browser CORS error: the exact frontend origin must be in `CORS_ORIGINS` (no trailing slash).

See `server/.env.example` for configuration fields. Some dashboard modules are UI
previews awaiting backend services; those placeholders do not indicate a startup failure.
