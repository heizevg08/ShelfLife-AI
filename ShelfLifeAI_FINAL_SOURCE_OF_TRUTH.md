# ShelfLifeAI --- Master Agreed Project Summary

> **Status:** FINAL AUTHORITATIVE SOURCE OF TRUTH — implementation baseline\
> **Purpose:** This document consolidates the project decisions,
> architecture, scope, data model, AI plan, security model, frontend
> direction, development rules, and unresolved decisions agreed across
> the ShelfLifeAI discussions.\
> **Authority:** This file is the highest project reference. Explicit team decisions made after this version may amend it; the current repository architecture and established contracts govern implementation details where this file intentionally leaves them open. Older ShelfLifeAI documents are subordinate where they conflict with this Master.\
> **Important:** Items explicitly marked **OPEN / PENDING** are not to be treated as finalized requirements until the group/professor approves them.

------------------------------------------------------------------------

## 1. Official Project Identity

### Official project name

**ShelfLifeAI --- AI-Assisted Ingredient Inventory & Food Waste
Reduction System**

### System domain

Food-service inventory and perishable ingredient management.

### Target users / establishments

ShelfLifeAI is intended for:

-   Small-to-medium restaurants
-   Food-preparation cafés
-   Catering businesses
-   Similar food-service establishments that handle perishable
    ingredients

### Core problem

Food-service establishments may rely on manual monitoring of perishable
ingredients, which can lead to:

-   Incorrect inventory quantities
-   Missed expiration dates
-   Overstocking or understocking
-   Ingredients expiring before use
-   Unnecessary food waste
-   Financial losses

### Core system definition

> ShelfLifeAI is a web-based inventory and decision-support system that
> manages perishable ingredient inventory, tracks ingredient usage and
> expiration, uses historical usage data to forecast whether ingredients
> are likely to be used before expiration, and provides alerts and
> recommended actions to help reduce food waste and financial losses.

This is the preferred system-definition sentence for project
documentation.

------------------------------------------------------------------------

# 2. Core Product Concept

ShelfLifeAI is **not merely a CRUD inventory system** and **not merely
an AI application**.

It is a decision-support system built around a closed operational cycle:

**Manage → Monitor → Record → Analyze → Forecast → Alert → Act → Measure
→ Learn**

The system has four conceptual layers:

1.  **Inventory Management**
2.  **Usage & Waste Tracking**
3.  **Expiration & Risk Management**
4.  **Analytics & AI**

### Layer 1 --- Inventory Management

The establishment records ingredients and incoming inventory batches.

Example:

-   Ingredient: Chicken Breast
-   Batch: CB-001
-   Quantity: 20 kg
-   Received: August 29
-   Expires: September 2
-   Unit Cost: ₱220/kg

The system maintains the actual remaining stock.

### Layer 2 --- Usage & Waste Tracking

Staff record legitimate inventory transactions.

Example:

-   5 kg Chicken Breast used

or:

-   3 kg Chicken Breast wasted
-   Reason: Expired

These records become historical data.

### Layer 3 --- Expiration & Risk Management

The backend monitors batch expiration dates and identifies batches
needing attention.

FEFO is applied:

**FEFO = First Expire, First Out**

The system can identify:

> USE FIRST --- Chicken Breast, Batch CB-001

AI then goes further by estimating future consumption and whether
inventory may remain unused before expiration.

### Layer 4 --- Analytics & AI

Historical usage is analyzed to understand consumption patterns.

Conceptual flow:

**Historical Usage → Consumption Pattern → Forecast →
Expiration/Inventory Risk → Recommendation**

------------------------------------------------------------------------

# 3. Mandatory Technology Stack

The professor requires **MERN**. ShelfLifeAI satisfies MERN while using the repository's current Expo/React Native Web frontend architecture.

### Frontend — approved current baseline

- Expo
- React Native
- React Native Web
- Expo Router
- TypeScript
- NativeWind
- Responsive UI
- Static Expo Web
- PWA layer to be implemented/verified
- Web Push to be implemented/verified

**MVP clarification:** React Native is part of the approved Expo frontend technology. What is out of scope for the MVP is a separately delivered native iOS/Android application. The MVP product is the web/PWA experience.

### UI / design system

- Centralized ShelfLifeAI design system
- Shared application shell and reusable primitives/components
- Centralized semantic design tokens
- Consistent typography, spacing, states, forms, tables, dialogs, navigation, and responsive behavior
- The finalized ShelfLifeAI logo asset must be reused
- Existing repository styling conventions take precedence over stale Tailwind/shadcn/Vite references in older documents

**Tailwind CSS, shadcn/ui, Base UI, and Vite are not mandatory dependencies unless they are explicitly present in and approved for the current repository.** They may be referenced as historical/design context only.

### Backend

- Node.js
- Express.js
- TypeScript
- Mongoose
- REST API

### Database

- MongoDB
- Mongoose ODM
- MongoDB Atlas as the shared cloud database
- MongoDB Compass as the GUI/client for inspecting Atlas

### AI / ML

- Python
- Google Colab for experimentation and training when appropriate
- **Current Plan A:** use the laptop of the group member with a capable GPU for model training
- One strong public dataset for initial experimentation if necessary
- ShelfLifeAI operational data for eventual system-specific forecasting
- Exact ML algorithm, feature set, artifact format, inference runtime, forecast horizon, and persistence strategy remain **OPEN** until dataset exploration/model evaluation

### Version control / design

- GitHub
- Figma

### MERN justification

- **MongoDB:** flexible document-oriented storage suited to ingredient, batch, usage, waste, change-request, audit, and possible forecast records
- **Express.js:** REST/API layer connecting the React client with backend business logic
- **React:** component-based interface delivered through Expo/React Native Web for dashboards, forms, inventory views, alerts, analytics, and PWA UI
- **Node.js:** JavaScript/TypeScript-oriented full-stack environment with asynchronous I/O suitable for API requests

Do not replace React, Node/Express, or MongoDB without an explicit group/professor decision.

------------------------------------------------------------------------

# 4. Final Application Architecture

The approved application architecture is:

``` text
Expo + React Native + React Native Web + Expo Router + TypeScript
        ↓
Static Expo Web
        ↓
PWA
        ↓
HTTPS / TLS in production
        ↓
Node.js + Express REST API
        ↓
Mongoose
        ↓
MongoDB Atlas
        ↕
MongoDB Compass
```

**Local-development clarification:** localhost development may use HTTP. Production must use HTTPS/TLS. The UI and documentation must never claim HTTPS, database telemetry, notification readiness, MFA readiness, or any other service state unless that state is actually implemented and verifiable.

The AI development environment remains separate:

``` text
MongoDB / Public Dataset
        ↓
Python
        ↓
GPU Laptop / Google Colab
        ↓
Data Preparation
        ↓
Training
        ↓
Validation / Testing
        ↓
Evaluation
        ↓
Trained Model Artifact
        ↓
MERN-compatible inference integration
```

The exact model-serving mechanism is **OPEN**. ONNX + ONNX Runtime in Node/Express remains a preferred candidate only; it is not locked until the final model and deployment compatibility are verified.

------------------------------------------------------------------------

# 5. Professor's MERN Boilerplate --- How ShelfLifeAI Adapts It

The professor's demonstrated MERN boilerplate establishes the architectural separation of frontend, backend, models, routes, controllers, and data access. ShelfLifeAI preserves that principle while using the actual repository structure and the additional production layers the project requires.

The authoritative project structure is:

``` text
ShelfLife-AI/
│
├── client/
│   ├── src/
│   │   ├── app/                 # Expo Router application routes/pages
│   │   ├── components/
│   │   │   ├── application/     # authenticated application shell/primitives
│   │   │   ├── dashboard/       # role-specific dashboard components
│   │   │   └── ...
│   │   ├── services/            # frontend service/API boundaries
│   │   ├── types/
│   │   ├── hooks/
│   │   └── styles/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── utils/
│   │   └── server.ts
│   ├── tests/
│   ├── .env                    # local secret; never committed
│   ├── .env.example            # safe placeholders/documented keys only
│   └── package.json
│
├── ml/
│   ├── notebooks/
│   ├── data/
│   ├── models/
│   └── README.md
│
├── docs/
├── UI/
├── .gitignore
└── README.md
```

The actual repository remains the final authority for exact existing paths. Agents must inspect the repository before creating or moving files; they must not recreate legacy `frontend/`, `backend/`, `App.tsx`, `main.tsx`, or `vite.config.ts` structures merely because older drafts used them.

This is the production-oriented structure. It is not a throwaway prototype.

------------------------------------------------------------------------

# 6. Permanent Development Rule --- Production Structure First

A hard project rule was established:

> **Always create folders, files, and architectural layers in the same
> production-oriented sequence and structure that will actually be used
> when the backend is connected.**

Do not create temporary or throwaway structures merely for frontend
prototyping.

If mock data is needed:

``` text
Page
 ↓
Service
 ↓
Mock implementation now
 ↓
Real Express API later
```

The page must not directly import mock data.

The same types/contracts should be used by mock and real implementations
so the backend connection does not require restructuring the frontend.

------------------------------------------------------------------------

# 7. Frontend Architecture Rule

For a typical module such as Inventory:

``` text
Inventory.tsx
      ↓
inventoryService.ts
      ↓
axiosClient.ts
      ↓
Express API
      ↓
Route
      ↓
Controller
      ↓
Backend Service
      ↓
Mongoose Model
      ↓
MongoDB Atlas
```

The React page is responsible for UI and interaction.

It must **not** be the source of truth for:

-   Expiration status
-   Risk status
-   FEFO ordering
-   Waste cost
-   Inventory quantity rules
-   Authorization decisions

Those belong to the backend/business-logic layer.

------------------------------------------------------------------------

# 8. Frontend Structure and Existing Baseline

The working repository is already an Expo/React Native Web application and must be refined rather than discarded or migrated back to an obsolete Vite-only structure.

Important current architectural locations include:

``` text
client/src/app/
client/src/components/application/
client/src/components/dashboard/
client/src/services/
client/src/styles/
server/src/
server/tests/
```

Known current Super Admin UI-A foundation includes:

``` text
client/src/app/pages/SuperAdminDash.tsx
client/src/components/application/ApplicationShell.tsx
client/src/components/application/primitives.tsx
client/src/components/dashboard/SuperAdminDashboard.tsx
client/src/services/system.ts
client/src/styles/application.css
client/public/fonts/
```

These paths describe the current implementation baseline and may evolve only through deliberate refactoring. Do not recreate already-existing components, duplicate application shells, or move established files merely to match an older document.

The frontend must continue to preserve production service/API boundaries so that mocked or unavailable states can later be replaced with real Express-backed data without redesigning the page architecture.

------------------------------------------------------------------------

# 9. Frontend Design System

ShelfLifeAI must have one coherent visual language across all roles and modules.

### Typography hierarchy

The same semantic hierarchy must be reused everywhere:

``` text
Page title
Page description
Section title
Body text
Supporting / muted text
Numeric values
Table text
```

The dashboard establishes the visual hierarchy that Inventory and later pages should follow. Do not choose unrelated font sizes or styles page-by-page.

### Design tokens

- Use centralized semantic design tokens.
- OKLCH is the preferred color-token format where supported by the current styling layer.
- Avoid component-local hardcoded brand colors unless technically necessary and documented.
- Brand colors, semantic states, borders, spacing, radii, typography, and status colors should be centralized.
- Warm peach may remain a restrained supporting accent; it must not compete with the primary ShelfLifeAI green system.

### UI framework / implementation rule

The approved frontend is:

