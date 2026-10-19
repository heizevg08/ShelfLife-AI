# ShelfLifeAI — Machine Learning Evaluation Methodology and Architecture

**Project:** ShelfLifeAI — AI-Assisted Ingredient Inventory & Food Waste Reduction System  
**Academic Level:** 3rd Year BS Information Technology Capstone  
**Target Domain:** Food-service inventory optimization and avoidable food waste reduction  
**Document Purpose:** Academic defense reference, methodology documentation, and technical architecture specification for the forecast-versus-actual evaluation pipeline.

---

## 1. Executive Summary

ShelfLifeAI implements machine-learning demand forecasting to solve a critical operational challenge in commercial kitchens: **predicting future ingredient consumption** to enable proactive inventory purchasing, prevent ingredient stockouts, and mitigate avoidable food waste before batch expiration.

This document formally establishes the theoretical foundations, data contracts, mathematical formulations, and system architecture governing how ShelfLifeAI forecasts ingredient demand and evaluates prediction accuracy against real-world kitchen consumption records.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        SHELFLIFEAI ARCHITECTURE                        │
└────────────────────────────────────────────────────────────────────────┘

  [Physical Usage Records] (UsageRecord)
             │
             ▼
  [Data Preparation & Validation] (14-day technical minimum)
             │
             ▼
  [Frozen Python Inference Worker] (Random Forest Regressor)
             │
             ├────────────────────────────────────────┐
             ▼                                        ▼
  [Forecast Predictions]                   [Persisted Snapshots]
   (Ephemeral Output)                       (forecastSnapshots)
             │                                        │
             ▼                                        ▼
  [Deterministic Risk Logic]                [Forecast-vs-Actual Engine]
   (FEFO, Shelf-Life, Expiration)           (UsageRecord matching)
             │                                        │
             ▼                                        ▼
  [Advisory Recommendations]                [Accuracy KPIs & Trends]
   (Order / Prep / Discount)                 (MAE, RMSE, WAPE, Trend)
             │                                        │
             ▼                                        ▼
  [Human Decision: Manager/Admin]           [Manager Intelligence UI]
