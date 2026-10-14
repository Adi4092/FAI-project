# MedStock AI — API Contract & Interface Specification

**Version:** 1.0.0  
**Status:** Canonical Interface Contract (Phase 1 Deliverable)  
**Applicability:** Express REST API, FastAPI AI Service, React Client  

---

## 1. Architectural Overview & Conventions

All communication between the React Client and Express Backend uses JSON over HTTPS/HTTP with credentials (HTTP-only cookies for tokens, double-submit CSRF cookie/header).  
All communication between Express Backend and the FastAPI AI Service is server-to-server HTTP with JSON payloads. The AI service is stateless and possesses no database credentials.

### 1.1 HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource created successfully.
- `400 Bad Request`: Client input failed preliminary parsing or validation.
- `401 Unauthorized`: Missing, expired, or invalid session token.
- `403 Forbidden`: Authenticated user lacks permission (RBAC) or CSRF token mismatch.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: Business rule conflict (e.g. duplicate code, duplicate batch, immutable state violation).
- `422 Unprocessable Entity`: Semantic validation failure.
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unexpected server-side failure (stack traces omitted).
- `503 Service Unavailable`: Dependent service (e.g., FastAPI AI service) unavailable.

### 1.2 Response Envelopes (Express API)

#### Success Envelope
```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "error": null
}
```
*(Note: `meta` is present on paginated collection responses and omitted or `null` for single-resource responses.)*

#### Error Envelope
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for one or more fields.",
    "details": [
      {
        "field": "reorderLevel",
        "message": "Reorder level must be a non-negative integer."
      }
    ]
  }
}
```

Standard Error Codes:
- `VALIDATION_ERROR` (400 / 422)
- `AUTHENTICATION_FAILED` (401)
- `TOKEN_EXPIRED` (401)
- `FORBIDDEN` (403)
- `CSRF_ERROR` (403)
- `NOT_FOUND` (404)
- `DUPLICATE_RESOURCE` (409)
- `INSUFFICIENT_STOCK` (409)
- `BATCH_EXPIRED` (409)
- `IMMUTABLE_RECORD` (409)
- `RATE_LIMIT_EXCEEDED` (429)
- `AI_SERVICE_UNAVAILABLE` (503)
- `INSUFFICIENT_HISTORY` (422)
- `INTERNAL_ERROR` (500)

---

## 2. Express Backend API Endpoints

### 2.1 Authentication (`/api/auth`)

#### `POST /api/auth/login`
- **Access:** Public (Rate-limited: 5 attempts / 15m / IP+email)
- **Request Body:**
  ```json
  {
    "email": "admin@medstock.local",
    "password": "SecurePassword123!"
  }
  ```
- **Response `200 OK`:** Sets `accessToken` (15m, HTTP-only), `refreshToken` (7d, HTTP-only), and `csrf_token` (SameSite=Lax, readable) cookies.
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "665f1a2b3c4d5e6f7a8b9c01",
        "name": "System Administrator",
        "email": "admin@medstock.local",
        "role": "admin",
        "isActive": true,
        "lastLoginAt": "2026-10-14T01:00:00.000Z"
      }
    },
    "error": null
  }
  ```

#### `POST /api/auth/logout`
- **Access:** Authenticated
- **Response `200 OK`:** Clears auth cookies and revokes refresh token record.
  ```json
  {
    "success": true,
    "data": { "message": "Successfully logged out." },
    "error": null
  }
  ```

#### `POST /api/auth/refresh`
- **Access:** Public (requires valid `refreshToken` cookie)
- **Response `200 OK`:** Rotates refresh token in DB, sets new `accessToken` and `refreshToken` cookies.
  ```json
  {
    "success": true,
    "data": { "message": "Token refreshed." },
    "error": null
  }
  ```

#### `GET /api/auth/me`
- **Access:** Authenticated
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "665f1a2b3c4d5e6f7a8b9c01",
        "name": "System Administrator",
        "email": "admin@medstock.local",
        "role": "admin",
        "isActive": true,
        "lastLoginAt": "2026-10-14T01:00:00.000Z"
      }
    },
    "error": null
  }
  ```

#### `GET /api/auth/csrf`
- **Access:** Public
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": { "csrfToken": "cf7a8b9c01d2e3f4..." },
    "error": null
  }
  ```

---

### 2.2 Medicines (`/api/medicines`)