``` text
Expo
↓
React Native
↓
React Native Web
↓
Expo Router
↓
TypeScript
↓
NativeWind / current repository styling layer
↓
ShelfLifeAI Design System
↓
Application Shell
↓
PWA
↓
Web Push
```

Older references to Vite, Tailwind CSS, shadcn/ui, or Base UI do not override the current repository. Do not install, migrate to, or rebuild around them unless the team explicitly approves a technical need.

### Logo and branding

The actual logo asset supplied/finalized by the group must be reused. Do not generate a replacement logo unless explicitly requested.

### UI quality standard

The interface should feel like a serious, modern operational product—not a template demo, a generic admin dashboard, or an arbitrary pile of cards. Remove decorative copy, redundant labels, oversized placeholders, duplicate identity information, and empty visual bulk when they do not improve comprehension.

Every visible element must justify its presence through one of these functions:

1. navigation,
2. comprehension,
3. decision support,
4. task completion,
5. system feedback,
6. accessibility,
7. security/status communication.

------------------------------------------------------------------------

# 10. PWA and Notifications

PWA is the official MVP platform.

``` text
Expo / React Native Web
        ↓
Static Web Build
        ↓
PWA Layer
        ↓
Service Worker
        ↓
Web Push Notifications
```

Web Push Notifications may be supported through the PWA on compatible browsers/devices once implemented and verified.

Potential notification types include:

- Expiration alerts
- Low-stock alerts
- AI-assisted inventory/expiration-risk alerts

Notifications are not the same thing as AI. The AI predicts/flags risk; the backend determines deterministic business-rule status and alert conditions.

The application must still show alerts inside the app even when push notifications are unavailable.

**MVP scope clarification:** a separately delivered native iOS/Android application is not part of the MVP. React Native itself remains part of the approved Expo/React Native Web frontend architecture.

------------------------------------------------------------------------

# 11. Final User Roles --- Exactly Four

The application uses exactly these four roles:

1.  **Super Admin**
2.  **Admin**
3.  **Manager**
4.  **Inventory Staff**

Do not reintroduce:

-   Kitchen Staff
-   Inventory Manager
-   Other role names

Older drafts containing Kitchen Staff are outdated.

### Super Admin

Purpose:

-   System-wide administration
-   Security controls
-   Admin account management
-   System configuration
-   Protected audit/security access

Sidebar:

``` text
Dashboard
Admin Accounts
System Settings
Security & Activity
```

### Admin

Purpose:

-   Establishment-level user administration
-   Ingredient/master-data administration
-   Administrative records
-   Authorized reporting/monitoring

Sidebar:

``` text
Dashboard
Users
Ingredients
Inventory
Audit Logs
Reports
```

### Manager

Purpose:

-   Inventory oversight
-   Expiration-risk monitoring
-   FEFO oversight
-   Usage/waste oversight
-   Forecasting
-   Alerts
-   Reports and analytics
-   Change-request review

Sidebar:

``` text
Dashboard
Inventory
Usage & Waste
Change Requests
Forecasting
Alerts
Reports & Analytics
```

### Inventory Staff

Purpose:

-   Day-to-day inventory operations
-   Stock-in
-   Usage recording
-   Waste recording
-   Inventory monitoring
-   Controlled change requests

Sidebar:

``` text
Dashboard
Inventory Batches
Stock-In
Usage Recording
Waste Recording
My Requests
```

------------------------------------------------------------------------

# 12. Login and Authorization Flow

The intended flow is:

``` text
LOGIN
  ↓
AUTHENTICATION
  ↓
MFA / SECURITY LAYER
  ↓
RBAC
  ↓
ROLE-SPECIFIC DASHBOARD
  ↓
ROLE-SPECIFIC SIDEBAR
  ↓
AUTHORIZED MODULES
  ↓
REST API
  ↓
MongoDB
```

Every role lands on a dashboard after login.

Dashboards are role-specific.

### Personalized greeting

Preferred UI direction:

``` text
Good morning, Jay!
Here's what's happening with your inventory today.
```

or the appropriate time-of-day greeting.

The name should eventually come from the authenticated user record.

Temporary mock user data is acceptable during early UI work only when it
is isolated behind the same production service/API boundary.

------------------------------------------------------------------------

# 13. Core Modules

The core application consists of:

1.  Authentication & User Management
2.  Dashboard
3.  Ingredient Management
4.  Inventory Batch Management
5.  Usage Recording
6.  Waste Recording
7.  Expiration Monitoring
8.  FEFO
9.  AI-Assisted Forecasting
10. Alerts & Recommendations
11. Analytics & Reports
12. Audit / controlled change workflows

------------------------------------------------------------------------

# 14. Ingredient Management

Ingredients are master/reference data.

Example:

``` text
Name: Chicken Breast
Category: Meat
Unit of Measure: kg
Minimum Stock: 10
Standard Unit Cost: ₱220
```

CRUD:

-   Create
-   Read
-   Update
-   Delete

The backend validates duplicate names and minimum-stock rules.

### Correct Ingredient fields

``` text
_id
name
brand
description
category
unitOfMeasure
minimumStock
standardUnitCost
defaultShelfLifeDays
createdBy
createdAt
updatedAt
```

Rules:

-   `_id` is MongoDB ObjectId
-   `name` is required and unique
-   `category` is required
-   `unitOfMeasure` is required
-   `minimumStock >= 0`
-   `standardUnitCost >= 0`
-   `defaultShelfLifeDays` is optional and \> 0 when present
-   `defaultShelfLifeDays` is a suggested/default shelf-life duration
    for a new batch
-   Actual expiration belongs to the inventory batch

**Do not put `expirationDate` in Ingredients.**

------------------------------------------------------------------------

# 15. Inventory Batch Management

An Inventory Batch represents actual stock received.

Correct conceptual example:

``` text
Chicken Breast
 ├── Batch 001 — 20 kg — Sept 2
 ├── Batch 002 — 15 kg — Sept 6
 └── Batch 003 — 30 kg — Sept 10
```

This is what enables FEFO.

### InventoryBatch fields

``` text
_id
ingredientId
batchCode
quantity
unit
dateReceived
expirationDate
unitCost
status
createdBy
createdAt
updatedAt
```

Rules:

-   `ingredientId` references Ingredients
-   `quantity` is the current remaining quantity
-   `unit` should correspond to the ingredient unit
-   `expirationDate` is the actual batch expiration
-   `expirationDate` should be after `dateReceived`
-   `unitCost >= 0`
-   `status` is server-calculated

The ingredient's `defaultShelfLifeDays` may help suggest an expiration
date when a new batch is created, but the batch's actual
`expirationDate` is authoritative.

------------------------------------------------------------------------

# 16. Inventory Page Concept

The Inventory page represents **Inventory Batches**, while its summary
can show unique ingredients.

Preferred summary wording:

**Total Ingredients**

not "Total Items," when the number represents unique ingredients.

Inventory views:

-   All
-   Low Stock
-   Expiring Soon
-   FEFO Priority

Expiring Soon and FEFO Priority are **filtered/sorted views**, not
separate database modules.

Inventory UI should display API-provided status and ordering rather than
recalculating backend rules.

------------------------------------------------------------------------

# 17. Usage Records

Usage is a proper inventory transaction.

Users should not randomly edit inventory quantities.

### UsageRecord fields

``` text
_id
batchId
ingredientId
quantityUsed
unit
dateUsed
staffId
createdAt
```

Important forecasting fields:

-   `ingredientId`
-   `quantityUsed`
-   `dateUsed`
-   `batchId`

The primary forecasting signal is:

**ingredientId + quantityUsed + dateUsed**

### Usage workflow

``` text
Record Usage
    ↓
Validate quantity
    ↓
Check available quantity
    ↓
Apply FEFO
    ↓
Deduct inventory quantity
    ↓
Save Usage Record
    ↓
Audit Record
```

Usage records become historical consumption data.

------------------------------------------------------------------------

# 18. Waste Records

Waste is also a proper transaction.

### WasteRecord fields

``` text
_id
batchId
ingredientId
quantityWasted
unit
reason
wasteCost
dateWasted
recordedBy
createdAt
```

Reasons include:

-   Expired
-   Spoiled
-   Damaged
-   Over-prepared
-   Other

### Waste cost

The backend calculates:

**wasteCost = quantityWasted × unitCost**

The frontend must never be trusted to submit the authoritative
`wasteCost`.

The cost must be calculated server-side using the relevant
batch/ingredient cost.

Waste creates historical waste data and supports financial analytics.

------------------------------------------------------------------------

# 19. Expiration Monitoring

Expiration status is deterministic backend logic.

The server compares:

**expirationDate + current server date**

Status categories:

-   Normal
-   Approaching Expiry
-   Critical
-   Expired

Exact thresholds may be configurable later.

The frontend must never send or dictate the authoritative expiration
status.

Status may be recalculated on request or through a scheduled mechanism.

------------------------------------------------------------------------

# 20. FEFO

**FEFO = First Expire, First Out**

FEFO is deterministic business logic, not AI.

Example:

``` text
Batch A → expires Sept 2
Batch B → expires Sept 6
Batch C → expires Sept 10
```

The system prioritizes Batch A.

The API may provide a "Use First" indicator.

Normal usage should follow FEFO where appropriate.

------------------------------------------------------------------------

# 21. Change Requests

Change Requests are part of the finalized operational concept, but their
presence must remain consistent across all project documents.

Purpose:

Controlled requests for permitted master-data changes, not ordinary
inventory quantity changes.

Example workflow:

``` text
Inventory Staff
      ↓
Submit Change Request
      ↓
Pending
      ↓
Manager Review
      ↓
Approve / Reject
      ↓
If Approved:
Validate
      ↓
Apply Change
      ↓
Audit Record
```

If rejected, the underlying database data is not changed.

### Suggested fields

``` text
_id
ingredientId
requestedBy
requestType
requestedChanges
reason
status
reviewedBy
reviewNotes
requestedAt
reviewedAt
```

Statuses:

-   Pending
-   Approved
-   Rejected

Potential allowlisted requested fields include:

-   minimumStock
-   standardUnitCost
-   category
-   brand
-   description
-   unitOfMeasure
-   defaultShelfLifeDays

Change Requests should not replace normal Stock-In, Usage, or Waste
transactions.

------------------------------------------------------------------------

# 22. Audit Records

Audit Records are system-generated.

### Fields

``` text
_id
userId
action
targetType
targetId
timestamp
```

Potential actions include:

-   CREATE
-   UPDATE
-   ARCHIVE
-   CHANGE_REQUEST_SUBMITTED
-   CHANGE_REQUEST_APPROVED
-   CHANGE_REQUEST_REJECTED
-   EXPORT

Audit records should be protected from ordinary user
modification/deletion.

------------------------------------------------------------------------

# 23. Database Relationships

Conceptual relationships:

``` text
USER
 ├── UsageRecords
 ├── WasteRecords
 ├── AuditRecords
 └── ChangeRequests

INGREDIENT
 └── InventoryBatches
       ├── UsageRecords
       └── WasteRecords
```

Inventory Staff
      ↓
changeRequests
      ↓
Manager Review
   ↙       ↘
Approve   Reject
   ↓
Validated Change
   ↓
Audit Record

Specifically:

-   One Ingredient → many InventoryBatches
-   One InventoryBatch → many UsageRecords
-   One InventoryBatch → many WasteRecords
-   One User → many UsageRecords
-   One User → many WasteRecords
-   One User → many AuditRecords
-   ChangeRequests reference Ingredients and Users

MongoDB uses references/ObjectIds rather than relational foreign-key
terminology.

------------------------------------------------------------------------

# 24. Core Collections

Core operational collections are:

``` text
users
ingredients
inventoryBatches
usageRecords
wasteRecords
changeRequests
auditRecords
```

### Forecast persistence — OPEN

