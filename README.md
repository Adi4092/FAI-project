# MedStock AI — Smart Medicine Inventory & Expiry-Risk Management System

> **Fundamentals of Artificial Intelligence (FAI) Project**  
> An explainable, AI-powered pharmaceutical inventory intelligence system providing batch-level tracking, First-Expiry-First-Out (FEFO) dispensing, censored-demand machine learning forecasting, and predictive replenishment workflows for healthcare facilities.

---

## 1. System Architecture

MedStock AI is designed with clean architectural boundaries and strict tier isolation:

```
┌────────────────────────────────┐
│   Vite + React 19 Frontend     │  (Port 5173 - Tailwind CSS v3, Recharts, Lucide)
└──────────────┬─────────────────┘
               │  HTTP / JSON + Double-Submit CSRF + SameSite Cookies
               ▼
┌────────────────────────────────┐
│      Express 4.21 Backend      │  (Port 5000 - Mongoose 8, Zod Validation, RBAC)
└───────┬────────────────┬───────┘
        │                │
        │ MongoDB Wire   │ Native Node fetch (Timeout & 503 circuit-breaker)
        ▼                ▼
┌──────────────┐  ┌────────────────────────────────┐
│ MongoDB      │  │      FastAPI AI Service        │  (Port 8000 - Scikit-Learn 1.6,
│ Atlas        │  │ (Stateless, no DB credentials, │   Random Forest, Joblib models)
└──────────────┘  │  censored demand masking)      │
                  └────────────────────────────────┘
```

---

## 2. Project Status & Roadmap

| Phase | Milestone | Scope & Deliverables | Status |
|:---:|---|---|:---:|
| **1** | Architecture & Contract | ER diagrams, route specifications, API schema contract (`docs/api-contract.md`) | ✅ **Completed** |
| **2** | Frontend Foundation | Vite, React 19, Tailwind tokens, navigation layouts, common UI components | ✅ **Completed** |
| **3** | Core Inventory Backend | Mongoose models, transactions, FEFO allocation, append-only stock ledger | ✅ **Completed** |
| **4** | Inventory UI Integration | Medicines catalogue, active/quarantined batches, stock ledger table & CSV export | ✅ **Completed** |
| **5** | Machine Learning Service | Synthetic data generator, recursive lag features, Random Forest, pytest suite | ✅ **Completed** |
| **6** | Inventory Intelligence | Demand forecasting, day-by-day FEFO expiry simulation, stockouts & reorders | ✅ **Completed** |
| **7** | Enterprise Operations | Purchase orders lifecycle, 9 analytical reports, notifications, users RBAC, CSV import | ✅ **Completed** |
| **8** | Integration & Final QA | Cross-system validation, security audit, test suite verification, reconciliation | ✅ **Completed** |

---

## 3. Quick Start (One-Click Launch on Windows)

The project includes root Windows batch automation to launch and terminate all tiers cleanly:

### 1. Launch All Three Services
Double-click `start-all.bat` or run from PowerShell / Command Prompt:
```cmd
.\start-all.bat
```
This script:
1. Validates all prerequisites (`ai-service\.venv`, `server\node_modules`, `client\node_modules`, `server\.env`).
2. Opens three titled, persistent command windows:
   - `"AI Service (8000)"` running FastAPI via Uvicorn.
   - `"Server (5000)"` running Express API dev server.
   - `"Client (5173)"` running Vite React dev server.
3. Automatically opens `http://localhost:5173` in your default browser.

### 2. Cleanly Terminate All Services
Double-click `stop-all.bat` or run:
```cmd
.\stop-all.bat
```
*(Scans listening ports 8000, 5000, and 5173 and terminates only their specific PIDs, without affecting unrelated system processes).*

---

## 4. Manual Setup & Independent Execution

If running services individually:

