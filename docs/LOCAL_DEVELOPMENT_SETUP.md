# ShelfLifeAI — Local Development Setup Guide

This guide provides reproducible instructions for running ShelfLifeAI locally across Windows, macOS, and Linux.

---

## 1. System Prerequisites

| Prerequisite | Required Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `24.x` LTS (v24.20.0+ recommended) | Enforced by `server/package.json` engines |
| **npm** | `11.x`+ | Workspace dependency management |
| **MongoDB** | `7.x` or `8.x` (Community Edition or Docker) | Primary document store |
| **Python** *(Optional)* | `3.14.7` | Required only if running local ML demand forecasting |

> [!IMPORTANT]
> **Database Isolation:** Every developer must configure and use an isolated local development database (e.g., `shelflifeai_dev`). **Never connect to, seed, or test against the shared production MongoDB Atlas cluster during local development.**

---

## 2. Clone & Install Dependencies

From the repository root, install dependencies for all workspace packages (`client` and `server`):

```bash
npm ci --include=dev
```

---

## 3. Environment Configuration (`server/.env`)

Create `server/.env` by copying the provided example template:

```bash
# Linux / macOS
cp server/.env.example server/.env

# Windows (PowerShell)
Copy-Item server/.env.example server/.env
```

Edit `server/.env` with your local settings. A typical local configuration looks like:

```ini
# Application Environment
NODE_ENV=development
HOST=127.0.0.1
PORT=5000

# Isolated Local MongoDB Configuration
MONGO_URI=mongodb://127.0.0.1:27017/shelflifeai_dev
MONGO_DB_NAME=shelflifeai_dev

# JWT Authentication Secret (must be at least 32 characters)
JWT_SECRET=local-development-secret-key-at-least-32-chars-long

# CORS & Cookie Configuration
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=false
COOKIE_SAME_SITE=lax

# Optional: Local ML Worker Configuration (leave blank for Degraded ML Mode)
ML_PYTHON_EXECUTABLE=
ML_WORKER_SCRIPT=
ML_STARTUP_TIMEOUT_MS=10000
ML_INFERENCE_TIMEOUT_MS=5000

# Optional: SMTP Delivery Configuration (leave blank to skip outbound mail)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=no-reply@shelflifeai.local
SMTP_FROM_NAME=ShelfLife AI Local
PASSWORD_RESET_URL=http://localhost:5173/ShelfLifeAILogin
```

---

## 4. Database Initialization & Seeding

Ensure your local MongoDB daemon is running on `127.0.0.1:27017`.

To provision the default development administrator account (`admin@shelflife.com` / `admin123!`), run:

```bash
npm run seed:dev-admin --workspace server
```

The script connects strictly to the database specified by `MONGO_DB_NAME` and asserts that the connection matches `config.mongoDbName`, guaranteeing no external databases are touched.

---

## 5. Running the Application

### Option A: Running Frontend and Backend Concurrently (Separate Terminals)

**Terminal 1 — Backend (Express API on `http://127.0.0.1:5000`):**
```bash
# With hot-reloading via tsx:
npm run dev --workspace server

# Or run the compiled production build:
npm run build --workspace server
npm run server
```

**Terminal 2 — Frontend (Vite Dev Server on `http://localhost:5173`):**
```bash
npm run client
```

### Option B: Degraded ML Mode vs. Live ML Mode
- **Degraded ML Mode (Default):** When `ML_PYTHON_EXECUTABLE` and `ML_WORKER_SCRIPT` are left blank, the Express server boots cleanly. All authentication, RBAC, inventory management, stock-in, usage, waste, change requests, reports, and administrative audit endpoints operate normally. Endpoints under `/api/ingredients/:id/forecast`, `/risk`, and `/recommendations` truthfully return HTTP `503 Service Unavailable`.
- **Live ML Mode:** When both environment variables are set to valid executables and scripts, the backend spawns the persistent inference worker on startup and serves live consumption forecasts.

---

## 6. Optional: Local Python ML Forecasting Setup

If you need to test the frozen Random Forest inference worker locally:

### 1. Prerequisites
- **CPython `3.14.7`** (exact version required by [`ml/models/selected_random_forest_metadata.json`](../ml/models/selected_random_forest_metadata.json)).
- Scientific package wheels matching [`ml/requirements-runtime.txt`](../ml/requirements-runtime.txt):
  - `numpy==2.5.3`
  - `scikit-learn==1.9.1`
  - `joblib==1.6.0`
  - `pandas==3.0.6`