Forecast results may be computed on request or persisted. Therefore, `forecasts` is **not a mandatory core collection yet**.

If persistence is later approved, the conceptual flow becomes:

``` text
Usage Records
      +
Waste Records
      +
Inventory Batches
      +
Ingredient Data
      ↓
AI Forecasting
      ↓
Forecast Result
      ↓
forecasts collection
      ↓
Dashboard / Reports / Alerts
```

A persisted forecast history could support questions such as: what did the system predict last week, and how close was that prediction to actual consumption?

Until forecast persistence is explicitly approved, agents must not create a mandatory `forecasts` collection and present it as finalized.

------------------------------------------------------------------------

# 25. AI Purpose

The AI should answer:

> **Based on historical usage and current inventory context, how much of
> an ingredient is likely to be consumed over the relevant future
> period, and is inventory therefore at risk of remaining unused before
> expiration?**

The AI is **not** primarily responsible for determining whether
something is already expired.

Expiration is deterministic.

The AI forecasts future consumption.

------------------------------------------------------------------------

# 26. AI Data Hierarchy

### Primary forecasting data

**Usage Records**

Important fields:

-   ingredientId
-   quantityUsed
-   dateUsed
-   batchId

This is the primary historical consumption dataset.

### Secondary forecasting/supporting data

**Waste Records**

Useful fields:

-   ingredientId
-   quantityWasted
-   unit
-   reason
-   wasteCost
-   dateWasted

Waste can reveal patterns such as high consumption combined with high
waste.

### Current inventory context

**Inventory Batches**

Important context:

-   ingredientId
-   quantity
-   dateReceived
-   expirationDate
-   unitCost
-   status

### Reference information

**Ingredients**

Useful context:

-   name
-   category
-   unitOfMeasure
-   minimumStock
-   defaultShelfLifeDays

------------------------------------------------------------------------

# 27. Final AI Pipeline

``` text
Usage Records
      +
Waste Records
      +
Inventory Batches
      +
Ingredients
      ↓
Data Preparation
      ↓
Consumption Patterns
      ↓
AI-Assisted Forecasting
      ↓
Predicted Consumption
      ↓
Expiration / Inventory Risk
      ↓
Recommended Action
```

The broader system cycle is:

``` text
Historical Usage
      ↓
Forecast
      ↓
Risk
      ↓
Alert
      ↓
Recommendation
      ↓
FEFO / Operational Action
      ↓
Usage / Waste
      ↓
Analytics
      ↓
Future Learning
```

------------------------------------------------------------------------

# 28. Baseline Forecast

A statistical/business-rule baseline ships before the ML model.

Current baseline:

**Expected usage = average usage × number of forecast days**

Then:

**Potential remaining = current quantity − expected usage**

Example:

``` text
Average daily usage = 5 kg
Forecast period = 4 days

Expected usage = 5 × 4
               = 20 kg

Current quantity = 25 kg

Potential remaining = 25 − 20
                    = 5 kg
```

The baseline is **not itself ML**.

It provides:

-   an immediately usable forecasting method
-   a risk calculation foundation
-   a comparison point for the later ML model

------------------------------------------------------------------------

# 29. AI Model Selection

The exact ML algorithm is **OPEN**.

Do not select a model merely because it sounds advanced.

The decision should happen after dataset exploration.

Possible candidate families may include suitable regression or
time-series approaches, but the final choice depends on:

-   Dataset size
-   Data frequency
-   Ingredient count
-   Consumption variability
-   Seasonality
-   Historical depth
-   Forecast horizon
-   Feature availability
-   Evaluation results
-   Deployment compatibility

Correct sequence:

``` text
Dataset
 ↓
Explore
 ↓
Understand patterns
 ↓
Select candidate models
 ↓
Train
 ↓
Evaluate
 ↓
Compare with baseline
 ↓
Select acceptable model
```

------------------------------------------------------------------------

# 30. Training Environment --- Current Plan A

The group decided to use:

**the laptop of the group member with a capable GPU**

for AI model training.

Python/Google Colab remains part of the ML workflow for:

-   Data preparation
-   EDA
-   Experimentation
-   Training
-   Validation
-   Testing
-   Evaluation

The GPU machine is an ML workstation; it does not replace:

-   MongoDB Atlas
-   Express
-   Node.js
-   React

------------------------------------------------------------------------

# 31. How Many Datasets Are Needed?

For initial AI development:

**One strong primary public dataset is enough.**

Do not collect multiple unrelated datasets simply to increase the number
of datasets.

The preferred starting point is:

``` text
1 relevant public dataset
        ↓
AI experimentation
        ↓
Baseline
        ↓
Candidate ML models
        ↓
Evaluation
```

The ShelfLifeAI database itself then becomes the eventual operational
data source.

Important distinction:

``` text
Public Dataset
→ Initial AI development/experimentation

ShelfLifeAI Usage Records
→ Primary operational forecasting data

ShelfLifeAI Waste Records
→ Supporting historical data

ShelfLifeAI Inventory Batches
→ Current inventory/expiration context
```

These are **four data sources/types of information**, not four required
training datasets.

A second public dataset is only considered if it is genuinely
complementary, compatible, licensed, and defensibly mappable to the
project.

------------------------------------------------------------------------

# 32. Public Dataset Rules

A public dataset may be used because the project initially lacks enough
real operational history.

Candidate sources can include Kaggle and other legitimate public
repositories.

Search concepts include:

-   food demand forecasting
-   ingredient consumption forecasting
-   restaurant inventory demand
-   food inventory time series
-   food consumption time series
-   restaurant ingredient usage
-   food waste and inventory

Before accepting a dataset, check:

1.  Does it contain temporal information?
2.  Does it represent consumption/demand?
3.  Does it contain a measurable quantity?
4.  Is there enough historical depth?
5.  Are units understandable?
6.  Is the license appropriate for academic use?
7.  Can its structure be honestly mapped to ShelfLifeAI?

Restaurant sales data is **not automatically ingredient consumption
data**.

If sales data is used, the mapping from sales to ingredient consumption
must be defensible, for example through valid recipe/ingredient
relationships if available.

Never claim public-data training was based on real ShelfLifeAI
operational history when it was not.

------------------------------------------------------------------------

# 33. Synthetic Data

Synthetic data may be used for:

-   Frontend testing
-   API testing
-   Database testing
-   Pagination testing
-   Aggregation testing
-   Scalability testing
-   Forecasting pipeline testing when appropriate

Synthetic data must be explicitly labeled as synthetic.

It must not be presented as real historical restaurant data.

------------------------------------------------------------------------

# 34. ML Data Preparation

MongoDB operational records do not necessarily go directly into the
model.

The pipeline is:

``` text
MongoDB / Public Dataset
        ↓
Extract
        ↓
Clean
        ↓
Validate
        ↓
Transform
        ↓
Feature Engineering
        ↓
Model-ready dataset
```

Potential features may include:

-   Historical usage
-   Lagged usage
-   Rolling averages
-   Usage frequency
-   Date/day/week information
-   Historical waste
-   Current quantity
-   Days until expiration

The exact feature set is **OPEN** until the dataset is explored.

------------------------------------------------------------------------

# 35. Time-Series Evaluation

Forecasting must respect time.

Do not randomly mix future records into training.

Conceptually:

``` text
PAST                              FUTURE
──────────────────────────────────────────→

Training        Validation        Test
```

The model must learn from the past when predicting the future.

Avoid future-data leakage.

------------------------------------------------------------------------

# 36. Model Evaluation

Forecasts should be compared with actual consumption.

Possible metrics:

-   MAE --- Mean Absolute Error
-   RMSE --- Root Mean Squared Error
-   Other appropriate metrics if justified

The important academic comparison is:

**Does the ML model improve meaningfully over the baseline?**

A model should not be selected merely because it is more complicated.

------------------------------------------------------------------------

# 37. AI Deployment

Preferred candidate architecture:

``` text
Python / Google Colab
        ↓
Train
        ↓
Evaluate
        ↓
Export model
        ↓
Potentially ONNX
        ↓
Node.js + Express
        ↓
ONNX Runtime
        ↓
Prediction
        ↓
Risk Assessment
        ↓
React / PWA
```

ONNX is a **preferred candidate, not a finalized requirement**.

If the selected model cannot be cleanly deployed using ONNX, the
deployment approach should be reconsidered.

Do not replace the mandatory Node/Express backend with FastAPI merely
for convenience.

------------------------------------------------------------------------

# 38. AI Inference Behavior

Training and inference are different.

### Training

``` text
Historical data
 ↓
Python/GPU
 ↓
Train
 ↓
Evaluate
 ↓
Saved model
```

### Inference

``` text
Current + relevant historical data
 ↓
Node/Express
 ↓
Trained model
 ↓
Predicted consumption
 ↓
Risk assessment
 ↓
Recommendation
```

The model is not retrained whenever a Manager opens the dashboard.

------------------------------------------------------------------------

# 39. AI Must Remain Human-in-the-Loop

The AI can:

-   Predict
-   Flag risk
-   Support recommendations

The AI must not directly:

-   Deduct inventory
-   Delete inventory
-   Mark an item expired
-   Modify master data
-   Execute uncontrolled transactions

Conceptually:

``` text
AI
 ↓
Prediction
 ↓
Risk
 ↓
Recommendation
 ↓
Human decision
```

------------------------------------------------------------------------

# 40. Cold Start, Outliers, and Explainability

The AI design must consider:

### Cold-start ingredients

A new ingredient may have little/no history.

Use a baseline/fallback rather than pretending the model knows the
answer.

### Outliers

Unusual consumption must be investigated rather than automatically
deleted.

### Units

Data must be normalized/validated so kg, g, L, pieces, etc. are not
mixed incorrectly.

### Explainability

Prefer useful operational explanations:

> High expiration risk --- current stock is higher than predicted
> consumption before the batch expires.

Avoid meaningless AI jargon.

------------------------------------------------------------------------

# 41. Forecast Results

Forecast results are currently an output.

They may be:

### Option A --- computed on request

``` text
Manager opens Forecasting
 ↓
Express retrieves data
 ↓
Model runs
 ↓
Prediction returned
```

### Option B --- persisted

``` text
Model runs
 ↓
Prediction
 ↓
Forecasts collection
 ↓
Dashboard / Analytics
```

The project has intentionally not locked this choice yet.

------------------------------------------------------------------------

# 42. Alerts and Recommendations

Alerts are deterministic backend outputs based on system/model results.

Potential alert types:

-   Expiration
-   High expiration risk
-   Low stock
-   Overstock/risk

Example:

> Chicken Breast expires in 2 days.

AI-related example:

> Chicken Breast is likely to remain partially unused before expiration.

Recommendation:

> Prioritize Chicken Breast in upcoming food preparation.

AI is not the alert engine itself.

------------------------------------------------------------------------

# 43. Analytics and Reports

Planned analytics include:

### Inventory analytics

-   Current stock
-   Stock movement
-   Low-stock items

### Expiration analytics

-   Expired batches
-   Near-expiry batches
-   At-risk ingredients

### Usage analytics

-   Daily usage
-   Weekly usage
-   Consumption patterns

### Waste analytics

-   Quantity wasted
-   Waste reason
-   Waste cost

### Financial analytics

-   Estimated value of wasted inventory

### Forecast analytics

-   Predicted consumption
-   Actual consumption
-   Forecast error
-   Forecast accuracy where applicable

------------------------------------------------------------------------

# 44. Export / Download Feature — PENDING FORMAL SCOPE APPROVAL

A controlled export/download capability conceptually fits Reports & Analytics and authorized Audit Log workflows, but implementation remains **PENDING GROUP APPROVAL** unless a later explicit team decision freezes it.

