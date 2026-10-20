# ShelfLifeAI — Capstone Technical Delivery & System Documentation

**Project Title:** ShelfLifeAI: AI-Assisted Ingredient Inventory & Perishable Food Waste Reduction System  
**Academic Level:** 3rd Year BS Information Technology Capstone  
**Target Domain:** Food-service inventory optimization and avoidable food waste mitigation  
**Repository Branch:** `feat/ml-forecast-actual-evaluation`  
**Delivery Date:** October 20, 2026  

---

## 1. Executive Summary & System Overview

ShelfLifeAI is an enterprise-grade web application tailored for commercial kitchen and food-service operations. It directly addresses the dual challenges of kitchen management: **preventing ingredient stockouts** and **eliminating avoidable food waste** resulting from expired inventory batches.

The system combines:
1. **A Modular React/Vite Frontend (PWA)** enforcing strict Role-Based Access Control (RBAC), accessible by Super Admins, Admins, Managers, and Inventory Staff.
2. **A Node.js/Express API Backend** built on MongoDB Atlas with transactional consistency, multi-factor session validation, and real-time Server-Sent Events (SSE) for audit records.
3. **A Decoupled, Frozen Machine Learning Pipeline** utilizing a tabular Random Forest Regressor running in an isolated, persistent Python subprocess to produce numerical consumption forecasts without autonomous database writes.
4. **A Truthful Forecast-versus-Actual Evaluation Engine** tracking point-in-time forecast snapshots and evaluating prediction accuracy ($\text{MAE}$, $\text{RMSE}$, $\text{WAPE}$, Accuracy Score) against physical kitchen consumption records.

---

## 2. Complete Architecture & Layer Separation

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SHELFLIFEAI ARCHITECTURE                        │
└────────────────────────────────────────────────────────────────────────┘

 [React/Vite Client] (PWA, Tailwind-Free Design System, 4 Roles)
          │
          │ HTTP / REST & Server-Sent Events (SSE)
          ▼
 [Node.js/Express API] (CommonJS, Mongoose ODM, Node 24.x)
    ├── Route Controllers & RBAC Middleware
    ├── Transactional Stores (Batches, Usage, Waste, Change Requests)
    ├── Audit Presentation & Real-Time Event Bus
    └── Forecast Evaluation & Report Workbook Engine (XLSX)
          │
          ├── MongoDB Atlas (Transactions, Sessions, Audit Logs)
          │
          └── Node-to-Python IPC (JSON-Lines Protocol over Stdin/Stdout)
                    │
                    ▼
          [Persistent Python Worker] (Python 3.14, scikit-learn)
             ├── Frozen Artifact: selected_random_forest.joblib
             ├── 6-Feature Inference Contract (Lags & Rolling Means)
             └── Numerical Consumption Predictions (\hat{y}_t)