### 2. Setting Up the Virtual Environment

**Using `uv` (Recommended — fast, automated standalone Python 3.14.7 download):**
```bash
# Install uv standalone installer if not present:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment with Python 3.14.7:
uv venv ml/.venv --python 3.14.7
uv pip install --python ml/.venv/bin/python -r ml/requirements-runtime.txt
```

**Using Standard Python 3.14.7:**
```bash
# Linux / macOS:
python3.14 -m venv ml/.venv
./ml/.venv/bin/pip install -r ml/requirements-runtime.txt

# Windows (PowerShell):
py -3.14 -m venv ml\.venv
.\ml\.venv\Scripts\pip install -r ml\requirements-runtime.txt
```

### 3. Updating `server/.env`
Set the relative worker paths in `server/.env`:

```ini
# Linux / macOS:
ML_PYTHON_EXECUTABLE=ml/.venv/bin/python
ML_WORKER_SCRIPT=ml/src/10_persistent_inference_worker.py

# Windows:
ML_PYTHON_EXECUTABLE=ml\.venv\Scripts\python.exe
ML_WORKER_SCRIPT=ml/src/10_persistent_inference_worker.py
```

*Note: Relative paths resolve automatically from the repository root or `server/` directory, avoiding path errors when directory names contain spaces.*

---

## 7. Verification & Testing

Run the test suite offline without contacting external services:

```bash
# 1. Typecheck both workspaces
npm run typecheck

# 2. Build backend and frontend
npm run build --workspace server
npm run build --workspace client

# 3. Server unit tests (177 tests)
npm run test --workspace server

# 4. Server integration tests (13 tests against in-memory replica set)
npm run test:integration --workspace server

# 5. ML unit & contract tests (from repo root)
python -B -m unittest discover -s ml/tests -p "test_*.py"
```

---

## 8. Common Troubleshooting

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| `Invalid configuration: PORT` or `MONGO_URI` | Missing or invalid key in `server/.env`. | Ensure `server/.env` is populated correctly and variables contain no trailing spaces or quotes. |
| `Invalid configuration: ML_WORKER_SCRIPT` | Path contains spaces. | Use relative path `ml/src/10_persistent_inference_worker.py` instead of an absolute path. |
| `ECONNREFUSED 127.0.0.1:27017` | Local MongoDB is not running. | Start your local MongoDB service (`mongod` or Docker container). |
| `Forecast worker startup failed: ... metadata failed` | Python version is not `3.14.7` or packages mismatch. | Install exact dependencies from `ml/requirements-runtime.txt` under CPython `3.14.7`. |
| `403 Forbidden` on admin routes | Account does not hold required RBAC role. | Verify logged-in account role in `users` collection (`Admin`, `Manager`, or `Super Admin`). |

---

## 9. Established Business Logic & Architectural Rules

ShelfLifeAI implements strict domain and governance boundaries across inventory, security, and machine learning:

### 1. Advisory ML Consumption Forecasting
- **Rule:** ML forecasts predict demand/consumption and never automatically mutate inventory balances.
- **Implementation:** [`operational-forecast.ts`](../server/src/services/operational-forecast.ts) queries usage history and runs inference through [`forecast-inference-worker.ts`](../server/src/services/forecast-inference-worker.ts), returning read-only JSON predictions.
- **Reason:** ML models are probabilistic estimators derived from historical consumption patterns; they lack physical authority to deduct real stock without human verification.
- **Operational Benefit:** Prevents silent inventory drift, unauthorized ledger discrepancies, and automated stockouts.
- **Limitation:** Deducting stock requires physical staff action via Stock-In, Usage, or Waste forms.

### 2. Actual Batch Data for Expiry and Shortage Risk
- **Rule:** Expiry and shortage calculations must evaluate physical inventory batches rather than aggregate stock levels.
- **Implementation:** [`operational-risk.ts`](../server/src/services/operational-risk.ts) joins active batches from `InventoryBatch` with predicted demand through [`inventory-risk.ts`](../server/src/services/inventory-risk.ts), simulating FEFO depletion against batch-specific expiration dates.
- **Reason:** Two batches with identical quantities carry completely different spoilage risks if one expires in 2 days and the other in 30 days.
- **Operational Benefit:** Accurately flags expiring surplus and imminent stockouts before spoilage occurs.
- **Limitation:** Depends strictly on truthful batch date and quantity logging by staff.