Potential report types:

- Forecast
- Inventory Analytics
- Usage Analytics
- Waste Analytics
- Expiration Analytics
- Audit Logs for authorized roles

Potential filters:

- Date range
- Ingredient
- Category
- Risk
- Status
- Waste reason
- User/action for authorized audit data
- Other report-specific filters

Potential formats:

- CSV — raw data / analysis
- XLSX — business analysis / spreadsheet use
- PDF — formal report / printing

If approved, the architecture is:

``` text
Reports & Analytics / Authorized Audit Interface
        ↓
Filters
        ↓
RBAC authorization
        ↓
Export Service
   ↙      ↓      ↘
 CSV    XLSX    PDF
        ↓
Audit Record
```

Security rules:

- Exports must be RBAC-controlled.
- Ordinary users must never receive a generic full-database dump.
- Sensitive audit exports require stronger authorization.
- Export actions should themselves create Audit Records where applicable.
- Super Admin does not gain a separate Reports sidebar merely because contextual security/audit export may exist.

------------------------------------------------------------------------

# 45. Security Architecture

The intended request flow is:

``` text
Client
 ↓
HTTPS / TLS
 ↓
Rate Limiting
 ↓
Helmet / Security Headers
 ↓
CORS
 ↓
Authentication
 ↓
RBAC Authorization
 ↓
Input Validation / Sanitization
 ↓
Business Logic
 ↓
Mongoose
 ↓
MongoDB
 ↓
Audit Record
```

Security requirements include:

-   Authentication
-   Password hashing
-   Secure JWT/session handling
-   MFA/security layer
-   RBAC
-   Input validation
-   Input sanitization
-   NoSQL-injection protection
-   Rate limiting
-   Secure CORS
-   Helmet/security headers
-   HTTPS/TLS
-   Protected secrets
-   Audit logging

Never store plaintext passwords.

Never commit secrets.

Derived values must be server-computed.

------------------------------------------------------------------------

# 46. MFA

MFA is an approved security objective, but the exact implementation details remain **OPEN** until feasibility and milestone scope are confirmed.

Preferred direction:

**TOTP/authenticator-app based MFA**

Potential policy:

- Super Admin: mandatory
- Admin: mandatory
- Manager: required by policy
- Inventory Staff: configurable/required by policy

No frontend, dashboard, health panel, or documentation may claim that MFA is active, healthy, enforced, or available until the corresponding backend/security milestone is genuinely implemented and verified.

The implementation must avoid unnecessary complexity beyond project/course feasibility.

------------------------------------------------------------------------

# 47. Database Scalability

ShelfLifeAI should demonstrate sound database practices without
pretending it is a Big Data system.

Planned:

-   Indexing
-   Pagination
-   Aggregation pipelines
-   Selective field retrieval
-   Query review

Important indexes include:

``` text
InventoryBatch:
  ingredientId
  expirationDate
  status

UsageRecord:
  dateUsed
```

Additional indexes can be added when query patterns justify them.

Scalability explanation should cover:

### Scale-up

More CPU/RAM/storage on the backend server.

### Scale-out

Multiple Express instances behind a load balancer.

The project does not need to build an enterprise-scale cluster merely to
demonstrate the concept.

------------------------------------------------------------------------

# 48. Course Alignment

### ITE 314 --- Advanced Database Systems

Demonstrate:

-   MongoDB
-   Mongoose
-   CRUD
-   Document design
-   Relationships/references
-   Indexing
-   Aggregation

### ITE 359 --- Networking 2

Demonstrate:

-   Client-server architecture
-   HTTPS/TLS
-   API communication
-   Network/security considerations

### ITE 353 --- Data Scalability and Analytics

Demonstrate:

-   Historical data
-   Data preparation
-   Aggregation
-   Analytics
-   Forecasting
-   Scalability considerations
-   Forecast evaluation

### ITE 307 --- Quantitative Methods

Potential measurable variables:

-   Usage rate
-   Waste rate
-   Expiration/shelf-life metrics
-   Financial loss
-   Forecast error
-   Forecast accuracy

### ITE 302 --- Information Assurance & Security

Demonstrate:

-   Authentication
-   MFA
-   RBAC
-   Validation
-   Secure API
-   Rate limiting
-   Audit logging
-   Security testing

------------------------------------------------------------------------

# 49. Out of Scope for the MVP

Do not silently reintroduce:

- Separately delivered native iOS/Android application
- Arduino/IoT sensors
- Barcode hardware/scanning
- Computer vision
- Camera-based inventory recognition
- POS integration
- Online ordering
- Customer management
- Supplier marketplace
- Payment processing
- Multi-branch/locations management
- Real-time IoT monitoring
- Chatbot
- Advanced generative AI
- Full enterprise ERP functionality

**Clarification:** React Native is not out of scope as a technology; it is part of the approved Expo/React Native Web frontend. What is out of scope is a separate native mobile product/deployment for the MVP.

Multi-branch management is specifically **not** part of the MVP.

------------------------------------------------------------------------

# 50. Development Roadmap

The dependency order is:

``` text
Setup
 ↓
Requirements
 ↓
Database Design
 ↓
Backend Foundation
 ↓
Security/Auth/RBAC
 ↓
CRUD
 ↓
Inventory
 ↓
Usage/Waste
 ↓
FEFO/Expiration
 ↓
Historical Data / Quantitative Analysis
 ↓
Baseline Forecast
 ↓
ML Forecasting
 ↓
Alerts
 ↓
Dashboard
 ↓
Analytics/Reports
 ↓
Integration
 ↓
Security/Scalability Testing
 ↓
Full Testing
 ↓
Deployment
 ↓
Final Documentation/Polish
```

The detailed implementation phases are:

### Phase 0 --- Setup

-   GitHub
-   Branching/commit conventions
-   Figma
-   MERN repo
-   MongoDB/Mongoose connection
-   Environment variables
-   HTTPS/TLS planning/configuration
-   Folder structure
-   Linting/formatting/CI

### Phase 1 --- Requirements

-   Scope
-   Target users
-   Objectives
-   SDG alignment
-   Quantitative justification
-   MERN justification
-   Roles
-   Permissions
-   System flow

### Phase 2 --- Database

-   Schemas
-   Relationships
-   Indexes

### Phase 3 --- Backend Foundation

-   Express skeleton
-   Routes
-   Controllers
-   Services
-   Validation
-   Error handling
-   API conventions
-   Secure middleware
-   API contracts

### Phase 4 --- Authentication/RBAC/Audit

-   Login/register as required
-   Password hashing
-   JWT/session handling
-   MFA
-   RBAC
-   Audit records
-   Protected frontend routes

### Phase 5 --- Ingredients

-   API contract
-   CRUD
-   Validation
-   Audit

### Phase 6 --- Inventory Batches

-   API contract
-   Batch creation
-   Listing
-   Ingredient relationships
-   Audit

### Phase 7 --- Usage + FEFO

-   API contract
-   Quantity validation
-   FEFO
-   Deduction
-   Usage record
-   Audit

### Phase 8 --- Waste

-   API contract
-   Quantity validation
-   Server-side waste cost
-   Waste record
-   Audit

### Phase 9 --- Expiration

-   Server-side status
-   Thresholds
-   Recalculation

### Phase 10 --- Historical Data + Quantitative Analysis

-   Usage rates
-   Waste rates
-   Expiration metrics
-   Financial loss
-   Consumption patterns
-   Usage/waste relationships
-   Forecast error once forecasting exists

### Phase 11 --- AI-Assisted Forecasting

-   Historical aggregation
-   Data preparation
-   Baseline
-   Baseline risk
-   Decide forecast persistence
-   Unit tests
-   Later ML model
-   Model evaluation
-   Feed prediction into the same risk engine

### Phase 12 --- Alerts

-   Alert API
-   Deterministic rule engine
-   Recommendations
-   Frontend alerts

### Phase 13 --- Dashboard

-   Dashboard API
-   Aggregates
-   Role-specific dashboard content
-   Frontend integration

### Phase 14 --- Analytics & Reports

-   Inventory
-   Expiration
-   Usage
-   Waste
-   Financial
-   Forecast analytics
-   Charts/reports
-   Export if approved

### Phase 15 --- Final Integration

-   Remove leftover mock implementations
-   Verify all API contracts
-   Loading/error states
-   Backend RBAC vs UI restrictions
-   Full frontend/backend integration

### Phase 16 --- Security + Scalability Testing

-   Auth/RBAC testing
-   Validation
-   Derived-value checks
-   Security middleware
-   Indexes
-   Pagination
-   Aggregation
-   Query review
-   Scale-up/scale-out documentation

### Phase 17 --- Full Testing

-   End-to-end core flow
-   Load checks
-   Regression testing

### Phase 18 --- Deployment

-   Backend deployment
-   Frontend deployment
-   Production MongoDB
-   HTTPS
-   Monitoring/error logging

### Phase 19 --- Documentation + Polish

-   README
-   API documentation
-   Final UI polish
-   Presentation/demo preparation

------------------------------------------------------------------------

# 51. API Contract Rule

API contracts should be published **before** a module's backend
implementation is finished.

Each endpoint should document:

-   Endpoint
-   HTTP method
-   Request body
-   Response body
-   HTTP status codes
-   Authentication requirement
-   Role requirement
-   Validation errors
-   Error response shape

This allows frontend and backend teammates to work in parallel.

Example:

``` text
POST /api/inventory-batches
GET /api/inventory-batches
GET /api/inventory-batches/:id
PUT /api/inventory-batches/:id
DELETE /api/inventory-batches/:id
```

------------------------------------------------------------------------

# 52. Business Logic Rule

Backend business logic is authoritative.

The frontend must not determine:

-   Expiration status
-   Risk
-   FEFO priority
-   Waste cost
-   Inventory transaction validity
-   Role authorization

Frontend displays server results.

------------------------------------------------------------------------

# 53. Transaction Rule

Usage and Waste are transactions.

Do not treat inventory quantity as a number that users can arbitrarily
edit.

Correct pattern:

``` text
Stock-In
→ increases inventory

Usage
→ decreases inventory + creates UsageRecord

Waste
→ decreases inventory + creates WasteRecord
```

This preserves historical traceability.

------------------------------------------------------------------------

# 54. Team Structure

For seven members:

### 1 Project Manager

-   Coordination
-   Timeline
-   Task assignment
-   Integration
-   Milestone monitoring

### 3 Backend Developers

-   Node.js
-   Express
-   REST APIs
-   Authentication
-   Authorization
-   Business logic
-   MongoDB/Mongoose
-   Validation
-   Security middleware

### 2 Frontend/UI/UX

-   React
-   Dashboard
-   Inventory screens
-   Alerts
-   Forms
-   Analytics visualization
-   Responsive UI

### 1 Documentation Specialist / Systems Analyst

-   Requirements
-   System analysis
-   Documentation
-   Diagrams
-   Testing documentation
-   Traceability

The **team member roles** above are not the same as the application's
four user roles.

------------------------------------------------------------------------

# 55. Important Architecture Distinctions

### Operational database

MongoDB Atlas stores operational/historical records.

### GUI

MongoDB Compass is a database client/inspection tool for Atlas.

### ML training

Python/GPU/Colab performs training and experimentation.

### Model

The trained model is an artifact.

### Inference

The deployed application uses the trained model to generate predictions.

### Forecast result

A prediction may be computed on request or persisted later.

Do not confuse these concepts.

------------------------------------------------------------------------

# 56. AI Lifecycle