#### `GET /api/medicines`
- **Access:** All roles
- **Query Params:**
  - `page` (integer, default 1)
  - `limit` (integer, max 100, default 20)
  - `q` (string, search name or medicineCode)
  - `category` (string, e.g. "Antibiotic", "Analgesic")
  - `status` ("active" | "inactive" | "all", default "active")
  - `lowStock` ("true" | "false")
  - `sort` (string, e.g. "name:asc", "usableStock:asc")
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "665f1a2b3c4d5e6f7a8b9c02",
        "medicineCode": "MED-001",
        "name": "Paracetamol 500mg",
        "category": "Analgesic",
        "unit": "tablet",
        "description": "Standard antipyretic and analgesic",
        "reorderLevel": 100,
        "safetyStock": 50,
        "isActive": true,
        "isDemo": true,
        "usableStock": 350,
        "expiredStock": 0,
        "totalBatches": 3,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-10-14T00:00:00.000Z"
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "error": null
  }
  ```

#### `POST /api/medicines`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "medicineCode": "MED-002",
    "name": "Amoxicillin 250mg",
    "category": "Antibiotic",
    "unit": "capsule",
    "description": "Broad-spectrum beta-lactam antibiotic",
    "reorderLevel": 120,
    "safetyStock": 40,
    "isActive": true
  }
  ```
- **Response `201 Created`:** Returns created medicine object.

#### `GET /api/medicines/:id`
- **Access:** All roles
- **Response `200 OK`:** Single medicine object with usable stock, active batches count, and preferred supplier info.

#### `PUT /api/medicines/:id`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "name": "Amoxicillin 250mg Forte",
    "category": "Antibiotic",
    "unit": "capsule",
    "description": "Updated formulation description",
    "reorderLevel": 140,
    "safetyStock": 50
  }
  ```
- **Response `200 OK`:** Updated medicine object.

#### `PATCH /api/medicines/:id/status`
- **Access:** Admin, Inventory Manager
- **Request Body:** `{ "isActive": false }`
- **Response `200 OK`:** Updated medicine object. (Hard deletion is rejected if batch/movement records exist).

#### `GET /api/medicines/:id/batches`
- **Access:** All roles
- **Response `200 OK`:** List of batches associated with medicine.

#### `GET /api/medicines/:id/suppliers`
- **Access:** All roles
- **Response `200 OK`:** List of supplier associations for this medicine.

#### `PUT /api/medicines/:id/suppliers`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "suppliers": [
      {
        "supplierId": "665f1a2b3c4d5e6f7a8b9c10",
        "leadTimeDays": 7,
        "minOrderQty": 100,
        "unitCost": 2.50,
        "isPreferred": true
      }
    ]
  }
  ```
- **Response `200 OK`:** Array of updated associations.

---

### 2.3 Batches (`/api/batches`)

#### `GET /api/batches`
- **Access:** All roles
- **Query Params:**
  - `page`, `limit`, `sort`, `q` (batchNumber)
  - `medicineId` (string)
  - `supplierId` (string)
  - `expiryStatus` ("expired" | "expiring" | "healthy" | "all")
  - `status` ("active" | "depleted" | "expired" | "quarantined")
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "665f1a2b3c4d5e6f7a8b9c20",
        "batchNumber": "B-2026-001",
        "medicineId": {
          "id": "665f1a2b3c4d5e6f7a8b9c02",
          "name": "Paracetamol 500mg",
          "medicineCode": "MED-001",
          "unit": "tablet"
        },
        "supplierId": {
          "id": "665f1a2b3c4d5e6f7a8b9c10",
          "name": "PharmaCorp Ltd"
        },
        "manufacturingDate": "2025-06-01",
        "expiryDate": "2027-05-31",
        "initialQuantity": 500,
        "currentQuantity": 350,
        "purchaseCostPerUnit": 0.85,
        "receivedAt": "2025-06-15T10:00:00.000Z",
        "status": "active",
        "isExpired": false,
        "daysToExpiry": 594,
        "isDemo": true
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "error": null
  }
  ```

#### `POST /api/batches`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
    "supplierId": "665f1a2b3c4d5e6f7a8b9c10",
    "batchNumber": "B-2026-102",
    "manufacturingDate": "2026-01-10",
    "expiryDate": "2027-12-31",
    "initialQuantity": 200,
    "purchaseCostPerUnit": 1.20,
    "receivedAt": "2026-02-01T09:00:00.000Z",
    "purchaseOrderId": null
  }
  ```
- **Response `201 Created`:** Created batch record plus generated initial stock movement (`receipt`).

#### `GET /api/batches/:id`
- **Access:** All roles
- **Response `200 OK`:** Single batch details with computed `daysToExpiry` and `isExpired`.

#### `PUT /api/batches/:id`
- **Access:** Admin, Inventory Manager
- **Note:** Metadata only; quantity updates are strictly forbidden via PUT.
- **Request Body:**
  ```json
  {
    "supplierId": "665f1a2b3c4d5e6f7a8b9c10",
    "manufacturingDate": "2026-01-12",
    "expiryDate": "2028-01-15",
    "purchaseCostPerUnit": 1.25
  }
  ```
- **Response `200 OK`:** Updated batch object.