```

### Key Architectural Tenet: Separation of Prediction from Risk Logic
$$\text{Predicted Consumption } (\hat{y}_t) \ne \text{Expiration Risk}$$

- **Machine Learning Scope:** The ML worker predicts only the numerical demand quantity for an ingredient over a future horizon. It does not classify batches as risk categories, mutate inventory levels, or place purchase orders.
- **Deterministic Business Logic:** The backend combines the predicted consumption with actual inventory batches (quantities and verified expiry dates) using First-Expired, First-Out (FEFO) logic to determine shortage dates or leftover surplus.
- **Human Decision Authority:** All ML outputs and risk insights are advisory. Human managers retain final authority on all purchase and prep decisions.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Module / Route | Super Admin | Admin | Manager | Inventory Staff | Operational Scope |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **User Management** (`/UserManagement`) | Full | Admin / Staff | Denied | Denied | Account provisioning, role assignments, status toggle |
| **Security & Activity** (`/SecurityActivity`) | Full | Denied | Denied | Denied | MFA oversight, failed login tracking, user sessions |
| **Administrative Audit** (`/AdministrativeAudit`) | Full | Full | Denied | Denied | Real-time SSE streaming of administrative mutations |
| **Ingredients Catalog** (`/Ingredients`) | Denied | Full | Denied | Denied | Master ingredient definitions, units, shelf lives |
| **Inventory Batches** (`/InventoryBatches`) | Denied | Full | Full | Read/Stock | Batch-level traceability, expiration monitoring |
| **Stock-In Recording** (`/StockIn`) | Denied | Denied | Denied | Full | Inbound stock intake with batch numbers & costs |
| **Usage & Waste Recording** (`/UsageWaste`) | Denied | Denied | Full | Full (Direct) | Daily consumption and waste write-offs with reasons |
| **Change Requests** (`/ChangeRequests`) | Denied | Denied | Review/Decide | Submit Proposals | Master data change proposal and approval workflow |
| **Forecasting & Evaluation** (`/Forecasting`) | Denied | Read | Full | Denied | ML demand forecast, actuals evaluation, accuracy KPIs |
| **Alerts & Expiration** (`/Alerts`) | Denied | Denied | Full | Denied | FEFO expiration alerts, surplus and shortage flags |
| **Download Center & Reports** (`/Reports`) | Denied | Full | Full | Denied | Excel workbook exports (Inventory, Waste, Forecasts) |

---

## 4. Machine Learning & Forecast Evaluation Pipeline

### 4.1 Frozen Feature Contract (6 Features)
The selected Random Forest model (`selected_random_forest.joblib`, sha256 `14b76d5b108...`) is strictly frozen and enforces:
1. `lag_1`: Consumption from 1 day prior ($y_{t-1}$).
2. `lag_7`: Consumption from 7 days prior ($y_{t-7}$, weekly seasonality).
3. `lag_14`: Consumption from 14 days prior ($y_{t-14}$).
4. `rolling_mean_7`: 7-day rolling average ($\frac{1}{7}\sum_{i=1}^7 y_{t-i}$).
5. `rolling_mean_14`: 14-day rolling average ($\frac{1}{14}\sum_{i=1}^{14} y_{t-i}$).
6. `day_of_week`: Day-of-week integer ($0 = \text{Monday}, \dots, 6 = \text{Sunday}$).

### 4.2 Time-Series Integrity & Gap Treatment
- **No Zero-Filling:** Unrecorded kitchen calendar days are treated as missing observations (`null`), never coerced to zero.
- **Contiguous History Rule:** A minimum of 14 consecutive daily observations (`FORECAST_TECHNICAL_MINIMUM_DAYS = 14`) is required to construct the feature matrix. If fewer than 14 contiguous days exist, the API returns `{ status: 'UNAVAILABLE', reason: 'INSUFFICIENT_HISTORY' }`.

### 4.3 Forecast Snapshot Persistence & Actuals Evaluation
- **Snapshot Persistence:** Every generation run saves immutable point-in-time predictions to the `forecastSnapshots` collection with `horizonDays`, `targetDate`, and `predictedQuantity`.
- **Accuracy Evaluation Formulation:** Completed past dates ($k \ge 7$ days) are matched against actual physical consumption in `UsageRecord`:
  - **Mean Absolute Error (MAE):**
    $$\text{MAE} = \frac{1}{k}\sum_{i=1}^k |y_i - \hat{y}_i|$$
  - **Root Mean Squared Error (RMSE):**
    $$\text{RMSE} = \sqrt{\frac{1}{k}\sum_{i=1}^k (y_i - \hat{y}_i)^2}$$
  - **Weighted Absolute Percentage Error (WAPE):**
    $$\text{WAPE} = \frac{\sum_{i=1}^k |y_i - \hat{y}_i|}{\sum_{i=1}^k y_i}$$
  - **Accuracy Score:**
    $$\text{Accuracy} = \max\left(0, (1 - \text{WAPE}) \times 100\right)$$
- **Same-Day Exclusion Rule:** The current in-progress calendar day is strictly excluded from evaluation calculations to prevent partial-day distortion.

---

## 5. System Verification & Test Coverage Summary

| Test Domain | Runner / Framework | Test Count | Status | Scope |
| :--- | :--- | :---: | :---: | :--- |
| **Client UI & Logic** | Node.js Test Runner + tsx | **276 / 276** | PASS | Form validations, date math, modal workflows, string contracts |
| **Server Integration** | Node.js Test Runner (CJS) | **189 / 189** | PASS | Express routes, MongoDB transactions, RBAC, SSE stream |
| **Machine Learning** | Python `unittest` | **14 / 14** | PASS | Python worker IPC, recursive prediction, contract validation |
| **Static Typing** | TypeScript (`tsc --noEmit`) | **0 Errors** | PASS | Clean typecheck across all workspaces (`client` and `server`) |
| **Production Build** | Vite Build (`npm run build:web`) | **0 Errors** | PASS | Complete bundle generation with Workbox PWA service worker |

---

## 6. Local Development & Deployment Guide

### Local Setup
1. **Node Runtime:** Node.js 24.20.0 (enforced via `.nvmrc`).
2. **Install Dependencies:** `npm install` from repository root.
3. **Environment Setup:** Copy `server/.env.example` to `server/.env` and supply valid `MONGO_URI` and `JWT_SECRET`.
4. **Python ML Dependencies:** `pip install -r ml/requirements-runtime.txt` (Python 3.14).
5. **Start Dev Server:** `npm run dev --workspace client` (port 8081) and `npm run start --workspace server` (port 8080).

### Cloud Deployment
- **Frontend Client:** Deployed to **Vercel** with SPA rewrites configured in [`vercel.json`](../vercel.json).
- **Backend API:** Deployed to **Render** with blueprint specification in [`render.yaml`](../render.yaml) exposing health check `/api/health/live`.
- **CORS Whitelist:** Configured via `CORS_ORIGINS` environment variable pointing to the Vercel HTTPS domain.