``` text
1. Data Generation
   Inventory → Usage → Waste

2. Data Extraction
   MongoDB / Public Dataset

3. Data Cleaning
   Validate → Clean → Transform

4. EDA
   Trends → Seasonality → Outliers → Data quality

5. Baseline
   Average usage × forecast period

6. ML Training
   Train → Validate → Test

7. Evaluation
   Predicted vs Actual → MAE/RMSE

8. Model Selection
   Select acceptable model

9. Deployment
   Model artifact → inference runtime → Express

10. Application
    Forecast → Risk → Recommendation

11. Monitoring
    Actual vs predicted → model performance → retraining decision
```

------------------------------------------------------------------------

# 57. Model Retraining

Automatic continuous retraining is not required for the MVP.

Conceptual future lifecycle:

``` text
Historical Data
 ↓
Train
 ↓
Evaluate
 ↓
Deploy
 ↓
Monitor
 ↓
Enough new data?
 ↓
Retrain when appropriate
```

The retraining schedule remains open.

------------------------------------------------------------------------

# 58. What Is Explicitly NOT Locked Yet

Do not present these as finalized decisions:

-   Exact ML algorithm
-   Exact feature set
-   Exact amount of training data required
-   Exact forecast horizon
-   Exact model format
-   ONNX as a mandatory deployment format
-   Exact inference runtime
-   Forecasts MongoDB collection
-   Forecast persistence strategy
-   Retraining schedule
-   Exact confidence-score implementation
-   Global-state library choice
-   Second public dataset
-   Export formats if the group has not formally approved them
-   Exact MFA implementation details
-   Exact expiration threshold configuration

These must be decided based on actual technical needs, dataset quality,
feasibility, and/or group/professor approval.

------------------------------------------------------------------------

# 59. Dataset Decision in One Sentence

**Start with one strong, relevant, properly licensed public forecasting
dataset for initial AI experimentation; later use ShelfLifeAI's own
Usage Records as the primary operational forecasting source, with Waste
Records as supporting data and Inventory Batches as current
inventory/expiration context.**

------------------------------------------------------------------------

# 60. Current Project State

The project has already established:

- GitHub project and active feature branch workflow
- Figma project
- Expo + React Native + React Native Web + Expo Router + TypeScript frontend
- Static Expo Web baseline
- PWA direction
- Initial authenticated application shell
- Role-specific dashboard component architecture
- Super Admin UI-A working foundation
- Frontend service/API boundaries
- Node.js + Express + TypeScript backend foundation
- MongoDB Atlas + Mongoose integration
- Development authentication/session foundation
- Safe backend startup diagnostics
- MongoDB Compass usage for database inspection
- GPU-laptop Plan A for AI training
- Baseline-first AI methodology
- Exactly four application roles
- Source-of-truth and agent-governance rules

The current implementation priority is to:

1. preserve the actual Expo/client + Express/server repository architecture;
2. keep frontend service/API boundaries ready for real backend data;
3. build backend/database modules in dependency order;
4. complete authentication/RBAC/audit/security foundations before claiming protected feature readiness;
5. continue operational modules before serious ML training;
6. use one strong public dataset when the AI phase begins;
7. establish the statistical baseline before selecting an ML model;
8. evaluate the eventual ML model against the baseline;
9. integrate the selected model without replacing the mandatory MERN backend;
10. refine role-specific UI/UX against the finalized information architecture rather than generic dashboard templates.

------------------------------------------------------------------------

# 61. Documentation Consistency Rule

Every major project document should agree on:

-   Official project name
-   MERN stack
-   Four application roles
-   Core modules
-   Core collections
-   Data relationships
-   AI purpose
-   AI data hierarchy
-   Security architecture
-   PWA/Web Push direction
-   No multi-branch MVP
-   Production folder architecture
-   Open vs finalized technical decisions

If an older document conflicts with the finalized decisions, **the
finalized decision takes precedence**, and the outdated document should
be corrected rather than silently reinterpreted.

------------------------------------------------------------------------

# 62. Superseded Documentation Rule

Older ShelfLifeAI documents remain useful historical references, but they are not co-equal authorities.

Known stale concepts in older materials include, among others:

- Kitchen Staff instead of Inventory Staff
- older Vite-only frontend assumptions
- Tailwind/shadcn/Base UI treated as mandatory
- older `frontend/` / `backend/` folder naming
- missing `changeRequests`
- outdated Ingredient/Waste field names
- ONNX presented too strongly
- a mandatory `forecasts` collection
- outdated role/dashboard ownership
- multi-branch material from older proposals
- Super Admin Reports as a separate sidebar module

When an older document conflicts with this Master, this Master wins. Do not silently merge contradictory requirements.

The implementation priority order for any ambiguity is:

1. this Master;
2. explicit team decisions made after this Master;
3. actual current repository architecture and established contracts;
4. older project documents only where they do not conflict;
5. implementation judgment only for genuinely unspecified technical details.

------------------------------------------------------------------------

# 63. Final Mental Model

The simplest complete picture of ShelfLifeAI is:

``` text
                         SHELFLIFE AI
                              │
                ┌─────────────┴─────────────┐
                │                           │
          APPLICATION                    AI / ML
                │                           │
     React + Native + TypeScript          Python
                │                       GPU Laptop
               PWA                          │
                │                      Public Dataset
             HTTPS                          │
                │                   Data Preparation
       Node.js + Express                    │
                │                       Training
             Mongoose                       │
                │                     Evaluation
        MongoDB Atlas                       │
                │                       Model Artifact
        MongoDB Compass                     │
                │                           │
                └──────── Historical Data ──┘
```

Application request flow:

``` text
React/PWA
 ↓
axiosClient
 ↓
Express REST API
 ↓
Route
 ↓
Controller
 ↓
Service
 ↓
Mongoose
 ↓
MongoDB Atlas
```

AI flow:

``` text
Usage Records
 +
Waste Records
 +
Inventory Batches
 +
Ingredients
 ↓
Data Preparation
 ↓
Baseline / ML Forecast
 ↓
Predicted Consumption
 ↓
Risk Assessment
 ↓
Recommendation
 ↓
Manager / Authorized User
```

------------------------------------------------------------------------

# 64. The One-Sentence Project Explanation

> **ShelfLifeAI is a MERN-based web/PWA decision-support system for
> food-service establishments that manages perishable ingredient
> inventory and batches, records usage and waste, monitors expiration
> and FEFO priority, analyzes historical consumption, and uses
> forecasting to identify inventory/expiration risks and recommend
> actions that can reduce food waste and financial loss.**

------------------------------------------------------------------------

# 65. Final Rule for Future ShelfLifeAI Work

Before implementing any new feature, folder, file, schema, API, UI
element, or AI component, verify:

``` text
Does it match the finalized project scope?
        ↓
Does it match MERN?
        ↓
Does it match the database model?
        ↓
Does it match the API architecture?
        ↓
Does it match the four roles?
        ↓
Does it respect backend business logic?
        ↓
Does it respect the security model?
        ↓
Does it fit the AI pipeline?
        ↓
Does it belong in the production folder structure?
        ↓
If not finalized:
FLAG IT BEFORE IMPLEMENTING.
```

The project should optimize for **consistency, traceability,
feasibility, security, maintainability, and academic defensibility** ---
not merely for making the application appear functional.

CONSISTENCY ARCHITECTURE
                 SHELFLIFE AI
                      │
        ┌─────────────┴─────────────┐
        │                           │
      Design                    Information
      System                     System
        │                           │
   Typography                  Terminology
   Spacing                     Data meaning
   Components                  Roles
   Colors                      Workflows
   States                      Architecture
        │                           │
        └─────────────┬─────────────┘
                      ↓
             Every screen feels
             like ONE product


#   66. FINAL ARCHITECTURE
┌─────────────────────────────────────┐
│             ShelfLifeAI             │
│ AI-Assisted Ingredient Inventory &  │
│ Food Waste Reduction System         │
└─────────────────────────────────────┘
                 │
       ┌─────────┴─────────┐
       ↓                   ↓
   Operations             AI
       │                   │
       ├─ Ingredients      ├─ Forecasting
       ├─ Inventory        ├─ Risk Assessment
       ├─ Stock-In         └─ Forecast History
       ├─ Usage
       ├─ Waste
       ├─ FEFO
       ├─ Expiration
       └─ Change Requests
                 │
       ┌─────────┴─────────┐
       ↓                   ↓
 Reports & Analytics    Security
       │                   │
       ├─ CSV              ├─ Authentication
       ├─ XLSX             ├─ MFA
       └─ PDF              ├─ RBAC
                           ├─ Validation
                           ├─ Rate Limiting
                           └─ Audit 

#       67. TECHNICAL ARCHITECTURE
                         ShelfLifeAI
                              │
             ┌────────────────┴────────────────┐
             │                                 │
          CLIENT                             SERVER
             │                                 │
     Expo + React Native Web             Node.js + Express
          + TypeScript                       + TypeScript
             │                                 │
             │                              Mongoose
             │                                 │
             └──────────── HTTPS ──────────────┘
                                               │
                                         MongoDB Atlas
                                               │
                                           Compass
#       68. TARGET FOLDER STRUCTURE
ShelfLife-AI/
│
├── client/
│   ├── app/ or src/app/
│   ├── components/
│   ├── services/
│   ├── types/
│   ├── hooks/
│   └── ...
│
├── server/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       ├── utils/
│       └── server.ts
│
├── ml/
│   ├── notebooks/
│   ├── data/
│   ├── models/
│   └── README.md
│
├── docs/
├── UI/
├── .gitignore
└── README.md

#       69. NAMING RULES
**React components**
PascalCase:

DashboardHeader.tsx
InventoryTable.tsx
ExpirationAlert.tsx
ManagerSidebar.tsx

**Services**
camelCase:

inventoryService.ts
forecastService.ts
authService.ts
reportService.ts

**API clients**
camelCase:

apiClient.ts
inventoryApi.ts
authApi.ts

**Types**
camelCase filenames when they represent a domain module:

inventory.ts
forecast.ts
user.ts

**TypeScript types/interfaces**
PascalCase

InventoryBatch
InventoryBatchView
Forecast
User

#       Backend
**Routes:**
inventoryBatchRoutes.ts
usageRecordRoutes.ts
wasteRecordRoutes.ts

**Controllers:**

inventoryBatchController.ts
usageRecordController.ts

**Services:**

inventoryBatchService.ts
usageRecordService.ts

**Models:**

InventoryBatch.ts
UsageRecord.ts
WasteRecord.ts
Database fields

Exactly our established convention:

_id
ingredientId
batchCode
quantity
unit
dateReceived
expirationDate
unitCost
createdBy
createdAt
updatedAt

#       70. CORE LANGUAGE
Ingredient
Inventory Batch
Usage
Waste
Expiration
Forecast
Consumption
Change Request
Audit

## 71. Role-Specific Dashboard & UI Behavior — AUTHORITATIVE

This section is the authoritative detailed dashboard/UI behavior specification. It supersedes shorter or older dashboard summaries where wording differs.
## 1. DASHBOARD PRINCIPLE

After successful authentication, every ShelfLifeAI user must be routed to the dashboard corresponding to their authorized role.

The four official authenticated roles remain:

Super Admin
Admin
Manager
Inventory Staff

All four roles use the same ShelfLifeAI application and overall design system; however, their dashboards must not be identical.

Each dashboard exists to answer a different operational question based on the responsibilities of that role. The dashboard must therefore prioritize information, actions, summaries, and alerts that are actually relevant to that user.

The finalized role-specific questions are:

Super Admin

“Is the system secure and operating properly?”

Admin

“Is the establishment's ShelfLifeAI environment properly managed?”

Manager

“What inventory problems require my attention?”

Inventory Staff

“What inventory tasks do I need to perform today?”

These questions should guide dashboard information architecture and UI decisions rather than creating generic dashboards composed only of reusable statistic cards.