#### `GET /api/batches/:id/history`
- **Access:** All roles
- **Response `200 OK`:** Chronological array of `StockMovement` entries for this batch.

---

### 2.4 Inventory Operations (`/api/inventory`)

#### `GET /api/inventory/summary`
- **Access:** All roles
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "totalUsableUnits": 12840,
      "totalExpiredUnits": 180,
      "totalActiveBatches": 64,
      "batchesExpiringWithin30Days": 8,
      "medicinesBelowReorder": 12,
      "medicinesAtStockoutRisk": 5,
      "healthyStockPercentage": 77.0,
      "expiryRiskPercentage": 23.0
    },
    "error": null
  }
  ```

#### `GET /api/inventory/fefo-preview`
- **Access:** All roles
- **Query Params:**
  - `medicineId` (required)
  - `quantity` (required integer > 0)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
      "requestedQuantity": 40,
      "sufficientStock": true,
      "allocations": [
        {
          "batchId": "665f1a2b3c4d5e6f7a8b9c20",
          "batchNumber": "B002",
          "expiryDate": "2026-11-01",
          "currentQuantity": 25,
          "allocatedQuantity": 25,
          "balanceAfter": 0
        },
        {
          "batchId": "665f1a2b3c4d5e6f7a8b9c21",
          "batchNumber": "B007",
          "expiryDate": "2026-12-15",
          "currentQuantity": 100,
          "allocatedQuantity": 15,
          "balanceAfter": 85
        }
      ]
    },
    "error": null
  }
  ```

#### `POST /api/inventory/receive`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
    "batchNumber": "B-2026-301",
    "supplierId": "665f1a2b3c4d5e6f7a8b9c10",
    "manufacturingDate": "2026-08-01",
    "expiryDate": "2028-07-31",
    "quantity": 300,
    "purchaseCostPerUnit": 4.50,
    "purchaseOrderId": null
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "batch": { "id": "...", "batchNumber": "B-2026-301", "currentQuantity": 300 },
      "movement": { "id": "...", "movementType": "receipt", "quantityChange": 300 }
    },
    "error": null
  }
  ```

#### `POST /api/inventory/dispense`
- **Access:** All roles (Staff, Manager, Admin)
- **Request Body:**
  ```json
  {
    "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
    "quantity": 40,
    "note": "Requisition Ward 3",
    "allocations": [
      { "batchId": "665f1a2b3c4d5e6f7a8b9c20", "quantity": 25 },
      { "batchId": "665f1a2b3c4d5e6f7a8b9c21", "quantity": 15 }
    ]
  }
  ```
  *(Note: If `allocations` is empty, FEFO order is strictly applied by server).*
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
      "totalDispensed": 40,
      "movements": [
        { "id": "m1", "batchId": "665f1a2b3c4d5e6f7a8b9c20", "batchNumber": "B002", "quantity": 25, "balanceAfter": 0 },
        { "id": "m2", "batchId": "665f1a2b3c4d5e6f7a8b9c21", "batchNumber": "B007", "quantity": 15, "balanceAfter": 85 }
      ]
    },
    "error": null
  }
  ```

#### `POST /api/inventory/return`
- **Access:** All roles (Reason required)
- **Request Body:**
  ```json
  {
    "batchId": "665f1a2b3c4d5e6f7a8b9c21",
    "quantity": 5,
    "reason": "Unopened patient ward return",
    "referenceDispenseMovementId": "665f1a2b3c4d5e6f7a8b9c99"
  }
  ```
- **Response `200 OK`:** Returns generated movement and updated batch quantity.

#### `POST /api/inventory/adjust`
- **Access:** Admin, Inventory Manager (Reason required)
- **Request Body:**
  ```json
  {
    "batchId": "665f1a2b3c4d5e6f7a8b9c21",
    "quantityChange": -2,
    "reason": "Physical count discrepancy after cycle audit"
  }
  ```
- **Response `200 OK`:** Returns generated movement and updated batch quantity.

#### `POST /api/inventory/write-off`
- **Access:** Admin, Inventory Manager (Reason required)
- **Request Body:**
  ```json
  {
    "batchId": "665f1a2b3c4d5e6f7a8b9c20",
    "reason": "Batch passed expiration date; quarantined and disposed"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "batchId": "665f1a2b3c4d5e6f7a8b9c20",
      "writtenOffQuantity": 25,
      "realizedWastageCost": 21.25,
      "movementId": "665f1a2b3c4d5e6f7a8b9c88"
    },
    "error": null
  }
  ```