### 3. Advisory Operational Recommendations
- **Rule:** System recommendations are non-binding decision-support aids for managers.
- **Implementation:** [`operational-recommendations.ts`](../server/src/services/operational-recommendations.ts) derives human-readable guidance (`recommendations` and `notes`) from risk evaluations.
- **Reason:** Restaurant operations involve external factors (vendor lead times, menu specials, supplier stockouts) outside the model boundary.
- **Operational Benefit:** Guides managerial review without removing human discretion.
- **Limitation:** Does not generate automated purchase orders or supplier dispatches.

### 4. Attributable Audit Records for Operational Actions
- **Rule:** Every independent auditable business action must record an attributable, immutable audit log.
- **Implementation:** Mongoose model [`audit-record.ts`](../server/src/models/audit-record.ts) marks fields `immutable: true` with `strict: 'throw'`, storing actor ID, name, role, action, module, target, and timestamp.
- **Reason:** Regulatory food-safety compliance and organizational governance require knowing who performed each stock movement or administrative modification.
- **Operational Benefit:** Provides an unalterable chronological audit trail for administrative review.
- **Limitation:** Audit logs are strictly append-only; records cannot be updated or deleted by users.

### 5. Two-Event Change Request Approvals
- **Rule:** Approving a change request generates two distinct audit records within a single transaction.
- **Implementation:** [`change-requests.ts`](../server/src/services/change-requests.ts) writes one record for the target master-data mutation (`module: 'Ingredients'`) and a second record for the administrative approval decision (`module: 'Change Requests'`).
- **Reason:** The master-data modification and the governance approval are distinct business events that must be traceable in their respective domain logs.
- **Operational Benefit:** Ingredient audit history shows the price/threshold change, while change-request audit history records the managerial decision.
- **Limitation:** The audit log contains two entries with identical or adjacent timestamps for one user action.

### 6. Deterministic Chronological Audit Pagination
- **Rule:** Audit record retrieval must use deterministic chronological sorting.
- **Implementation:** [`administration-store.ts`](../server/src/services/administration-store.ts) queries sort by `{ timestamp: -1, _id: -1 }`.
- **Reason:** High-volume or transactional operations insert multiple documents within the same millisecond; sorting on timestamp alone yields non-deterministic ordering across paginated requests.
- **Operational Benefit:** Eliminates duplicate or missing records when browsing or exporting paginated audit history.
- **Limitation:** Requires a compound index on `{ timestamp: -1, _id: -1 }` for optimal query execution.

### 7. Strict Database Isolation for Local Development
- **Rule:** Local development and testing must remain completely isolated from shared Atlas operational data.
- **Implementation:** [`env.ts`](../server/src/config/env.ts) and [`database.ts`](../server/src/config/database.ts) support `MONGO_DB_NAME` (defaulting to `shelflifeai`), allowing local overrides such as `shelflifeai_dev`.
- **Reason:** Running automated or exploratory tests against shared databases pollutes audit history, invalidates login rate-limiters, and risks accidental data destruction.
- **Operational Benefit:** Developers can test, reset, and seed local databases without affecting teammates or production.
- **Limitation:** Developers must maintain their own local database instances and seed accounts.

### 8. Frozen ML Artifacts, Versions, and Feature Contracts
- **Rule:** The Random Forest model artifact, software dependencies, and 6-feature input schema are frozen.
- **Implementation:** [`09_selected_model_inference.py`](../ml/src/09_selected_model_inference.py) verifies the exact 6 features (`lag_1`, `lag_7`, `lag_14`, `rolling_mean_7`, `rolling_mean_14`, `day_of_week`) and asserts exact dependency versions (`python == "3.14.7"`, `scikit_learn == "1.9.1"`, `joblib == "1.6.0"`, `numpy == "2.5.3"`).
- **Reason:** Deserializing `joblib` tree structures across different scikit-learn or Python versions risks silent numerical inaccuracies, altered prediction boundaries, or process crashes (`cross_version_loading_assumed_safe: false`).
- **Operational Benefit:** Guarantees identical numerical predictions across local development, CI, and deployment environments.
- **Limitation:** Python runtime upgrades require retrained model artifacts and updated metadata contracts.