The original finalized specification already establishes that every role lands on a dashboard, but that the dashboard is not identical for every role.

## 2. SUPER ADMIN DASHBOARD
Primary Purpose

The Super Admin Dashboard is the system-wide administrative, security, and operational-health overview of ShelfLifeAI.

It answers:

“Is the system secure and operating properly?”

The Super Admin is concerned primarily with the ShelfLifeAI platform itself—not day-to-day restaurant inventory operations.

The finalized dashboard definition identifies system status, administrator accounts, active users/sessions, security events, recent audit activity, and system activity as the information this role should see.

Dashboard Content

The Super Admin Dashboard should be capable of presenting:

System Status

High-level status of the ShelfLifeAI environment, such as:

backend/API availability;
database connectivity where safely exposed;
authentication/security-service readiness;
notification-service readiness where implemented;
general system operational status.

This information must come from legitimate backend/system-health information—not hardcoded frontend values.

Administrator Account Overview

Relevant information about administrative accounts, such as:

total Admin accounts;
active administrative accounts;
disabled administrative accounts;
recently created/modified Admin accounts where appropriate.
Active Users / Sessions

Where session monitoring is implemented, the dashboard may show:

active authenticated sessions;
currently active users;
session/security anomalies where appropriate.

The UI must not expose sensitive session tokens or credentials.

Security Events

Security-relevant information may include:

failed authentication activity;
MFA-related security events;
account lockouts;
rate-limit/security events;
suspicious or denied access attempts where implemented.
Recent Audit Activity

The dashboard may summarize recent protected administrative/system actions from the audit trail.

System Activity

Recent system-level activity relevant to Super Admin oversight may be displayed when supported by actual backend data.

Boundary

The Super Admin Dashboard must not become a Manager inventory dashboard.

It should not prioritize:

predicted ingredient consumption;
expiration-risk forecasts;
FEFO operational recommendations;
today's ingredient usage;
today's ingredient waste;
Stock-In actions.

Those responsibilities belong to operational roles.

## 3. ADMIN DASHBOARD
Primary Purpose

The Admin Dashboard is the establishment-management and master-data overview.

It answers:

“Is the establishment's ShelfLifeAI environment properly managed?”

The finalized specification defines the Admin Dashboard around total users, ingredient records, inventory overview, expiring items, low-stock overview, recent administrative activity, and reports.

Dashboard Content

The Admin Dashboard should be capable of presenting:

User Overview

Examples:

total users;
active users;
users grouped by authorized role where useful;
recently created/updated accounts.
Ingredient Overview

Examples:

total ingredient records;
ingredient categories;
recently created or modified ingredient records;
relevant master-data status.
Inventory Overview

High-level inventory information may include:

active inventory;
current stock overview;
inventory records requiring administrative attention.
Expiring Items Overview

A summarized view of ingredients/batches approaching expiration.

Low-Stock Overview

A summarized view of ingredients below their configured minimum-stock threshold.

Recent Administrative Activity

Examples:

user creation;
account changes;
ingredient/master-data changes;
authorized administrative actions.
Reports

The Admin may access reports appropriate to its authorized scope.

Boundary

The Admin Dashboard should focus on:

users + master data + administrative monitoring + authorized reports

rather than frontline inventory transactions.

The Admin should not be given Inventory Staff quick actions simply because the underlying data is visible.

## 4. MANAGER DASHBOARD
Primary Purpose

The Manager Dashboard is ShelfLifeAI's primary decision-support dashboard.

It answers:

“What inventory problems require my attention?”

This is the dashboard where ShelfLifeAI's forecasting, inventory-risk analysis, expiration-risk assessment, recommendations, and managerial decision support become most visible.

The finalized definition identifies inventory value, low-stock items, expiring items, high-risk items, expiration-risk overview, AI forecast summary, recommended actions, and pending change requests as Manager Dashboard information.

Dashboard Content
Inventory Value

A high-level estimate of the current monetary value of inventory where sufficient cost information exists.

Low-Stock Items

Ingredients whose current stock falls below their configured minimum-stock threshold.

Expiring Items

Inventory batches approaching expiration according to ShelfLifeAI's deterministic expiration-status logic.

High-Risk Items

Ingredients/batches identified as requiring managerial attention based on inventory, expiration, and forecasting/risk logic.

Expiration-Risk Overview

A summarized representation of the current expiration-risk situation.

AI-Assisted Forecast Summary

A dashboard-level summary of forecasting outputs.

This may eventually include:

predicted consumption;
forecast horizon;
potential remaining inventory;
associated inventory/expiration risk.
Recommended Actions

ShelfLifeAI should not merely present:

HIGH RISK

It should provide an understandable operational recommendation.

Examples:

Prioritize Chicken Breast Batch CB-001 before expiration.

or:

Avoid additional stock until current inventory decreases.

The Finalized specification establishes that ShelfLifeAI is intended to provide actionable recommendations rather than only risk labels.

Pending Change Requests

The Manager should see change requests awaiting review.

This provides a direct entry point into the Manager's approval/rejection workflow.

Boundary

The Manager receives decision support.

The AI does not autonomously perform inventory-changing actions.

The flow remains:

Prediction → Risk Assessment → Recommendation → Human Decision

rather than:

Prediction → Automatic Inventory Modification

## 5. INVENTORY STAFF DASHBOARD
Primary Purpose

The Inventory Staff Dashboard is ShelfLifeAI's primary operational/task dashboard.

It answers:

“What inventory tasks do I need to perform today?”

The finalized specification defines this dashboard around active inventory batches, expiring batches, low-stock items, today's usage, today's waste, pending requests, and quick actions.

Dashboard Content
Active Inventory Batches

A practical overview of currently active inventory batches.

Expiring Batches

Inventory batches requiring immediate operational attention because of approaching expiration.

Low-Stock Items

Ingredients that may require attention because their available quantity has fallen below the configured threshold.

Today's Usage

Summary of ingredient usage recorded during the current day.

Today's Waste

Summary of ingredient waste recorded during the current day.

Pending Requests / My Requests

Inventory Staff must be able to see the status of their own submitted change requests.

Examples:

Pending
Approved
Rejected
Quick Actions

The dashboard should provide convenient access to frequent operational transactions:

+ Stock-In

Record Usage

Record Waste

These quick actions must use the real authorized workflows and must not bypass backend validation, RBAC, audit logging, or inventory transaction logic.

Boundary

Inventory Staff should not receive unrestricted:

user administration;
system configuration;
protected security/audit controls;
Manager-level forecasting administration;
approval authority over their own change requests.

## 6. FINAL ROLE-TO-FEATURE TRACEABILITY

The following mapping is the authoritative UI ownership/reference for ShelfLifeAI.

| ShelfLifeAI Capability            | Authorized / Primary UI                           |
| --------------------------------- | ------------------------------------------------- |
| Role-Specific Dashboard           | All four roles                                    |
| Admin Account Management          | Super Admin                                       |
| System Settings                   | Super Admin                                       |
| Security & Activity               | Super Admin                                       |
| Protected System Audit Oversight  | Super Admin                                       |
| User Management                   | Admin                                             |
| Ingredient Management             | Admin                                             |
| Administrative Inventory Overview | Admin                                             |
| Administrative Audit Logs         | Admin                                             |
| Authorized Administrative Reports | Admin                                             |
| Inventory Monitoring              | Manager / Inventory Staff according to permission |
| Inventory Batch Operations        | Inventory Staff; Manager monitoring               |
| Stock-In                          | Inventory Staff                                   |
| Usage Recording                   | Inventory Staff                                   |
| Waste Recording                   | Inventory Staff                                   |
| My Change Requests                | Inventory Staff                                   |
| Change Request Review             | Manager                                           |
| FEFO Monitoring / Priority        | Manager / Inventory Staff                         |
| Expiration Monitoring             | Manager / Inventory Staff                         |
| Low-Stock Monitoring              | Manager / Inventory Staff                         |
| AI-Assisted Forecasting           | Manager                                           |
| Expiration/Inventory Risk         | Manager                                           |
| Recommended Actions               | Manager                                           |
| Alerts                            | Manager                                           |
| Reports & Analytics               | Manager                                           |
| Export                            | Authorized report/audit roles only                |
| Profile                           | All authenticated roles                           |
| Logout                            | All authenticated roles                           |

This matrix refines the earlier finalized mapping that places Ingredient Management under Admin, Stock-In/Usage/Waste under Inventory Staff, forecasting and analytics under Manager, audit records under Admin/Super Admin, and system administration under Super Admin.

RBAC remains the final authority.

A frontend page being visible does not constitute authorization.

## 7. DASHBOARD UX RULE — LOCKED

ShelfLifeAI dashboards must not be designed as arbitrary collections of cards.

For every dashboard component, ask:

“Does this information help this role answer its primary dashboard question?”

If the answer is no, the component should normally not appear on that dashboard.

Therefore:

Super Admin

System/security health → YES
Daily chicken usage → NO

Admin

User/master-data overview → YES
AI forecast decision card → normally NO

Manager

High-risk inventory → YES
Administrator-account security management → NO

Inventory Staff

Today's operational tasks → YES
System-wide security configuration → NO

Shared data does not imply shared presentation.

The same underlying MongoDB data may be used differently depending on the authorized role.

## 8. MANAGER FORECASTING UI CONTRACT

The Manager Forecasting page must eventually support presentation of the following information where scientifically and operationally available:

Ingredient
Current Stock
Forecast Period / Horizon
Predicted Consumption
Potential Remaining Inventory
Inventory / Expiration Risk
Recommendation
Actual Consumption when available
Forecast Error when actual observations become available
Model-performance information where scientifically valid

A conceptual forecast presentation may therefore be:

Chicken Breast

Current Stock: 20 kg
Predicted Consumption: 18.5 kg
Forecast Period: Next 4 days
Potential Remaining: 1.5 kg
Risk: Moderate
Recommendation: Prioritize Batch CB-001 before expiration.

The Finalized specification explicitly anticipates this form of Manager-facing forecast presentation.

Frontend Development Rule

During frontend development, mock forecast data may be used to establish layout and component behavior.

However:

Mock forecast values must never be represented as actual AI predictions.

The production UI must obtain real forecast information through the forecasting service/API boundary once the forecasting backend becomes available.

The existing UI should not require redesign merely because mock data is replaced with API data. The intended progression remains:

Mock UI Data → Express API → Forecasting Service → Real Prediction

as already established in the finalized design.

## 9. AI SYSTEM RESPONSIBILITY BOUNDARY

ShelfLifeAI's AI component has a deliberately narrow responsibility.

The AI is intended primarily to:

forecast future ingredient consumption based on historical consumption patterns.

The AI does not determine factual expiration dates.

The backend already knows:

expirationDate − current server date = remaining shelf life

The AI instead helps answer:

“Based on historical consumption patterns, how much of this ingredient are we likely to consume over the relevant future period?”

The resulting prediction is compared with:

current inventory;
remaining shelf life;
inventory context;

to support risk assessment and recommendation generation.

The finalized specification explicitly separates forecasting future consumption from deterministic expiration calculations.

## 10. DO NOT CONFUSE THE FOUR AI LAYERS

The following concepts must remain separate in ShelfLifeAI documentation and implementation.

A. Historical / Operational Data

Stored primarily in MongoDB Atlas.

Examples:

Ingredients
Inventory Batches
Usage Records
Waste Records
Audit Records

Usage Records remain the primary historical forecasting source.

Waste Records provide supporting historical context.

Inventory Batches provide current quantity and expiration context.

Ingredients provide reference/master information.

B. AI Training / Experimentation

Performed separately from the production MERN application.

The planned training environment may include:

Python + Google Colab / appropriate local training environment