#### `GET /api/inventory/reconcile`
- **Access:** Admin
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "reconciled": true,
      "totalBatchesChecked": 64,
      "mismatches": []
    },
    "error": null
  }
  ```

---

### 2.5 Stock Movements (`/api/stock-movements`)

#### `GET /api/stock-movements`
- **Access:** All roles
- **Query Params:**
  - `page`, `limit`, `sort`
  - `medicineId`, `batchId`, `type`, `userId`, `from`, `to`, `q`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "665f1a2b3c4d5e6f7a8b9c77",
        "timestamp": "2026-10-14T01:10:00.000Z",
        "medicine": { "id": "...", "name": "Paracetamol 500mg", "medicineCode": "MED-001" },
        "batch": { "id": "...", "batchNumber": "B002" },
        "movementType": "dispense",
        "quantityChange": -25,
        "balanceBefore": 25,
        "balanceAfter": 0,
        "referenceType": "manual",
        "referenceId": null,
        "reason": "Prescription Staff",
        "performedBy": { "id": "...", "name": "Riya Staff" },
        "reversesMovementId": null
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "error": null
  }
  ```

#### `GET /api/stock-movements/export`
- **Access:** Admin, Inventory Manager
- **Query Params:** Same filters as list endpoint
- **Response `200 OK`:** Raw CSV stream (`Content-Type: text/csv`).

#### `POST /api/stock-movements/:id/correct`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "reason": "Entry error on quantity: correcting previous adjustment"
  }
  ```
- **Response `201 Created`:** Returns compensating `correction` movement.

---

### 2.6 Suppliers (`/api/suppliers`)

#### `GET /api/suppliers`
- **Access:** All roles
- **Query Params:** `page`, `limit`, `q`, `isActive`
- **Response `200 OK`:** Array of supplier records.

#### `POST /api/suppliers`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "name": "HealthPlus Pharma",
    "contactPerson": "Sarah Johnson",
    "email": "sarah@healthplus.com",
    "phone": "+91 98765 43210",
    "address": "45 Industrial Parkway, Sector 3",
    "defaultLeadTimeDays": 7,
    "isActive": true
  }
  ```
- **Response `201 Created`:** Created supplier record.

#### `GET /api/suppliers/:id`
- **Access:** All roles
- **Response `200 OK`:** Single supplier details.

#### `PUT /api/suppliers/:id`
- **Access:** Admin, Inventory Manager
- **Request Body:** Update fields for supplier.
- **Response `200 OK`:** Updated supplier.

#### `PATCH /api/suppliers/:id/status`
- **Access:** Admin, Inventory Manager
- **Request Body:** `{ "isActive": false }`
- **Response `200 OK`:** Updated supplier.

#### `GET /api/suppliers/:id/batches`
- **Access:** All roles
- **Response `200 OK`:** Batches supplied by this supplier.

#### `GET /api/suppliers/:id/purchase-orders`
- **Access:** Admin, Inventory Manager
- **Response `200 OK`:** Purchase orders linked to supplier.

---

### 2.7 Purchase Orders (`/api/purchase-orders`)

#### `GET /api/purchase-orders`
- **Access:** Admin, Inventory Manager
- **Query Params:** `page`, `limit`, `status`, `supplierId`, `from`, `to`
- **Response `200 OK`:** Array of purchase orders.

