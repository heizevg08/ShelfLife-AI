# ShelfLifeAI — Group Delivery

ShelfLifeAI is a browser application built with React and Vite, with an Express API. The development runtime is Node.js 24.20.0 (`.nvmrc`; `server/package.json` requires Node 24.x).

This group delivery includes the frontend/backend baseline and the frozen ML inference implementation: the selected Random Forest consumption-forecast model, the Python inference runtime and persistent worker, pinned ML dependencies, and applicable tests. ML prediction is **decision support only** — it never autonomously changes inventory.

## Contents

- `client/` — React + Vite frontend (browser application)
- `server/` — Express + Mongoose API backend (CommonJS)
- `ml/models/selected_random_forest.joblib` — frozen selected Random Forest model artifact
- `ml/models/selected_random_forest_metadata.json` — model contract and metadata
- `ml/src/09_selected_model_inference.py` — Python inference runtime
- `ml/src/10_persistent_inference_worker.py` — Node-to-Person Python persistent worker
- `ml/tests/test_persistent_inference_worker.py` — worker protocol test
- `ml/tests/test_single_series_equivalence.py` — single-series equivalence test
- `ml/requirements-runtime.txt` — pinned ML dependencies

## Machine learning — what it does and does not do

### Random Forest forecasts ingredient consumption only

The selected Random Forest predicts a numerical perishable-product demand quantity. It **does not** classify ingredients as LOW/MEDIUM/HIGH risk, decide that an ingredient will expire, alter inventory, or execute recommendations. Keeping prediction separate from operational logic keeps the ML part measurable, testable, and explainable, and keeps human accountability intact.

Downstream inventory and expiry risk are calculated deterministically from actual batch quantities, expiry dates, minimum stock, and the forecast demand — never by the model itself. A person makes the final operational decision.

### Why the six-feature inference contract is frozen

The model was trained with exactly six features:

- `lag_1`, `lag_7`, `lag_14`
- `rolling_mean_7`, `rolling_mean_14`
- `day_of_week`

These features have calendar meaning (e.g., `lag_1` is yesterday, `lag_7` is one week ago). The persisted model expects exactly these six columns, so the contract is preserved exactly: no feature added, removed, reordered, or retrained. The model artifact and metadata are frozen.

### Missing usage dates are not automatically zero

A missing usage record does not prove zero consumption — staff may not have recorded, the establishment may have been closed, or a transaction may be omitted. ShelfLifeAI therefore:

- uses the latest **genuine contiguous** daily usage sequence;
- does **not** zero-fill missing calendar days (that would fabricate observations);
- does **not** collapse gaps (that would corrupt lag and rolling-window calendar meaning);
- returns a truthful `UNAVAILABLE` / `INSUFFICIENT_HISTORY` state when fewer than 14 consecutive daily observations exist (technical minimum for `lag_14` and `rolling_mean_14`).

Fourteen days is a feature-construction minimum, not a production-readiness claim.

### Deterministic risk and advisory recommendations

Risk calculations (projected balance, shortage quantity, coverage ratio, days of supply, projected leftover at expiry) are deterministic business logic applied to actual inventory plus the forecast. Recommendations translate objective risk quantities into advisory actions (`EXPIRED > SHORTAGE > EXPIRY > SURPLUS > HORIZON > NO_ACTION`). They **do not** autonomously change inventory; authorized people remain the final decision-makers.

## Data and mutation boundaries

### Ingredient codes

Ingredient codes are unique, immutable, and transactionally allocated. Once an ingredient exists, its code is a stable identity used by usage, batches, waste, and audit records.

### Pending/rejected Requests cannot change ingredient records

Requests (e.g. change requests, stock operations) are proposals subject to approval. Pending and rejected requests have no effect on ingredient records; only an approved, transactionally committed mutation can change ingredient state. This prevents unverified requests from corrupting inventory.

### Audit records require redaction before persistence

Audit records capture operational events and may contain user-facing data. Before persistence, audit records are redacted so that no credentials, personal data, or other sensitive material is written to the audit store.

## Demonstration data and model limitations

### Synthetic data is explicit and not real-world validation

Demonstration records are synthetic. They are generated rather than observed from genuine restaurant operations, and they **must not** be represented as real stakeholder operational history, real restaurant behavior, production-readiness evidence, stakeholder validation, or a production accuracy percentage. Synthetic records are used only for demonstration and integration testing of the completed pipeline.

### Model limitations

The persisted Random Forest is a **development model** trained on FreshRetailNet-50K (`sale_amount`), a public proxy for observed perishable-product demand — not actual restaurant ingredient consumption. Production forecasting horizon, production history threshold beyond 14 days, calibrated uncertainty, stockout-censoring treatment, and genuine restaurant operational validation remain open. The model must not be retrained or its inference contract altered as part of this delivery.

## Infrastructure notes

None required beyond the runtime environments below.

## ML backend invocation

The Express API invokes the ML runtime through a small TypeScript integration layer:

1. `POST /api/ingredients/:id/forecast` (Admin/Manager only) accepts `forecastDates` and delegates to `OperationalForecastService`.
2. `OperationalForecastService` loads the ingredient's contiguous usage history from MongoDB via `ForecastingHistoryStore`, then spawns a **persistent Python worker** (`ml/src/10_persistent_inference_worker.py`) using `ML_PYTHON_EXECUTABLE` and `ML_WORKER_SCRIPT`.
3. The worker loads and validates the frozen Random Forest artifact (`ml/models/selected_random_forest.joblib` + `ml/models/selected_random_forest_metadata.json`) once at startup, then serves JSON-lines inference requests over stdin/stdout.
4. The worker runs `ml/src/09_selected_model_inference.py` to validate the six-feature contract and generate recursive consumption forecasts.
5. `OperationalRiskService` and `OperationalRecommendationService` apply deterministic business logic to the forecast plus actual batch/expiry data — the model never mutates inventory.

ML is opt-in: set `ML_PYTHON_EXECUTABLE` and `ML_WORKER_SCRIPT` in `server/.env`. Without them, the backend starts normally and ML endpoints remain unavailable.

## Local development

1. Select Node.js 24.20.0 and install dependencies from the repository root with `npm install`.
2. Put local backend settings in ignored `server/.env`; never commit credentials. Use `server/.env.example` as the field reference (`MONGO_URI`, `JWT_SECRET` ≥ 32 bytes, `CORS_ORIGINS`, etc.).
3. Install pinned ML dependencies: `pip install -r ml/requirements-runtime.txt` (Python 3.14).
4. Start the API with `npm --prefix server run dev`.
5. Start the Vite client with `npm run client`; open `http://localhost:8081`.

## Verification

Run `npm run typecheck` (server and client workspaces), `npm test --workspace client`, `npm test --workspace server`, and `npm run build --workspace client` before delivery. The client build uses TypeScript checking and Vite.

For the ML inference path, run `python -m unittest` from `ml/tests/` (or the equivalent pytest command) against the persistent worker and single-series equivalence tests.

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

The browser supports Super Admin, Admin, Manager, and Inventory Staff. The API remains the source for authenticated operational records and role permissions. Local credentials remain outside version control; `JWT_SECRET` and `MONGO_URI` must be supplied via environment at runtime.

## Security

No credentials, `.env` files with real values, or secret-bearing commits are included in this delivery. `server/.env.example` and `client/.env.example` contain only empty placeholders; all secrets are read from the environment at runtime. Previously exposed historical credentials are outside this delivery's reachable history.
