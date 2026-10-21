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
- `docs/ML_EVALUATION_METHODOLOGY_AND_ARCHITECTURE.md` — academic defense reference, mathematical formulations, and forecast-vs-actual evaluation architecture
- `docs/CAPSTONE_TECHNICAL_DELIVERY_DOCUMENTATION.md` — comprehensive capstone technical delivery document and system specification

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

Demonstration records are synthetic (`SYNTHETIC_DEMO:PH_CARINDERIA_V1`). They are generated rather than observed from genuine restaurant operations, and they **must not** be represented as real stakeholder operational history, real restaurant behavior, production-readiness evidence, stakeholder validation, or a production accuracy percentage. Synthetic records are used only for demonstration and integration testing of the completed pipeline.

### Model limitations

The persisted Random Forest is a **development model** trained on FreshRetailNet-50K (`sale_amount`), a public proxy for observed perishable-product demand — not actual restaurant ingredient consumption. Production forecasting horizon, production history threshold beyond 14 days, calibrated uncertainty, stockout-censoring treatment, and genuine restaurant operational validation remain open. The model must not be retrained or its inference contract altered as part of this delivery.

## ML backend invocation & Evaluation Pipeline

The Express API invokes the ML runtime through an integrated TypeScript service layer:

1. `POST /api/ingredients/:id/forecast` (Admin/Manager only) accepts `forecastDates` and delegates to `OperationalForecastService`.
2. `OperationalForecastService` loads the ingredient's contiguous usage history from MongoDB via `ForecastingHistoryStore`, then communicates with a **persistent Python worker** (`ml/src/10_persistent_inference_worker.py`) using `ML_PYTHON_EXECUTABLE` and `ML_WORKER_SCRIPT`.
3. The worker loads and validates the frozen Random Forest artifact (`ml/models/selected_random_forest.joblib` + `ml/models/selected_random_forest_metadata.json`) once at startup, then serves JSON-lines inference requests over stdin/stdout.
4. The worker executes `ml/src/09_selected_model_inference.py` to validate the six-feature contract and generate recursive consumption forecasts.
5. Upon generating predictions, the system writes immutable point-in-time snapshots to `ForecastSnapshotStore` with `horizonDays`, `targetDate`, and `predictedQuantity`.
6. `ForecastEvaluationService` provides truth-based forecast evaluation against completed kitchen consumption (`UsageRecord`), computing MAE, RMSE, WAPE, and an Accuracy Score across past calendar days:
   - `GET /api/ingredients/:id/forecast-accuracy` — evaluates completed historical days (minimum 7 evaluated days; excludes the in-progress current day).
   - `GET /api/ingredients/:id/forecast-vs-actual` — delivers paired daily actual vs. forecast trend series for analytical charting.
7. `OperationalRiskService` and `OperationalRecommendationService` apply deterministic business logic to the forecast plus actual batch/expiry data — the model never mutates inventory.

ML is opt-in: set `ML_PYTHON_EXECUTABLE` and `ML_WORKER_SCRIPT` in `server/.env`. Without them, the backend starts normally and ML endpoints remain unavailable.

## Authentication, Account Lifecycle & Email Delivery

### Dual-Identity Email Architecture & Free-Tier Mail Delivery
- **Organizational Identity (`email`):** Corporate sign-in identifiers use the domain `@shelflife.com`.
- **Personal Delivery Address (`personalEmail`):** Because custom corporate domain routing is absent on free tiers, user accounts support an external personal email address.
- **Transactional Welcome Emails:** Account creation via `POST /api/users` mints a cryptographically secure 24-byte temporary password and immediately dispatches an onboarding email to the user's personal email address before the transaction commits.
- **Dual Password Recovery:** The password recovery modal accepts **either** the user's organization handle or their registered personal email address. If an eligible account is matched, the single-use recovery link is securely delivered to the recipient's real personal email address (`personalEmail`).
- **OWASP User Enumeration Protection:** The password recovery API deliberately returns a uniform response (`"If an eligible account exists, check its registered email for recovery instructions."`) for both registered and non-existent email inputs. This prevents malicious actors from executing account harvesting / user enumeration attacks against the organization.
- **Render Free-Tier Mail Compatibility:** Render free-tier instances block raw outbound SMTP ports (`25`, `465`, and `587`). ShelfLifeAI supports:
  1. **HTTPS Port 443 Relay:** Set `SMTP_HOST` to an HTTPS web app endpoint to deliver emails directly over HTTPS port 443 with zero third-party fees.
  2. **Alternative Port 2525:** Use providers on unblocked port `2525`.

## Local development

1. Select Node.js 24.20.0 and install dependencies from the repository root with `npm install`.
2. Configure `server/.env` using `server/.env.example` as a template (`MONGO_URI`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ACCOUNT_LOGIN_URL`, `ML_PYTHON_EXECUTABLE`, etc.).
3. Install pinned ML dependencies: `pip install -r ml/requirements-runtime.txt` (Python 3.14).
4. Run the backend and frontend in separate terminals:
   - **Backend (API + ML + Mail):** `npm run server` (listens on `http://localhost:5000`)
   - **Frontend (Vite Client):** `npm run client` (opens on `http://localhost:8081`)

## Verification

Run all test suites before delivery:
- `npm test --workspace client` — verifies React client components and routing.
- `npm test --workspace server` — verifies Express API routes, transactions, RBAC, audit streams, and SMTP/recovery adapters.
- `npm run typecheck` — validates TypeScript compilation across all workspaces.
- `python -m unittest discover -s ml/tests` — executes ML worker protocol and single-series equivalence tests.
- `npm run build:web` — generates production Vite PWA distribution.

## Deployment: Vercel client and Render API

The repository includes [`vercel.json`](vercel.json) for the React/Vite client and [`render.yaml`](render.yaml) for the Express API. Deploy both from the repository root.

1. Create the Render web service from this repository. Its health check is `/api/health/live`. Set `MONGO_URI` and `CORS_ORIGINS` in Render (`CORS_ORIGINS` must match the exact Vercel production origin with no trailing slash).
2. Configure email delivery in the Render Dashboard under **Environment**:
   - `SMTP_HOST`: Web app relay URL or alternative SMTP host.
   - `SMTP_PORT`: Port `443` (for HTTPS relay) or port `2525` (for alternative SMTP).
   - `SMTP_USER`: Sender account address.
   - `SMTP_PASS`: Configured relay secret or app password.
   - `MAIL_FROM`: Sender email address.
   - `ACCOUNT_LOGIN_URL`: Public login URL.
   - `PASSWORD_RESET_URL`: Public login URL.
3. Deploy the Vercel project with `VITE_API_URL=https://<your-render-service>.onrender.com` as a production environment variable.

## Roles and data

The application strictly implements Role-Based Access Control (RBAC) across four operational tiers: **Super Admin**, **Admin**, **Manager**, and **Inventory Staff**. Authenticated sessions use HTTP-only, SameSite cookies with versioned JWT access tokens. Local credentials remain outside version control.

## Security

No credentials, `.env` files with real values, or secret-bearing commits are included in this delivery. `server/.env.example` and `client/.env.example` contain only empty placeholders; all secrets are read from the environment at runtime.