This environment is responsible for:

data extraction;
preprocessing;
exploratory data analysis;
feature engineering;
baseline creation;
model training;
validation;
testing;
evaluation;
model export.
C. Trained Model Artifact

Training produces a separate deployable model artifact.

The model artifact is not:

MongoDB;
the training dataset;
the Colab notebook;
the Python training script.

It is the trained result that can later be loaded for inference.

The exact artifact format remains intentionally unresolved until the model is selected.

D. Forecast Output

Forecast outputs are predictions generated by the trained model.

Example:

Predicted consumption: 18.5 kg

Forecast outputs may either:

be computed on request; or
be persisted in MongoDB.

That implementation decision remains open.

The Finalized document explicitly distinguishes historical data, training code, trained model artifact, and forecast results.

## 11. AI DATA-ACCESS SECURITY BOUNDARY

The forecasting/AI layer must follow least-privilege principles.

The AI/inference component should receive only the information required to perform its forecasting function.

The AI layer must not be unnecessarily exposed to:

MongoDB credentials;
authentication secrets;
JWT signing secrets;
MFA secrets;
unrestricted database access;
unnecessary personally identifiable user information;
internal server paths;
unrestricted administrative information;
unnecessary model internals.

The expected application flow is:

React / Client

↓

Authenticated + Authorized Express Endpoint

↓

Required Data Retrieval

↓

Forecasting / AI Inference

↓

Prediction

↓

Deterministic Risk Logic

↓

Recommendation

↓

Authorized Manager UI

The AI remains human-in-the-loop.

It may:

predict + flag + recommend

It must not independently:

create + update + delete inventory

The finalized system explicitly requires restricted AI data access and preserves human decision authority.

## 12. BASELINE-FIRST FORECASTING RULE

ShelfLifeAI must maintain the previously agreed baseline-first methodology.

Before claiming that an ML model improves forecasting, establish a simple statistical baseline.

Initial baseline:

Expected Usage = Average Historical Usage × Forecast Period

Then:

Potential Remaining = Current Quantity − Expected Usage

Example:

Average Daily Usage = 5 kg

Forecast Period = 4 days

Expected Usage:

5 × 4 = 20 kg

Current Quantity = 25 kg

Potential Remaining:

25 − 20 = 5 kg

An eventual ML forecasting model must be evaluated against this baseline rather than merely being accepted because it is an “AI model.”

The finalized roadmap explicitly establishes this baseline-first methodology.

## 13. AI DECISIONS THAT REMAIN OPEN

The following must not be invented or prematurely frozen by a coding agent:

exact ML algorithm;
exact feature set;
exact amount of training data required;
exact forecast horizon;
exact trained-model file format;
ONNX versus another deployment mechanism;
exact inference runtime;
whether forecast results are persisted;
exact retraining schedule;
exact confidence-score implementation.

These decisions must be made after inspecting the actual dataset and evaluating candidate approaches.

This is explicitly the distinction between ShelfLifeAI's locked AI architecture and its not-yet-locked implementation decisions.

Therefore, Claude, Codex, or another implementation agent must not silently choose any of these technologies or methodologies and present them as agreed project requirements.

## 14. REPORT EXPORT — AUTHORIZED CAPABILITY

ShelfLifeAI may support controlled export/download functionality as part of Reports & Analytics and authorized Audit Log workflows.

Potential report types include:

Forecast Reports
Inventory Analytics
Usage Analytics
Waste Analytics
Expiration Analytics
Audit Logs for authorized roles

Exports should support appropriate filters such as:

date range;
ingredient;
category;
inventory status;
risk level;
waste reason;
user/action for audit data.

Potential formats include:

CSV
XLSX
PDF

The finalized specification establishes these three formats as serving different purposes: CSV for raw/analytical data, XLSX for business analysis, and PDF for formal reporting.

Export Security

Export authorization must be enforced by RBAC.

Sensitive exports—especially Audit Logs—require stronger permissions.

An export of protected information should itself create an Audit Record where applicable.

Conceptually:

Authorized User

↓

Export Request

↓

RBAC Check

↓

Filtered Data Retrieval

↓

Report Generation

↓

Download

↓

EXPORT Audit Record

The Finalized specification explicitly requires audit-log exports themselves to be auditable.

Prohibited Ordinary Export

Ordinary users must not receive a generic:

Download Entire Database

capability.

ShelfLifeAI exports logical, authorized reports—not unrestricted database dumps.

## 15. PUBLIC DATASET / TRAINING-DATA RULE

ShelfLifeAI may use a legitimate public dataset during initial AI development if sufficient real ShelfLifeAI operational history is unavailable.

A candidate public dataset must be evaluated based on:

temporal/date information;
relevance to consumption/demand forecasting;
measurable quantity;
sufficient historical coverage;
understandable units;
licensing;
defensible mapping to ShelfLifeAI.

A dataset should not be selected merely because its title contains “food,” “restaurant,” or “inventory.”

Restaurant sales data is not automatically equivalent to ingredient-consumption data.

The finalized dataset criteria specifically require temporal information, measurable demand/consumption, usable quantity, sufficient history, understandable units, licensing, and defensible mapping to ShelfLifeAI.

If public data is used, project documentation must clearly state that fact.

ShelfLifeAI must not claim that externally sourced or synthetic information represents actual operational history generated by ShelfLifeAI.

The intended progression is:

Public Dataset

↓

Initial Forecasting Experimentation

↓

Initial Model

↓

ShelfLifeAI Operational Data

↓

Validation / Future Retraining

↓

ShelfLifeAI-Specific Forecasting Model

The application's own Usage Records remain the conceptual primary forecasting source once sufficient operational data exists.

## 16. DATA QUALITY REQUIREMENTS FOR FORECASTING

Before training, ShelfLifeAI's AI workflow must consider:

missing records;
duplicate records;
invalid quantities;
inconsistent units;
incorrect dates;
impossible values;
invalid ingredient references;
outliers;
potential seasonality;
cold-start ingredients;
time-series leakage.

The finalized specification explicitly identifies these as important considerations before model training.

Time-Series Evaluation Rule

Forecasting data must preserve temporal order.

Future information must not be allowed to leak into training data used to predict the past.

The principle is:

PAST → FUTURE

not:

FUTURE → PAST

A time-aware train/validation/test split should therefore be used when appropriate.

## 17. SUPER ADMIN REPORTS — CONFLICT RESOLUTION

An inconsistency exists in the older Finalized ShelfLifeAI material.

One earlier navigation draft includes:

Super Admin

Dashboard
Admin Accounts
System Settings
Security & Activity
Reports

However, the later consolidated “Complete Final Structure” defines:

Super Admin

Dashboard
Admin Accounts
System Settings
Security & Activity
Profile
Logout

MASTER RESOLUTION

The later consolidated structure takes precedence.

Therefore, the official Super Admin sidebar is:

Dashboard

Admin Accounts

System Settings

Security & Activity

Profile

Logout

There is no separate Super Admin Reports sidebar module in the current approved baseline.

If security/system information needs export functionality, it may be provided contextually inside an authorized Security & Activity/Audit interface rather than creating an additional navigation module.

This may only change through an explicit future group decision.

## 18. FRONTEND ARCHITECTURE — SUPERSESSION RULE

Older ShelfLifeAI documentation contains frontend references such as:

React + Vite;
React + Vite + TypeScript;
Tailwind;
shadcn/ui;
earlier web-only/PWA architecture assumptions.

These references represent earlier implementation directions and must not override the current repository architecture.

CURRENT IMPLEMENTATION BASELINE

The current ShelfLifeAI frontend architecture established by the working repository and Master is authoritative.

Where an older Finalized section conflicts with the newer approved implementation baseline:

Current Master + actual repository architecture take precedence.

Older Vite/shadcn/Tailwind references may still provide design or conceptual context where useful, but they must not be interpreted by Claude, Codex, or developers as mandatory dependencies unless they are explicitly present in and approved for the current project.

This prevents an implementation agent from attempting to migrate or rebuild the application around an obsolete frontend stack.

## 19. PRODUCTION UI DATA RULE

All dashboard statistics, tables, alerts, summaries, forecasts, reports, and operational information must eventually be backed by legitimate system data.

During UI development, temporary mock data may be used only when necessary to establish layout and interaction.

However:

Mock data is a development scaffold—not the production data architecture.

Production flow should follow:

MongoDB

↓

Mongoose

↓

Express REST API

↓

Frontend Service/API Layer

↓

Role-Specific UI

For example, inventory data should follow the already established separation between MongoDB storage structure and frontend/API representation. The Finalized implementation notes explicitly define the intended MongoDB → Mongoose → Express → API response → frontend-service → page flow.

A coding agent must therefore not permanently embed fabricated:

system-health values;
inventory counts;
user counts;
audit events;
forecast predictions;
waste values;
risk values;

inside production dashboard components.

## 20. UI CONSISTENCY RULE

ShelfLifeAI must maintain a shared visual hierarchy across all roles and modules.

The semantic typography hierarchy includes:

Page Title

↓

Page Description

↓

Section Title

↓

Body Text

↓

Supporting / Muted Text

↓

Numeric Values

↓

Table Text

The same semantic element should receive the same visual treatment throughout:

Dashboard
Inventory
Usage & Waste
Forecasting
Alerts
Reports & Analytics
User Management
Security & Activity
other ShelfLifeAI modules.

The Finalized frontend direction explicitly establishes this reusable typography hierarchy instead of deciding arbitrary font sizing independently on every page.

The same principle applies to:

spacing;
card hierarchy;
borders;
tables;
buttons;
status badges;
forms;
dialogs;
navigation;
responsive behavior.

Role-specific dashboards may differ in content, but they must still visibly belong to one ShelfLifeAI system.

## 21. AUTHORITATIVE IMPLEMENTATION RULE FOR CODING AGENTS

When Claude, Codex, or another coding agent implements ShelfLifeAI, it must follow this priority order:

1. MASTER AGREED PROJECT SUMMARY

↓

2. Explicit decisions made by the team after the Master

↓

3. Actual current repository architecture and established contracts

↓

4. Older Finalized ShelfLifeAI material only where it does not conflict with #1–#3

↓

5. Agent implementation judgment only for genuinely unspecified technical details

An agent must not:

invent new roles;
invent sidebar modules;
silently change RBAC;
move features between roles;
change the AI's purpose;
select an unapproved ML model as final;
replace MERN architecture;
bypass the service/API boundary;
invent production data;
create new business workflows because they “look useful”;
alter approved terminology;
silently revive superseded requirements.

If a requirement is ambiguous or contradictory, the agent should identify the conflict rather than silently choosing one interpretation.

## 22. FINAL ROLE EXPERIENCE — LOCKED

The four dashboards can be reduced to this mental model:

SUPER ADMIN

SYSTEM

Is ShelfLifeAI secure, configured, and operating properly?

ADMIN

MANAGEMENT

Is the establishment's ShelfLifeAI environment properly managed?

MANAGER

DECISION

What inventory problems require my attention, and what should I do about them?

INVENTORY STAFF

ACTION

What inventory work do I need to perform today?

That distinction should remain visible throughout ShelfLifeAI's UX.

## 23. FINAL SHELFLIFEAI PRODUCT LOOP

The system remains centered on the closed decision-support cycle already established in the Finalized specification:

Manage

→ Monitor

→ Record

→ Analyze

→ Forecast

→ Alert

→ Act

→ Measure

→ Learn

Every major module should contribute meaningfully to this loop.

ShelfLifeAI is therefore not:

just CRUD;

not:

just an inventory website;

and not:

an AI model with an interface wrapped around it.

