# MedStock AI — Smart Inventory & Expiry Predictor

> **Fundamentals of Artificial Intelligence (FAI) Project**  
> AI-powered medicine inventory management, FEFO expiry-risk simulation, and demand forecasting for hospitals, clinics, and pharmacies.

---

## 1. Project Overview & Architecture

MedStock AI bridges conventional inventory operations with explainable machine learning decision support:
- **Batch-Level Inventory Tracking** with an immutable append-only ledger (`StockMovement`).
- **First-Expiry-First-Out (FEFO) Allocation** strictly preventing the dispensing of expired medicines.
- **Expiry-Risk Simulation** evaluating remaining batch shelf life against projected consumption.
- **AI Demand Forecasting** utilizing recursive lag features and Random Forest against a moving-average baseline.
- **Transparent Reorder Formulas** generating explainable purchase recommendations.

```
React (Vite)  --Axios, cookies-->  Express API  --Mongoose-->  MongoDB Atlas
                                        |   ^
                           JSON / HTTP  |   |  forecasts, risk results
                                        v   |
                                  FastAPI AI service
                        (stateless, no DB access, Joblib models)
```

---

## 2. Project Status & Roadmap

| Phase | Description | Status |
|---|---|:---:|
| **Phase 1** | Requirements, Architecture, ER Models & API Contract (`docs/api-contract.md`) | ✅ **Implemented** |
| **Phase 2** | Frontend Foundation (Vite, React, Tailwind v3, Recharts, Components, 15 Screens) | ✅ **Implemented** |
| **Phase 3** | Express Inventory Backend (Models, Auth, FEFO, Transactions, Stock Ledger) | ⏳ *Planned next* |
| **Phase 4** | Inventory Frontend Integration (Connect React catalogue & inventory to Express) | ⏳ *Planned* |
| **Phase 5** | FastAPI AI Service (Synthetic Data, Features, Random Forest, Pytest) | ⏳ *Planned* |
| **Phase 6** | Inventory Intelligence (AI client, Expiry Risk simulation, Stockout alerts) | ⏳ *Planned* |
| **Phase 7** | Remaining Screens (Purchase Orders, Reports, CSV Import/Preview, RBAC) | ⏳ *Planned* |
| **Phase 8** | Integration, Backtesting Evaluation & Quality Assurance | ⏳ *Planned* |

---

## 3. Implemented vs. Planned Functionality

### Currently Implemented (Phase 1 & Phase 2)
- **API Contract Specification (`docs/api-contract.md`)**: Full schema definition for all 40+ Express routes and FastAPI endpoints, complete request/response envelopes, error codes, and architectural risk mitigations.
- **Repository Architecture**: Complete 3-tier folder structure established (`client/`, `server/`, `ai-service/`, `data/`, `docs/`).
- **Client Application (`client/`)**:
  - Vite + React + Tailwind CSS (v3).
  - Design tokens matching Section 12 (navy gradient sidebar, brand blue, alert badges, Inter typography, 12px radius cards).
  - Reusable design system: `Button`, `Input`, `Select`, `Badge`, `KpiCard`, `ChartCard`, `AlertPanel`, `ProgressBar`, `Tabs`, `Modal`, `ConfirmDialog`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `Pagination`, `DataTable`, `DateRangeFilter`.
  - Shared layout: `Sidebar` with active nav states, `Topbar` with search & user menu, `MobileDrawer` for responsive viewports, and `PageHeader`.
  - **Screen 1 (`/login`)**: Full split layout with React Hook Form + Zod validation, credential toggles, and demo account one-click fill.
  - **Screen 2 (`/dashboard`)**: Inventory overview with visible **"Demonstration data"** banner, 4 KPI cards, Inventory Health progress bars, Recharts area/line chart, recent movements table, and critical alerts panel.
  - **Screens 3–15**: Fully routed placeholder/preview screens for all required catalogue, inventory, AI forecasting, stockout, reorder, movements, supplier, purchase order, reporting, notification, user management, and CSV data intake views.
  - Public, Protected, and Role-based route guards (`ProtectedRoute`, `RoleRoute`).

### Planned Functionality (Phases 3–8)
- Real MongoDB Atlas multi-document transactions and ledger consistency checks.
- Express server authentication with HTTP-only cookies and CSRF double-submit tokens.
- Real-time FastAPI model generation and Joblib model persistence.
- CSV file upload, schema validation, and row-by-row commit pipeline.

---

## 4. How to Run the App (Phase 2)

### Prerequisites
- Node.js `v18+` (Tested on `v24.14.0`)
- npm `v9+`

### Client Development Server
```bash
cd client
npm install
npm run dev -- --port 5173
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Verify Production Build
```bash
cd client
npm run build
```

---

## 5. Demonstration Credentials (Phase 2 Preview)
You can click any of the quick-fill buttons on the login page or enter:
- **Admin:** `admin@medstock.local` / `password123`
- **Manager:** `manager@medstock.local` / `password123`
- **Staff:** `staff@medstock.local` / `password123`

---

## 6. Disclosures & AI Limitations
- MedStock AI provides inventory **decision support only**; it does not provide clinical guidance or treatment recommendations.
- Demonstration metrics and forecasts shown during Phase 2 are simulated for UI verification; real model outputs from FastAPI will be integrated in subsequent phases.
