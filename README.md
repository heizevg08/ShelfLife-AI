# ShelfLifeAI

ShelfLifeAI is a browser application built with React and Vite, with an Express API. The development runtime is Node.js 24.20.0 (`.nvmrc`; `server/package.json` requires Node 24.x).

## Local development

1. Select Node.js 24.20.0 and install dependencies from the repository root with `npm install`.
2. Put local backend settings in ignored `server/.env`; never commit credentials.
3. Start the API with `npm --prefix server run dev`.
4. Start the Vite client with `npm run client`; open `http://localhost:8081`.

## Verification

Run `npm run typecheck`, `npm test --workspace client`, `npm test --workspace server`, and `npm run build --workspace client` before delivery. The client build uses TypeScript checking and Vite.

## Roles and data

The browser supports Super Admin, Admin, Manager, and Inventory Staff. The API remains the source for authenticated operational records and role permissions. Local credentials remain outside version control.