It is a role-controlled inventory and decision-support system in which operational records create historical data; historical data supports forecasting; forecasting supports inventory and expiration-risk assessment; risk information produces recommendations; authorized humans act on those recommendations; and subsequent usage/waste outcomes become new historical information.

------------------------------------------------------------------------

# 72. Implementation Standards & Professional Coding Etiquette — LOCKED

These standards govern all ShelfLifeAI implementation work performed by team members, Codex, Claude Code, or any other coding agent.

The goal is not merely to produce code that appears to work. ShelfLifeAI work must remain **reviewable, traceable, secure, maintainable, minimally surprising, and professionally integrated**.

## 72.1 Source-of-truth first

Before editing code, the implementer must:

1. read the relevant section of this Master;
2. inspect the current repository structure and existing contracts;
3. identify the exact milestone/scope being changed;
4. check for conflicts with established architecture, RBAC, terminology, security rules, or open decisions;
5. flag ambiguity before implementation instead of silently inventing a requirement.

A coding agent must not substitute generic "best practices" for explicit ShelfLifeAI decisions when the two differ.

## 72.2 Minimal-scope implementation

Every change must be limited to the approved task boundary.

Do not:

- refactor unrelated files "while already here";
- rename unrelated symbols;
- move established files without a concrete architectural reason;
- introduce new dependencies for convenience when the current stack already solves the problem;
- rewrite working authentication, backend, PWA, or routing behavior during a UI-only task;
- alter APIs, schemas, RBAC, business rules, or data contracts unless the task explicitly requires it;
- silently fix unrelated issues and mix them into the same commit.

If a separate problem is discovered, report it and propose a separate fix/commit boundary.

## 72.3 Production structure first

New code must follow the production-oriented architecture already established.

Frontend:

``` text
Page / Route
    ↓
Component
    ↓
Service / API boundary
    ↓
Express API
```

Backend:

``` text
Route
    ↓
Controller
    ↓
Service
    ↓
Validation / Business Logic
    ↓
Mongoose Model
    ↓
MongoDB Atlas
```

Do not create throwaway prototypes that later require architectural relocation.

## 72.4 No fabricated production behavior

A production component must not permanently contain fabricated:

- user counts;
- inventory counts;
- system-health values;
- database status;
- security events;
- audit entries;
- forecast predictions;
- waste values;
- risk scores;
- readiness states.

Temporary mock data is allowed only for isolated UI development through the same service/API boundary that real data will later use, and it must be clearly identified as mock/development data.

"Unavailable", "not implemented", or an honest empty state is preferable to fake functionality.

## 72.5 Professional commenting standard

ShelfLifeAI source code must contain **short, concise, clear, purposeful comments where they add real understanding**.

Comments should explain:

- non-obvious business logic;
- security boundaries;
- authorization/session assumptions;
- why a validation or guard exists;
- important data-flow boundaries;
- intentionally unavailable/mock states;
- subtle accessibility/focus behavior;
- unusual technical constraints or compatibility workarounds.

Comments should **not**:

- narrate obvious syntax line by line;
- repeat the function name in prose;
- explain trivial assignments;
- become essays inside source files;
- preserve outdated behavior as commented-out dead code;
- include secrets, tokens, credentials, or sensitive values.

The standard is: **comment the why, boundary, or non-obvious consequence—not the obvious what.**

## 72.6 Naming and readability

Use the naming conventions already defined in this Master.

Code should favor:

- descriptive names over cryptic abbreviations;
- small, cohesive functions/components where practical;
- explicit types at important contracts;
- consistent terminology with ShelfLifeAI domain language;
- predictable control flow;
- reuse of shared primitives instead of duplicate styling/components;
- clear separation between UI state and authoritative backend state.

Do not rename domain concepts merely for stylistic preference.

## 72.7 Error handling and diagnostics

Errors must be useful to developers while remaining safe for users and logs.

Backend diagnostics may identify:

- failing stage;
- allowlisted error name/code;
- safe configuration context;
- affected service or port.

They must not expose:

- stack traces to untrusted clients;
- passwords;
- JWTs;
- private keys;
- database credentials;
- raw connection strings;
- secrets from environment variables;
- unrestricted internal paths when unnecessary.

Generic failures should be improved with safe diagnostics when the lack of context blocks debugging.

## 72.8 Security is not optional polish

Security controls belong in architecture and implementation—not as visual decoration.

At minimum, implementation must respect:

- authentication;
- RBAC;
- server-side authorization;
- validation/sanitization;
- password hashing;
- protected secrets;
- rate limiting/security headers where implemented;
- safe CORS;
- auditability;
- least privilege;
- server-authoritative derived values.

A disabled/hidden frontend button is not authorization. The backend remains authoritative.

No UI may claim MFA, HTTPS, database telemetry, notification readiness, session monitoring, or security-service health unless the underlying capability is genuinely implemented and verified.

## 72.9 Dependency discipline

Do not install or upgrade packages merely because a newer version exists.

A dependency change must have a concrete implementation reason and must be reviewed for:

- compatibility;
- security;
- bundle/runtime impact;
- Expo/React Native Web compatibility;
- Node compatibility;
- lockfile changes;
- effect on existing tests/builds.

Unrelated Expo/package update notices do not justify changing dependencies during another milestone.

The currently validated local Node development baseline is **Node.js 24.20.0**. Do not silently switch Node major versions during verification.

## 72.10 Installed skills/plugins and external coding tools

Approved installed skills/plugins may be used to improve UI/UX, Expo implementation, testing, accessibility, or security review.

However:

``` text
ShelfLifeAI Master
    ↓
Explicit team decisions
    ↓
Current repository/contracts
    ↓
Approved tool/skill guidance
    ↓
Agent judgment
```

A plugin, skill, design heuristic, linter suggestion, or external coding agent must never override ShelfLifeAI scope, role ownership, terminology, architecture, or security decisions.

Tools are advisors and execution aids—not project authorities.

## 72.11 Accessibility and responsive behavior

Interactive UI work should preserve:

- keyboard access where applicable;
- visible focus behavior;
- logical tab/focus order;
- meaningful labels;
- semantic status communication that does not rely on color alone;
- responsive layouts without horizontal overflow;
- usable mobile-width behavior;
- accessible modal/drawer focus handling where implemented.

Accessibility fixes must not silently change business behavior.

## 72.12 Preserve working behavior

Before changing a working module, identify what must remain invariant.

Examples:

- existing login/authentication behavior;
- session restoration;
- logout;
- role routing;
- backend API contracts;
- PWA/export behavior;
- database model semantics;
- security checks.

Refactoring is not considered successful if the visual result improves but a protected behavior regresses.

------------------------------------------------------------------------

# 73. Git, Commit, and Review Discipline — LOCKED

## 73.1 Never stage or commit without approval

For agent-assisted ShelfLifeAI work, the default is:

**edit → verify → report → manual review → explicit approval → stage/commit**

Codex, Claude Code, or another agent must not stage or commit changes unless explicitly instructed to do so.

Before requesting approval, report:

- exact files changed;
- exact files added/deleted;
- verification performed;
- remaining limitations;
- `git status --short`;
- proposed commit boundary;
- proposed concise commit message.

## 73.2 Atomic commits

A commit should represent one coherent change.

Examples:

``` text
feat: add development login and session foundation
fix: add safe backend startup diagnostics
feat: establish authenticated shell and Super Admin dashboard
```

Do not combine:

- UI redesign;
- unrelated backend diagnostics;
- dependency upgrades;
- formatting unrelated files;
- security changes;

into one commit merely because they happened in the same work session.

## 73.3 Never hide unrelated changes

Before staging, compare the intended boundary with the working tree.

If unrelated files are present:

- leave them unstaged;
- stash/checkpoint them when necessary for experiments;
- or separate them into a later reviewed commit.

Do not use broad staging commands carelessly when the working tree contains unrelated work.

## 73.4 Checkpoints before agent experiments

When comparing Codex, Claude Code, or another tool on the same UI:

1. create a named stash/checkpoint of the current uncommitted implementation;
2. verify the stash exists;
3. apply/restore the baseline intentionally when needed;
4. compare only the intended files/results;
5. do not accidentally merge two agents' versions into one unreviewed state.

The checkpoint exists to make experimentation reversible.

## 73.5 Private/local-only files

`open_router.py` is a **local-machine-only private helper**.

It must:

- remain untracked;
- not be staged;
- not be committed;
- not be uploaded to the repository;
- not be added to a tracked project ignore file solely to reveal its existence.

Local exclusion should use the developer's local Git metadata such as `.git/info/exclude` when appropriate.

The same principle applies to other explicitly private local helper files.

## 73.6 Environment files and secrets

Real secret-bearing environment files such as `server/.env` must remain ignored and untracked.

Safe `.env.example` files may document required variable names and placeholders, but must never contain real:

- passwords;
- JWT secrets;
- API keys;
- MongoDB credentials;
- MFA secrets;
- private URLs containing credentials.

When an agent needs a secret value, it should ask the developer to place it locally; the secret itself should not be repeated into chat, logs, commits, tests, screenshots, or documentation.

------------------------------------------------------------------------

# 74. Verification Standard Before Review or Commit — LOCKED

A change is not ready merely because TypeScript compiles.

Verification must be proportionate to the changed surface.

## 74.1 Baseline checks

Where applicable:

- root/client/server TypeScript typechecks;
- server production build;
- relevant automated tests;
- Expo export/build check;
- `git diff --check`;
- browser runtime console check;
- targeted API tests;
- targeted accessibility/keyboard checks;
- responsive/overflow checks.

## 74.2 Authentication-sensitive changes

Verify at minimum, where applicable:

- valid login;
- invalid password rejection;
- unknown user rejection;
- domain restrictions;
- session restoration;
- `/api/auth/me`;
- logout;
- inactive/deleted-account behavior;
- malformed/tampered/expired token rejection;
- role data sourced authoritatively from the backend.

## 74.3 UI changes

Verify at representative widths:

- wide desktop;
- laptop;
- collapsed sidebar;
- tablet;
- approximately 390px mobile.

Also check:

- no horizontal overflow;
- account/menu fit;
- navigation clarity;
- focus restoration for drawers/modals;
- keyboard interaction where applicable;
- honest loading/error/unavailable states;
- no browser JavaScript errors.

## 74.4 Backend changes

Verify:

- startup;
- database/config stage;
- listener stage;
- failure diagnostics;
- port-conflict behavior where relevant;
- no secret leakage;
- existing auth/foundation regression tests.

## 74.5 Report truthfully

Never report a check as passed unless it was actually run successfully.

If a check cannot be run, state that explicitly.

------------------------------------------------------------------------

# 75. Implementation Completion Report — REQUIRED FORMAT

At the end of an implementation milestone, the implementer/agent should provide a concise professional report containing:

1. **What changed**
2. **What did not change**
3. **Exact files changed**
4. **Verification performed and results**
5. **Known limitations / deferred work**
6. **Current `git status --short`**
7. **Proposed commit boundary**
8. **Proposed commit message**
9. **Explicit statement that nothing was staged/committed unless approval was given**

Avoid marketing language such as "production perfect", "fully secure", or "complete" unless the claim is genuinely supported.

------------------------------------------------------------------------

# 76. Final Professional Engineering Principle

ShelfLifeAI development should follow this standard:

``` text
Understand
    ↓
Scope
    ↓
Inspect
    ↓
Implement minimally
    ↓
Comment purposefully
    ↓
Verify
    ↓
Report truthfully
    ↓
Review
    ↓
Commit deliberately
```

The professional standard is not "make as many changes as possible."

It is:

> **Make the smallest correct change that preserves the agreed architecture, can be explained, can be reviewed, can be tested, and can be safely integrated by the team.**

That standard applies equally to human developers and coding agents.