#### `POST /api/purchase-orders`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "supplierId": "665f1a2b3c4d5e6f7a8b9c10",
    "expectedDeliveryDate": "2026-10-25",
    "items": [
      {
        "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
        "quantityOrdered": 500,
        "unitCost": 1.20
      }
    ],
    "sourceRecommendationId": null
  }
  ```
- **Response `201 Created`:** Draft purchase order.

#### `GET /api/purchase-orders/:id`
- **Access:** Admin, Inventory Manager
- **Response `200 OK`:** Purchase order with item lines, receipts, and approval trail.

#### `PUT /api/purchase-orders/:id`
- **Access:** Admin, Inventory Manager (Draft status only)
- **Request Body:** Modifiable lines and delivery date.
- **Response `200 OK`:** Updated draft order.

#### `POST /api/purchase-orders/:id/submit`
- **Access:** Admin, Inventory Manager (Draft -> Pending Approval)
- **Response `200 OK`:** Order updated to `pending_approval`.

#### `POST /api/purchase-orders/:id/approve`
- **Access:** Admin, Inventory Manager
- **Response `200 OK`:** Order updated to `approved`.

#### `POST /api/purchase-orders/:id/reject`
- **Access:** Admin, Inventory Manager
- **Request Body:** `{ "reason": "Budget restriction" }`
- **Response `200 OK`:** Order status updated to `rejected`.

#### `POST /api/purchase-orders/:id/receive`
- **Access:** Admin, Inventory Manager
- **Request Body (Idempotent by `receiptId`):**
  ```json
  {
    "receiptId": "2d0f9c0e-6f4b-4f43-9a1e-0c1e6b1a1111",
    "lines": [
      {
        "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
        "batchNumber": "B115",
        "manufacturingDate": "2026-08-01",
        "expiryDate": "2028-07-31",
        "quantity": 300,
        "unitCost": 1.20
      }
    ]
  }
  ```
- **Response `200 OK`:** Returns created batches, created receipt stock movements, and updated PO status (`partially_received` or `received`). If `receiptId` was already committed, returns existing result idempotently without duplicating stock.

#### `POST /api/purchase-orders/:id/cancel`
- **Access:** Admin, Inventory Manager
- **Request Body:** `{ "cancelReason": "Supplier unable to fulfill" }`
- **Response `200 OK`:** Order status updated to `cancelled`.

---

### 2.8 Forecasts (`/api/forecasts`)

#### `POST /api/forecasts/generate`
- **Access:** Admin, Inventory Manager
- **Request Body:**
  ```json
  {
    "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
    "horizonDays": 15
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "665f1a2b3c4d5e6f7a8b9c55",
      "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
      "generatedAt": "2026-10-14T01:15:00.000Z",
      "generatedBy": "665f1a2b3c4d5e6f7a8b9c01",
      "forecastStartDate": "2026-10-14",
      "forecastEndDate": "2026-10-28",
      "horizonDays": 15,
      "modelName": "random_forest",
      "modelVersion": "rf-2026.10.1",
      "predictedDailyDemand": [
        { "date": "2026-10-14", "predicted": 11.4 },
        { "date": "2026-10-15", "predicted": 12.1 }
      ],
      "predictedTotalDemand": 171.2,
      "evaluationMetrics": {
        "mae": 1.45,
        "rmse": 2.10,
        "wape": 0.085,
        "baselineMae": 2.30,
        "baselineRmse": 3.10,
        "baselineWape": 0.142,
        "holdoutDays": 15
      },
      "dataWindow": {
        "from": "2025-10-01",
        "to": "2026-10-13",
        "days": 378,
        "maskedDays": 4
      },
      "provisional": false,
      "warnings": [],
      "status": "completed"
    },
    "error": null
  }
  ```

#### `GET /api/forecasts`
- **Access:** All roles
- **Query Params:** `medicineId` (required), `page`, `limit`
- **Response `200 OK`:** Historical forecast runs for medicine.

#### `GET /api/forecasts/:id`
- **Access:** All roles
- **Response `200 OK`:** Single forecast record.

#### `GET /api/forecasts/usage/:medicineId`
- **Access:** All roles
- **Query Params:** `from` (YYYY-MM-DD), `to` (YYYY-MM-DD)
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "date": "2026-10-01",
        "unitsDispensed": 14,
        "unitsReceived": 0,
        "stockoutObserved": false,
        "dataSource": "ledger"
      }
    ],
    "error": null
  }
  ```

#### `POST /api/forecasts/refresh-usage`
- **Access:** Admin, Inventory Manager
- **Response `200 OK`:** Aggregates ledger movements into `DailyUsage` collection.

#### `POST /api/forecasts/retrain`
- **Access:** Admin only
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "modelName": "random_forest",
      "modelVersion": "rf-2026.10.2",
      "trainedAt": "2026-10-14T01:20:00.000Z",
      "recordsUsed": 10500,
      "metricsSummary": { "averageWape": 0.082 }
    },
    "error": null
  }
  ```

#### `GET /api/forecasts/model-info`
- **Access:** All roles
- **Response `200 OK`:** Metadata on active model from FastAPI.

#### `GET /api/forecasts/health`
- **Access:** All roles
- **Response `200 OK`:** FastAPI service health check.

---

### 2.9 Intelligence & Decision Support

#### `GET /api/expiry-risk`
- **Access:** All roles
- **Query Params:**
  - `windowDays` (7 | 30 | 60 | 90, default 30)
  - `medicineId` (optional)
  - `riskLevel` ("low" | "medium" | "high" | "critical" | "all")
  - `page`, `limit`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "estimatedWastageUnits": 120,
        "estimatedValueAtRisk": 2340.00,
        "disclaimer": "Estimated — based on forecasts and assumptions, not guaranteed."
      },
      "batches": [
        {
          "batchId": "665f1a2b3c4d5e6f7a8b9c20",
          "batchNumber": "B005",
          "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
          "medicineName": "Ciprofloxacin 500mg",
          "expiryDate": "2026-05-30",
          "daysLeft": 17,
          "currentQuantity": 30,
          "expectedConsumed": 10,
          "expectedLeftover": 20,
          "leftoverPct": 66.7,
          "exposureValue": 150.00,
          "riskLevel": "high",
          "reasons": [
            "Only 17 days of shelf life remain",
            "Projected demand covers only 33% of this batch under FEFO"
          ],
          "suggestedActions": [
            "Prioritise dispensing this batch",
            "Review pending reorders"
          ],
          "extrapolated": false,
          "confidence": "normal"
        }
      ]
    },
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "error": null
  }
  ```

