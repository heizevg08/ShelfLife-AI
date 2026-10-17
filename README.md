# ShelfLifeAI

ShelfLifeAI is a browser application built with React and Vite, with an Express API. The development runtime is Node.js 24.20.0 (`.nvmrc`; `server/package.json` requires Node 24.x).

## Local development

1. Select Node.js 24.20.0 and install dependencies from the repository root with `npm install`.
2. Put local backend settings in ignored `server/.env`; never commit credentials.
3. Start the API with `npm --prefix server run dev`.
4. Start the Vite client with `npm run client`; open `http://localhost:8081`.

## Verification

Run `npm run typecheck`, `npm test --workspace client`, `npm test --workspace server`, and `npm run build --workspace client` before delivery. The client build uses TypeScript checking and Vite.

## Deployment: Vercel client and Render API

The repository includes [`vercel.json`](vercel.json) for the React/Vite client and
[`render.yaml`](render.yaml) for the Express API. Deploy both from the repository root.

1. Create the Render web service from this repository. Its health check is `/api/health/live`.
   Set `MONGO_URI` and `CORS_ORIGINS` in Render; `CORS_ORIGINS` must contain the exact Vercel
   production origin, with no trailing slash. Render supplies `PORT`; the blueprint sets the
   production host, one trusted proxy hop, and secure cross-site refresh cookies.
2. Deploy the Vercel project with `VITE_API_URL=https://<your-render-service>.onrender.com` as a
   production environment variable. It is a public browser URL, never a secret.
3. If password recovery or email changes are required, configure the optional SMTP and
   `PASSWORD_RESET_URL` variables in Render. Use the Vercel HTTPS login URL for the reset URL.

Do not upload either `.env` file. Copy the public templates first: `client/.env.example` and
`server/.env.example`.

## Roles and data

The browser supports Super Admin, Admin, Manager, and Inventory Staff. The API remains the source for authenticated operational records and role permissions. Local credentials remain outside version control.