```

---

## 2. Problem Formulation & Model Architecture

### 2.1 Numerical Forecasting vs. Generative AI
ShelfLifeAI deliberately implements **tabular numerical regression** rather than a Large Language Model (LLM):
- **Core ML Target:** Predict a continuous scalar quantity representing future consumption in canonical units (e.g., $18.5\text{ kg}$ of Chicken Breast) over an upcoming forecast horizon ($1$ to $30$ days).
- **Academic Justification:** LLMs are autoregressive token predictors designed for language understanding and generation. Using an LLM for time-series demand forecasting introduces non-deterministic sampling, high inference latency, massive memory footprints, hallucination risks, and unnecessary operational costs. Tabular machine learning (Random Forest) is mathematically appropriate, reproducible, lightweight, and defensible.

### 2.2 Separation of ML Prediction from Deterministic Business Logic
The machine learning model has exactly one responsibility: **predicting future ingredient consumption**. It does not compute expiration risk, does not generate inventory purchase orders, and does not automatically mutate database state:

$$\text{Predicted Consumption} \neq \text{Expiration Risk}$$

Once the ML worker outputs predicted consumption $\hat{y}_t$, deterministic backend business logic combines $\hat{y}_t$ with real-time inventory batches, unit costs, and verified batch expiration dates:
1. **Model Output:** Estimated consumption over horizon $H$.
2. **Deterministic Risk Logic:** Identifies batches where $\text{Expiration Date} \le \text{Current Date} + H$ and $\text{Batch Quantity} > \text{Predicted Consumption}$.
3. **Advisory Recommendation:** Flags surplus stock at risk of spoiling and suggests operational actions (e.g., promotional menus, recipe batching, or purchase adjustments).
4. **Human-in-the-Loop:** All recommendations are advisory; inventory managers retain final operational authority.

### 2.3 Frozen Model Specifications
- **Selected Model:** Random Forest Regressor (`ml/models/selected_random_forest.joblib`).
- **Feature Contract (6 Required Features):**
  1. `lag_1`: Consumption from 1 day prior ($y_{t-1}$).
  2. `lag_7`: Consumption from 7 days prior ($y_{t-7}$, capturing weekly seasonality).
  3. `lag_14`: Consumption from 14 days prior ($y_{t-14}$).
  4. `rolling_mean_7`: Moving average consumption over the past 7 days ($\frac{1}{7}\sum_{i=1}^7 y_{t-i}$).
  5. `rolling_mean_14`: Moving average consumption over the past 14 days ($\frac{1}{14}\sum_{i=1}^{14} y_{t-i}$).
  6. `day_of_week`: Categorical calendar day index ($0 = \text{Monday}, \dots, 6 = \text{Sunday}$).
- **Technical Minimum History Requirement:** 14 consecutive daily observations (`FORECAST_TECHNICAL_MINIMUM_DAYS = 14`). If fewer than 14 consecutive days exist, inference is withheld and returns `{ status: 'UNAVAILABLE', reason: 'INSUFFICIENT_HISTORY' }`.

---

## 3. Historical Forecast Snapshot Persistence Lifecycle

### 3.1 The Ephemeral Inference Problem
Prior to this implementation phase, forecasts executed strictly in-memory: predictions were returned over HTTP to the caller and discarded. Consequently, the backend had no record of historical predictions, preventing any quantitative comparison between past forecasts and actual consumption.

### 3.2 Data Contract: `ForecastSnapshot` Schema
To enable rigorous evaluation without altering the frozen ML model, ShelfLifeAI persists predictions as immutable historical snapshots in collection `forecastSnapshots`:

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `ingredientId` | `ObjectId` | Required, Immutable, Ref: `Ingredient` | Identifies the ingredient series |
| `generatedAt` | `Date` | Required, Immutable | Exact timestamp of forecast generation |
| `generatedDate` | `String` | Required, Immutable, `YYYY-MM-DD` | Philippine business calendar date of generation |
| `targetDate` | `String` | Required, Immutable, `YYYY-MM-DD` | Future date for which consumption was predicted |
| `horizonDays` | `Number` | Required, Immutable, $[1, 30]$ | Forecast lead time in days ($t_{\text{target}} - t_{\text{gen}}$) |
| `stepIndex` | `Number` | Required, Immutable, $[0, 29]$ | 0-indexed position within the prediction array |
| `predictedQuantity` | `Number` | Required, Immutable, $\ge 0$ | Predicted consumption in canonical ingredient unit |
| `unit` | `String` | Required, Immutable | Canonical unit of measure (e.g., `kg`, `liter`, `pcs`) |
| `modelVersion` | `String` | Required, Immutable | Pinned model artifact version (`v1.0-frozen-rf`) |
| `modelStage` | `String` | Required, Immutable | Lifecycle stage (`inference-frozen`) |
| `createdBy` | `ObjectId` | Required, Immutable, Ref: `User` | Authenticated user who initiated the forecast |
| `status` | `String` | Enum: `['ACTIVE', 'SUPERSEDED']` | Evaluation status of the snapshot |

### 3.3 Compound Unique Indexing & Daily Idempotency
To prevent duplicate records from inflating evaluation metrics when managers re-run forecasts multiple times on the same day:
- **Compound Unique Index:** `{ ingredientId: 1, generatedDate: 1, targetDate: 1 }`
- **Idempotency Rule:** Re-invoking the forecast on the same `generatedDate` for the same `targetDate` updates the prediction and timestamp in-place via atomic upsert (`findOneAndUpdate`).
- **Superseding Rule:** When a new forecast is generated on a later calendar date for an overlapping future target date, older active snapshots for that target date are transitioned to `SUPERSEDED`. This guarantees that evaluation queries evaluate the latest active prediction while preserving older multi-horizon snapshots for retrospective analysis.
- **Storage Lifecycle (TTL):** An automatic MongoDB TTL index on `generatedAt` (`expireAfterSeconds: 90 * 86400`) purges snapshots older than 90 days, ensuring free-tier Atlas database storage (512 MB limit) is never exhausted.

---

## 4. Demand Consumption Eligibility & Time Series Integrity

A fundamental flaw in naive inventory systems is equating all stock deductions with customer demand. ShelfLifeAI strictly enforces domain-aware data segregation:

### 4.1 Strict Demand Consumption Isolation Rule
- **Rule:** Only physical kitchen consumption recorded in `UsageRecord` (`quantityUsed`) qualifies as actual consumption for forecast evaluation.
- **Implementation:** `ForecastEvaluationService` joins `forecastSnapshots` exclusively against aggregated `usageRecords` by `(ingredientId, calendarDate)`.
- **Reason:** 
  - `WasteRecord` represents expired, spoiled, damaged, or over-prepared food.
  - `InventoryBatch` represents stock replenishment (supply-in).
  - Counting waste write-offs as customer demand creates a destructive positive-feedback loop: spoiled inventory would be treated as demand, driving higher future forecasts, triggering higher replenishment orders, and generating even greater food waste.
- **Operational Benefit:** Preserves pure customer demand time series, preventing runaway over-ordering.
- **Limitation:** Incomplete logging by staff cannot be synthesized; missing dates remain unobserved gaps.
- **Verification:** Unit tests confirm mixed stock-in, waste, and usage datasets accumulate only `UsageRecord.quantityUsed`.

### 4.2 Gap & Missing Day Semantics
In commercial kitchens, a date without a recorded usage log can mean one of two things:
1. The establishment was closed (or zero of that ingredient was used).
2. Kitchen staff forgot to record consumption.

Assuming unrecorded days represent zero consumption would drag rolling averages and evaluation metrics downward, creating false accuracy spikes or false demand drops.

**ShelfLifeAI Rule:** Missing days are treated as **unobserved observations (`null`)**, never assumed as zero. A zero value is plotted or evaluated **only** when an explicit `UsageRecord` with `quantityUsed: 0` is confirmed. In the UI, gaps break the trend line with an explanatory note rather than dropping falsely to the baseline.

---

## 5. Evaluation Metrics & Mathematical Formulations

ShelfLifeAI implements three primary academic time-series evaluation metrics, computed across $k$ matched pairs where both predicted consumption $\hat{y}_t$ and actual consumption $y_t$ exist for completed calendar dates $t \in \{1, \dots, k\}$:

### 5.1 Mean Absolute Error (MAE)
$$\text{MAE} = \frac{1}{k}\sum_{t=1}^{k} |y_t - \hat{y}_t|$$
- **Units:** Expressed in the ingredient's canonical physical unit (e.g., kilograms, liters).
- **Academic Properties:** Represents the average expected magnitude of forecast error. Unlike percentage metrics, MAE is mathematically immune to division-by-zero errors when consumption is low or zero.
- **Operational Interpretation:** "On average, the daily forecast was off by $1.86\text{ kg}$."

### 5.2 Root Mean Squared Error (RMSE)
$$\text{RMSE} = \sqrt{\frac{1}{k}\sum_{t=1}^{k} (y_t - \hat{y}_t)^2}$$
- **Units:** Expressed in canonical physical units.
- **Academic Properties:** By squaring errors before taking the root, RMSE penalizes large individual forecast misses more heavily than small errors.
- **Operational Interpretation:** Useful for identifying demand volatility and operational risk: large spikes that caused kitchen shortages or emergency re-orders will significantly increase RMSE relative to MAE ($\text{RMSE} \ge \text{MAE}$).

### 5.3 Weighted Absolute Percentage Error (WAPE)
$$\text{WAPE} = \frac{\sum_{t=1}^{k} |y_t - \hat{y}_t|}{\sum_{t=1}^{k} y_t}$$
- **Why WAPE Instead of MAPE:** Mean Absolute Percentage Error ($\text{MAPE} = \frac{1}{k}\sum \frac{|y_t - \hat{y}_t|}{y_t}$) divides by actual daily consumption $y_t$. When $y_t = 0$ or is near zero, MAPE explodes to infinity or produces undefined division-by-zero errors. WAPE sums all errors over total period volume, providing a mathematically robust volume-weighted error.
- **Zero-Division Protection:** If $\sum_{t=1}^k y_t = 0$, WAPE is undefined and returns `null`.

### 5.4 Accuracy Score
$$\text{Accuracy Score} = \max\left(0, 100\% \times (1 - \text{WAPE})\right)$$
- Normalized percentage score representing forecast reliability over the evaluation period.
- Clamped between $0\%$ and $100\%$ and formatted to one decimal place (e.g., $88.4\%$).

### 5.5 Completed Calendar Days Rule
- **Rule:** Forecast evaluation evaluates only completed past business calendar dates ($t \le \text{yesterday}$ in Philippine Standard Time, `Asia/Manila`).
- **Reason:** Mid-shift kitchen operations log ingredient usage incrementally throughout meal periods (lunch, dinner). Evaluating today's full 24-hour forecast against partial intraday consumption produces artificial under-consumption errors.
- **Operational Benefit:** Prevents false morning alarms and guarantees that daily consumption figures are finalized before evaluation.

### 5.6 Minimum Evaluation Sample Threshold
- **Threshold:** Minimum **7 matched evaluated days** required (`EVALUATION_MINIMUM_REQUIRED_DAYS = 7`).
- **Academic Justification:** Evaluating model accuracy over fewer than 7 days introduces severe small-sample bias and fails to capture weekly operational seasonality.
- **Truthful Pending State:** If $k < 7$, the API returns:
  ```json
  {
    "status": "UNAVAILABLE",
    "reason": "INSUFFICIENT_EVALUATION_DATA",
    "evaluatedDays": 3,
    "minimumRequiredDays": 7,
    "ingredientId": "...",
    "unit": "kg"
  }
  ```
  The user interface displays `—` and `3/7 evaluated days`, strictly preventing fabricated or premature accuracy claims.

---

## 6. API Endpoints & Role-Based Access Control

All evaluation endpoints are mounted in `server/src/routes/ingredient.routes.ts` and protected by authentication and role-based access control (RBAC):

| Endpoint | Method | Authorized Roles | Description |
| :--- | :--- | :--- | :--- |
| `/api/ingredients/:id/forecast` | `POST` | `Admin`, `Manager` | Triggers Python ML inference and persists snapshots |
| `/api/ingredients/:id/forecast-accuracy` | `GET` | `Admin`, `Manager` | Returns MAE, RMSE, WAPE, and Accuracy Score |
| `/api/ingredients/:id/forecast-vs-actual` | `GET` | `Admin`, `Manager` | Returns daily trend series (`?days=7`, `14`, `30`, `90`) |

Unauthorized requests from unauthenticated callers return `401 Unauthorized`; requests from `Inventory Staff` return `403 Forbidden`; requests for non-existent ingredients return canonical `404 Not Found`.

---

## 7. Professor-Ready Defense Brief (Q&A)

### Q1: "Why did you choose Random Forest over ARIMA or Prophet?"
> *"ARIMA and Prophet assume continuous, unsegmented univariate time series. In commercial food service, ingredients frequently exhibit intermittent demand, weekend consumption spikes, and missing observation gaps. Random Forest handles non-linear interactions, rolling window aggregations, and calendar seasonality (day-of-week) natively as tabular features without requiring strict stationarity transformations."*

### Q2: "Are you using an LLM for forecasting?"
> *"No. ShelfLifeAI treats demand forecasting strictly as a numerical regression problem. The required output is predicted consumption quantity in canonical units, not natural language. Using an LLM would introduce non-deterministic hallucinations, high inference latency, and unnecessary cloud API costs."*

### Q3: "How do you evaluate forecast accuracy if the true demand isn't known ahead of time?"
> *"ShelfLifeAI persists daily predictions as immutable snapshots in our `forecastSnapshots` collection upon generation. Once past calendar dates have concluded, our evaluation service joins those historical snapshots against actual physical kitchen consumption logged in `UsageRecord`. We then compute MAE, RMSE, and WAPE across verified matched pairs."*

### Q4: "Why don't you include waste records in your forecasting model?"
> *"Waste records represent expired, spoiled, or damaged food. Including waste write-offs as demand would create a destructive feedback loop: spoiled food would be predicted as future customer demand, causing the system to recommend higher purchase orders and generating more food waste. Demand must represent actual physical consumption only."*

### Q5: "What happens if a restaurant is closed or staff forgets to log usage on a given day?"
> *"Per our time-series integrity contract, unrecorded days are treated as unobserved gaps (`null`), never assumed as zero. Collapsing missing records into zero would falsely depress moving averages and distort accuracy scores. Gaps are rendered truthfully as disjoint lines in the UI."*

### Q6: "Does your model continuously train itself in real time?"
> *"No. Training and inference are decoupled. Continuous online retraining in production poses severe data contamination risks (concept drift, garbage-in-garbage-out). Our model runs frozen inference, while model performance is systematically monitored via MAE and WAPE. Retraining is an authorized offline workflow triggered only after clean, audited operational history has accumulated."*