#### `GET /api/expiry-risk/batch/:batchId`
- **Access:** All roles
- **Response `200 OK`:** Detailed simulation breakdown for single batch.

#### `GET /api/stockout-predictions`
- **Access:** All roles
- **Query Params:** `riskLevel`, `q`, `page`, `limit`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": [
      {
        "medicineId": "665f1a2b3c4d5e6f7a8b9c02",
        "medicineName": "Ciprofloxacin 500mg",
        "currentUsableStock": 30,
        "leadTimeDays": 5,
        "safetyStock": 20,
        "forecastLeadTimeDemand": 42,
        "daysUntilStockout": 3,
        "incomingOrdersCount": 0,
        "incomingConfirmedQuantity": 0,
        "riskLevel": "critical",
        "isFallbackRule": false,
        "explanation": "Stockout projected in 3 days; supplier lead time is 5 days and no confirmed delivery is scheduled before stock exhaustion.",
        "recommendedAction": "Reorder immediately / expedite supplier delivery"
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "error": null
  }
  ```

#### `GET /api/reorders`
- **Access:** Admin, Inventory Manager
- **Query Params:** `status` ("pending" | "approved" | "rejected" | "adjusted" | "ordered" | "all"), `page`, `limit`
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "totalSuggestedUnits": 670,
        "estimatedCost": 1240.00
      },
      "recommendations": [
        {
          "id": "665f1a2b3c4d5e6f7a8b9c61",
          "medicineId": {
            "id": "665f1a2b3c4d5e6f7a8b9c02",
            "name": "Ciprofloxacin 500mg",
            "medicineCode": "MED-003"
          },
          "generatedAt": "2026-10-14T00:00:00.000Z",
          "inputs": {
            "usableStock": 30,
            "forecastLeadTimeDemand": 42,
            "safetyStock": 20,
            "reorderPoint": 62,
            "incomingConfirmed": 0,
            "outstandingOrders": 0,
            "targetCoverageDays": 30,
            "avgDailyDemand": 8.4,
            "leadTimeDays": 5,
            "minOrderQty": 50,
            "expiryRiskReduction": 0
          },
          "suggestedQuantity": 100,
          "adjustedQuantity": null,
          "preferredSupplier": { "id": "...", "name": "HealthPlus Pharma" },
          "estimatedCost": 250.00,
          "reason": "Inventory position (30) is below reorder point (62). Target stock = 8.4×30+20 = 272; raw order = 272−30 = 242, adjusted for MOQ 50.",
          "status": "pending",
          "reviewedBy": null,
          "reviewedAt": null,
          "reviewNote": null
        }
      ]
    },
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "error": null
  }
  ```

#### `POST /api/reorders/generate`
- **Access:** Admin, Inventory Manager
- **Response `200 OK`:** Triggers reorder rule evaluation across all active medicines.

#### `POST /api/reorders/:id/approve`
- **Access:** Admin, Inventory Manager
- **Response `200 OK`:** Creates a draft `PurchaseOrder` and marks recommendation `approved`.

#### `POST /api/reorders/:id/reject`
- **Access:** Admin, Inventory Manager
- **Request Body:** `{ "reason": "Sufficient buffer in alternate branch" }`
- **Response `200 OK`:** Marks recommendation `rejected`.

#### `POST /api/reorders/:id/adjust`
- **Access:** Admin, Inventory Manager
- **Request Body:** `{ "quantity": 150, "note": "Adjusted higher due to anticipated winter flu surge" }`
- **Response `200 OK`:** Updates recommendation with `adjustedQuantity` and marks `adjusted`.

---

### 2.10 Reports (`/api/reports`)

All endpoints accept:
- `from` (ISO date, default 30 days ago)
- `to` (ISO date, default today)
- `medicineId` (optional filter)
- `format` ("json" | "csv", default "json")

- `GET /api/reports/consumption`
- `GET /api/reports/stock-movements`
- `GET /api/reports/wastage` (Realized write-offs only)
- `GET /api/reports/expiry-exposure` (Projected expiry estimates only)
- `GET /api/reports/stockouts`
- `GET /api/reports/purchases`
- `GET /api/reports/valuation`
- `GET /api/reports/forecast-performance`
- `GET /api/reports/reorders`

---

### 2.11 Notifications (`/api/notifications`)

#### `GET /api/notifications`
- **Access:** All roles
- **Query Params:** `type`, `severity`, `isRead`, `page`, `limit`
- **Response `200 OK`:** List of notification cards with `isRead` status.

#### `PATCH /api/notifications/:id/read`
- **Access:** All roles
- **Response `200 OK`:** Marks notification read.

#### `POST /api/notifications/mark-all-read`
- **Access:** All roles
- **Response `200 OK`:** Marks all unread notifications read for the current user.