### AI Forecasting Service (`ai-service/`)
```cmd
cd ai-service
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn app.main:app --reload --reload-dir app --port 8000
```
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Swagger OpenAPI Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Express API Backend (`server/`)
```cmd
cd server
npm install
copy .env.example .env
npm run seed              # Seed initial database & reconcile ledger
npm run dev
```
- API Base: `http://localhost:5000/api`
- Health Check: [http://localhost:5000/health](http://localhost:5000/health)

### React Frontend Client (`client/`)
```cmd
cd client
npm install
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## 5. Seeded Demo Accounts & RBAC Matrix

The system includes three pre-configured accounts (`password123` for all):

| Account Email | Role | Permissions & Access Scope |
|---|---|---|
| `admin@medstock.local` | **Admin** | Full system access: User & Role management, Audit Logs, System Settings, CSV Intake, and all operational pages. Protected against last-admin demotion/removal. |
| `manager@medstock.local` | **Inventory Manager** | Operational management: Medicines & Suppliers CRUD, Dispensing, Stock Adjustments, Write-Offs, AI Forecasting, Expiry-Risk review, Purchase Order creation/approval/receiving, Reports. |
| `staff@medstock.local` | **Staff** | Routine clinic tasks: Inventory viewing, FEFO Dispensing, Stock Receiving, Stock Return requisition. Restricted from PO approvals, Users, Settings, and Reports. |

---

## 6. End-to-End Operational Workflows (Section 15)

1. **Onboard Data (Admin):**
   - Log in as `admin@medstock.local`.
   - Navigate to **Settings $\rightarrow$ Data Import** tab.
   - Download sample CSV templates (`medicines.csv`, `batches.csv`, `daily_usage.csv`).
   - Drag-and-drop a file to run the pre-commit validation preview table; inspect accepted/rejected rows, then click **Commit Import** to atomically persist records and generate reconciling opening ledger entries.
2. **Daily FEFO Dispensing (Staff / Manager):**
   - Navigate to **Batches & Inventory**, click **Dispense**.
   - Select a medicine and enter the requested quantity. The interactive FEFO plan calculates allocations across the earliest-expiring active batches and projects post-dispense balances.
   - Expired batches are strictly excluded. Submitting updates batch current quantities, appends immutable `dispense` entries to `StockMovement`, increments `DailyUsage`, and checks reorder levels.
3. **AI Demand Forecasting (Manager / Admin):**
   - Navigate to **Forecasting**, select a medicine and forecast horizon (7, 15, or 30 days).
   - Click **Generate Forecast**. The Express backend extracts historical usage, calls FastAPI (`POST /forecast`), and renders recursive multi-step predictions against historical trends with out-of-sample WAPE/MAE metrics.
   - Previous forecasts are saved in database history and can be reopened instantly without re-calling the AI service.
4. **Expiry-Risk Simulation (Manager / Admin):**
   - Navigate to **Expiry Risk**, toggle review windows (7, 30, 60, 90 days), and review risk classifications (Critical, High, Medium, Low).
   - Click **Why Flagged?** to inspect daily FEFO depletion calculations, projected leftover units, and suggested non-clinical actions.
5. **Replenishment Lifecycle (Manager / Admin):**
   - Navigate to **Reorders** to review AI-generated purchase recommendations.
   - Click **Why this quantity?** to see the full formula breakdown (`ROP = d_L + SS`, order target, MOQ rounding).
   - Click **Approve** $\rightarrow$ automatically creates a draft Purchase Order (`PO-YYYY-XXXX`).
   - Open **Purchase Orders**, review line items, and click **Submit for Approval** (generates a `PO_PENDING` alert) $\rightarrow$ click **Approve Order**.
   - Upon supplier delivery, click **Receive Stock**, enter delivery quantities, lot batch numbers, and expiry dates $\rightarrow$ idempotent stock receipt creates new `Batch` documents and `receipt` ledger movements.
6. **Quarantined Batch Write-Off (Manager / Admin):**
   - In **Batches & Inventory**, switch to the **Expired Batches** tab.
   - Select an expired batch and click **Write-Off** with a mandatory reason.
   - The batch is closed out (`status: 'written_off'`), recorded in the ledger, and appears under **Reports $\rightarrow$ Wastage Analysis** as realized wastage.
7. **Audit & Reconciliation (Admin):**
   - Navigate to **Users $\rightarrow$ Audit Logs** to review append-only trails of user logins, role modifications, and inventory adjustments.
   - View **Stock Movements** to inspect the immutable ledger or click **Export CSV**.
   - In **Inventory**, run **Reconcile Ledger** to verify that batch balances match movement sums with 0 discrepancies.

---

## 7. Automated Test Suites & Verification

MedStock AI is covered by comprehensive unit, integration, and ML property tests:

| Component | Test Runner | Test Files | Total Tests | Status |
|---|---|:---:|:---:|:---:|
| **Backend API** | Vitest (`cd server && npm test`) | 5 files | **41 passed** | ✅ Clean (In-Memory MongoDB Replica Set) |
| **AI Service** | Pytest (`cd ai-service && pytest`) | 8 files | **31 passed** | ✅ Clean (Masking, No-Leakage, Recursive, Expiry) |
| **Frontend Client** | Vitest (`cd client && npm test`) | 3 files | **21 passed** | ✅ Clean (Forms, Route Guards, Filter Logic) |
| **Frontend Build** | Vite Build (`cd client && npm run build`) | — | 0 errors | ✅ Production Bundle Compiled Cleanly |

---

## 8. Security & Compliance Checklist (Section 20)

- **Password Hashing:** Passwords hashed with `bcryptjs` (salt cost 12); password hashes are never returned in responses or logs.
- **Session Security:** JWT stored in `httpOnly`, `SameSite=Lax`, `secure` cookies with automatic refresh token rotation.
- **CSRF Protection:** Double-submit cookie verification (`csrf_token` cookie vs `X-CSRF-Token` header) enforced on all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **HTTP Security:** `helmet` headers enabled; CORS restricted to `CLIENT_ORIGIN`; global rate limiter plus stricter auth endpoint rate limiter.
- **Input Validation & NoSQL Injection Defense:** All incoming requests parsed through strict Zod schemas, stripping unrecognized properties and validating types.
- **Zero Information Leakage:** Centralized error handling returns clean JSON error envelopes with zero stack traces in production.
- **Least-Privilege Database & Test Isolation:** Tests strictly execute on an isolated, in-memory replica set (`medstock_test`) with fail-safes preventing any test from touching the production/development database.
- **Last-Admin Protection:** Administrative API prevents deactivating, demoting, or deleting the last active system administrator.

---

## 9. Disclosures, Limitations & Synthetic Data Notice (Section 22)

> [!WARNING]
> **Synthetic Data & Model Generalization Notice:**
> - MedStock AI was developed and validated on **synthetic hospital consumption data** (generated with fixed seed 42 across 30 medicines over 410 days). Performance and metrics achieved on synthetic series do not prove or guarantee performance on real hospital procurement data.
> - **Probabilistic Decision Support Only:** Demand forecasts, stockout projections, and expiry risk predictions are probabilistic mathematical estimates. They do not constitute clinical guidance, replace professional human judgement, or substitute for regulatory pharmacy compliance.
> - **Censored Demand Limitation:** When stockouts occurred historically, true demand was censored. While MedStock AI masks stockout days to prevent artificial zero-demand bias, sparse data remains a limitation for intermittent medicines.
> - **Extrapolation Warning:** Expiry simulations projecting beyond the trained machine learning forecast horizon (maximum 30 days) use trailing average extrapolation and are visibly flagged with `confidence: 'low'` in the user interface.
> - **Wastage Claims:** Reported potential cost savings and wastage reductions are analytical scenario simulations, not verified clinical outcomes.