#### `GET /api/notifications/unread-count`
- **Access:** All roles
- **Response `200 OK`:** `{ "success": true, "data": { "unreadCount": 4 }, "error": null }`

---

### 2.12 Dashboard (`/api/dashboard/summary`)

#### `GET /api/dashboard/summary`
- **Access:** All roles
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "data": {
      "kpi": {
        "totalMedicines": 248,
        "totalMedicinesChangePct": 5.0,
        "totalUnits": 12840,
        "totalUnitsChangePct": 8.0,
        "lowStockMedicines": 12,
        "lowStockChangePct": 20.0,
        "expiryAlerts": 8,
        "expiryAlertsChangePct": -2.0
      },
      "inventoryHealth": {
        "healthyStockPct": 77.0,
        "expiryRiskPct": 23.0
      },
      "stockOverviewChart": [
        { "date": "2026-04-01", "totalStock": 12000, "usedStock": 420 },
        { "date": "2026-04-08", "totalStock": 11800, "usedStock": 480 },
        { "date": "2026-04-15", "totalStock": 12500, "usedStock": 510 },
        { "date": "2026-04-22", "totalStock": 12600, "usedStock": 490 },
        { "date": "2026-04-30", "totalStock": 12840, "usedStock": 530 }
      ],
      "recentMovements": [
        { "date": "2026-04-30", "medicine": "Paracetamol 500mg", "type": "dispense", "quantity": -20, "user": "Riya" },
        { "date": "2026-04-29", "medicine": "Amoxicillin 250mg", "type": "receipt", "quantity": 50, "user": "Aman" },
        { "date": "2026-04-28", "medicine": "Metformin 500mg", "type": "dispense", "quantity": -15, "user": "Riya" },
        { "date": "2026-04-27", "medicine": "Ibuprofen 400mg", "type": "adjustment", "quantity": 10, "user": "Arjun" }
      ],
      "criticalAlerts": [
        { "id": "a1", "title": "Amoxicillin batch B002 expires in 3 days", "severity": "critical" },
        { "id": "a2", "title": "Metformin low stock (10 units)", "severity": "critical" },
        { "id": "a3", "title": "Paracetamol below reorder level (15 units)", "severity": "warning" },
        { "id": "a4", "title": "Ciprofloxacin expires in 8 days", "severity": "warning" }
      ],
      "upcomingExpiries": [
        { "medicine": "Amoxicillin", "batchNumber": "B002", "expiryDate": "2026-05-18", "quantity": 50 }
      ],
      "replenishmentNeeds": [
        { "medicine": "Paracetamol", "usableStock": 45, "reorderLevel": 100 }
      ]
    },
    "error": null
  }
  ```

---

### 2.13 Users, Settings & Audit Logs

- `GET /api/users` (Admin)
- `POST /api/users` (Admin)
- `PUT /api/users/:id` (Admin)
- `PATCH /api/users/:id/role` (Admin)
- `PATCH /api/users/:id/status` (Admin)
- `POST /api/users/:id/reset-password` (Admin)
- `GET /api/settings` (Admin)
- `PUT /api/settings` (Admin)
- `POST /api/settings/import/preview` (Admin, Manager - CSV file upload)
- `POST /api/settings/import/commit` (Admin, Manager - Commit validated session)
- `GET /api/settings/templates/:name` (All roles - downloads CSV template)
- `GET /api/audit-logs` (Admin - chronological, append-only)

---

## 3. FastAPI AI Service Endpoints

The AI service runs on `http://localhost:8000`.

### 3.1 `GET /health`
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "modelLoaded": true,
    "version": "rf-2026.10.1"
  }
  ```

### 3.2 `GET /model-info`
- **Response `200 OK`:**
  ```json
  {
    "activeModel": "random_forest",
    "version": "rf-2026.10.1",
    "trainedAt": "2026-10-14T00:00:00.000Z",
    "features": [
      "lag_1", "lag_2", "lag_3", "lag_7", "lag_14", "lag_28",
      "roll_mean_7", "roll_mean_14", "roll_mean_28", "roll_std_7",
      "day_of_week", "dow_sin", "dow_cos", "month", "day_of_month",
      "is_weekend", "days_since_last_nonzero", "medicine_scale"
    ],
    "trainingWindow": { "days": 365, "recordsCount": 10500 },
    "minHistoryDays": 60,
    "lastEvaluationMetrics": { "mae": 1.45, "rmse": 2.10, "wape": 0.085 }
  }
  ```

### 3.3 `POST /forecast`
- **Request Body:**
  ```json
  {
    "medicineId": "MED-001",
    "horizonDays": 15,
    "history": [
      { "date": "2026-01-01", "unitsDispensed": 12, "stockoutObserved": false }
    ],
    "modelPreference": "auto"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "modelName": "random_forest",
    "modelVersion": "rf-2026.10.1",
    "forecast": [
      { "date": "2026-10-14", "predicted": 11.4 }
    ],
    "totalPredicted": 171.2,
    "metrics": {
      "mae": 1.45,
      "rmse": 2.10,
      "wape": 0.085,
      "baselineMae": 2.30,
      "baselineRmse": 3.10,
      "baselineWape": 0.142,
      "holdoutDays": 15
    },
    "provisional": false,
    "dataWindow": {
      "from": "2025-10-01",
      "to": "2026-10-13",
      "days": 378,
      "maskedDays": 4
    },
    "warnings": []
  }
  ```

### 3.4 `POST /evaluate`
- **Request Body:**
  ```json
  {
    "medicineId": "MED-001",
    "history": [
      { "date": "2026-01-01", "unitsDispensed": 12, "stockoutObserved": false }
    ],
    "holdoutDays": 15
  }
  ```
- **Response `200 OK`:** Returns chronological backtest comparing Random Forest vs 7-day Moving Average baseline.

### 3.5 `POST /train`
- **Request Body:**
  ```json
  {
    "dataset": [
      {
        "medicineId": "MED-001",
        "records": [{ "date": "2026-01-01", "unitsDispensed": 12, "stockoutObserved": false }]
      }
    ]
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "modelName": "random_forest",
    "modelVersion": "rf-2026.10.2",
    "metrics": { "mae": 1.40, "rmse": 2.05, "wape": 0.081 }
  }
  ```

### 3.6 `POST /expiry-risk`
- **Request Body:**
  ```json
  {
    "asOfDate": "2026-10-13",
    "windowDays": 90,
    "dailyForecast": [
      { "date": "2026-10-14", "predicted": 11.4 }
    ],
    "extrapolationDailyDemand": 10.2,
    "batches": [
      {
        "batchId": "b1",
        "expiryDate": "2026-11-01",
        "quantity": 100,
        "unitCost": 4.50,
        "receivedAt": "2026-08-01"
      }
    ],
    "incoming": [
      {
        "expectedDate": "2026-10-20",
        "quantity": 200,
        "expiryDate": "2027-04-01"
      }
    ]
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "asOfDate": "2026-10-13",
    "results": [
      {
        "batchId": "b1",
        "expectedConsumed": 30,
        "expectedLeftover": 70,
        "leftoverPct": 70.0,
        "exposureValue": 315.0,
        "riskLevel": "critical",
        "reasons": [
          "Only 18 days of shelf life remain",
          "Projected demand covers only 30% of this batch under FEFO"
        ],
        "extrapolated": false,
        "confidence": "normal"
      }
    ]
  }
  ```

---

## 4. Key Assumptions & Technical Risks

### 4.1 Assumptions
1. **FEFO Allocation Rule:** Dispensing always sorts available active batches by `expiryDate` ascending, then `receivedAt` ascending. Expired stock (`expiryDate < startOfToday`) is strictly excluded.
2. **Immutable Ledger:** The `StockMovement` table is strictly append-only. Compensations are executed via explicit `correction` movement records.
3. **Stateless AI Service:** FastAPI reads no database. The Express backend aggregates time-series and batch structures, queries FastAPI, and stores verified forecasts and simulation results.
4. **Censored Demand Handling:** Days where stock reached 0 (`stockoutObserved = true`) are masked from model loss calculations and feature targets to avoid false zero suppression.
5. **Reorder Threshold Trigger:** Reorders are triggered when `inventoryPosition (usableStock + confirmedIncoming + outstandingOrders) <= reorderPoint`.

### 4.2 Technical Risks & Mitigations
| Risk | Potential Impact | Mitigation Strategy |
|---|---|---|
| **AI Service Down / Unreachable** | UI forecast generation fails | Express returns `503 AI_SERVICE_UNAVAILABLE`. Cached/saved forecasts are returned flagged `stale: true`. Rule-based moving average fallback applied for critical stockout estimation. |
| **Insufficient Time-Series History (< 14 days)** | High variance machine learning predictions | Express rejects RF forecast with `INSUFFICIENT_HISTORY`. For 14–59 days, system falls back to moving-average baseline with `provisional: true` badge. |
| **Concurrent Dispense Race Condition** | Inventory balances go negative or diverge from ledger | MongoDB Multi-Document Transactions with atomic conditional updates (`$inc` guarded by `currentQuantity >= requestedQuantity`) in `stockService`. |
| **Duplicate Purchase Order Receipt Submission** | Duplicate batch creation and double inventory credit | Client generates UUID `receiptId`. Express checks idempotency index on PO receipts; duplicate submissions return cached receipt result without re-executing ledger movements. |
| **Data Leakage in Time Series** | Over-optimistic model evaluation metrics | All rolling and lag features are shifted by at least 1 step (`shift(1)`). Train/test splits are strictly chronological; rolling-origin backtests never shuffle data. |
