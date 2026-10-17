"""
Synthetic Data Generator for MedStock AI
Section 9.11 Specification Compliant.
Fixed RNG seed (42).
Generates 30 medicines, 410 days of history (~13.5 months),
incorporating stable, increasing, seasonal, intermittent, high and low demand,
with deliberate stockout periods flagged with stockoutObserved=True.
Outputs CSVs to data/synthetic/.
"""

import os
import random
import datetime
import numpy as np
import pandas as pd

# Fixed RNG seed for complete reproducibility
RANDOM_SEED = 42

MEDICINE_SPECS = [
    {"code": "MED-001", "name": "Paracetamol 500mg", "category": "Analgesic", "pattern": "high_stable", "base": 65.0, "reorderLevel": 350, "safetyStock": 150, "unitCost": 0.50},
    {"code": "MED-002", "name": "Amoxicillin 250mg", "category": "Antibiotic", "pattern": "seasonal_stockout", "base": 24.0, "reorderLevel": 140, "safetyStock": 60, "unitCost": 1.80},
    {"code": "MED-003", "name": "Ciprofloxacin 500mg", "category": "Antibiotic", "pattern": "seasonal", "base": 18.0, "reorderLevel": 100, "safetyStock": 40, "unitCost": 2.20},
    {"code": "MED-004", "name": "Metformin 500mg", "category": "Antidiabetic", "pattern": "high_stable", "base": 55.0, "reorderLevel": 300, "safetyStock": 120, "unitCost": 0.80},
    {"code": "MED-005", "name": "Ibuprofen 400mg", "category": "NSAID", "pattern": "stable", "base": 28.0, "reorderLevel": 150, "safetyStock": 60, "unitCost": 0.90},
    {"code": "MED-006", "name": "Azithromycin 500mg", "category": "Antibiotic", "pattern": "seasonal_stockout", "base": 20.0, "reorderLevel": 120, "safetyStock": 50, "unitCost": 3.50},
    {"code": "MED-007", "name": "Omeprazole 20mg", "category": "Gastrointestinal", "pattern": "increasing", "base": 22.0, "reorderLevel": 130, "safetyStock": 50, "unitCost": 1.20},
    {"code": "MED-008", "name": "Amlodipine 5mg", "category": "Cardiovascular", "pattern": "stable", "base": 32.0, "reorderLevel": 160, "safetyStock": 70, "unitCost": 0.70},
    {"code": "MED-009", "name": "Atorvastatin 10mg", "category": "Cardiovascular", "pattern": "increasing", "base": 25.0, "reorderLevel": 140, "safetyStock": 60, "unitCost": 1.40},
    {"code": "MED-010", "name": "Cetirizine 10mg", "category": "Antihistamine", "pattern": "seasonal", "base": 16.0, "reorderLevel": 90, "safetyStock": 35, "unitCost": 0.40},
    {"code": "MED-011", "name": "Salbutamol Inhaler 100mcg", "category": "Respiratory", "pattern": "seasonal", "base": 12.0, "reorderLevel": 70, "safetyStock": 30, "unitCost": 4.50},
    {"code": "MED-012", "name": "Losartan 50mg", "category": "Cardiovascular", "pattern": "stable", "base": 20.0, "reorderLevel": 110, "safetyStock": 45, "unitCost": 1.10},
    {"code": "MED-013", "name": "Pantoprazole 40mg", "category": "Gastrointestinal", "pattern": "high_stable", "base": 45.0, "reorderLevel": 220, "safetyStock": 90, "unitCost": 1.30},
    {"code": "MED-014", "name": "Metoprolol 25mg", "category": "Cardiovascular", "pattern": "stable", "base": 15.0, "reorderLevel": 80, "safetyStock": 35, "unitCost": 1.00},
    {"code": "MED-015", "name": "Clopidogrel 75mg", "category": "Cardiovascular", "pattern": "stable", "base": 14.0, "reorderLevel": 75, "safetyStock": 30, "unitCost": 2.10},
    {"code": "MED-016", "name": "Ceftriaxone 1g Injection", "category": "Antibiotic", "pattern": "seasonal_stockout", "base": 10.0, "reorderLevel": 60, "safetyStock": 25, "unitCost": 5.00},
    {"code": "MED-017", "name": "Insulin Glargine 100IU/ml", "category": "Antidiabetic", "pattern": "low_stable", "base": 4.0, "reorderLevel": 25, "safetyStock": 10, "unitCost": 18.00},
    {"code": "MED-018", "name": "Doxycycline 100mg", "category": "Antibiotic", "pattern": "seasonal", "base": 12.0, "reorderLevel": 70, "safetyStock": 30, "unitCost": 1.60},
    {"code": "MED-019", "name": "Levothyroxine 50mcg", "category": "Endocrine", "pattern": "stable", "base": 18.0, "reorderLevel": 95, "safetyStock": 40, "unitCost": 0.60},
    {"code": "MED-020", "name": "Montelukast 10mg", "category": "Respiratory", "pattern": "increasing_stockout", "base": 14.0, "reorderLevel": 80, "safetyStock": 30, "unitCost": 2.00},
    {"code": "MED-021", "name": "Diclofenac 50mg", "category": "NSAID", "pattern": "stable", "base": 22.0, "reorderLevel": 120, "safetyStock": 50, "unitCost": 0.65},
    {"code": "MED-022", "name": "Ranitidine 150mg", "category": "Gastrointestinal", "pattern": "low_stable", "base": 5.0, "reorderLevel": 30, "safetyStock": 12, "unitCost": 0.45},
    {"code": "MED-023", "name": "Furosemide 40mg", "category": "Cardiovascular", "pattern": "stable", "base": 12.0, "reorderLevel": 65, "safetyStock": 25, "unitCost": 0.55},
    {"code": "MED-024", "name": "Tramadol 50mg", "category": "Analgesic", "pattern": "intermittent", "base": 3.0, "reorderLevel": 35, "safetyStock": 15, "unitCost": 1.75},
    {"code": "MED-025", "name": "Alprazolam 0.5mg", "category": "Psychiatric", "pattern": "intermittent", "base": 2.5, "reorderLevel": 25, "safetyStock": 10, "unitCost": 0.85},
    {"code": "MED-026", "name": "Gabapentin 300mg", "category": "Neurology", "pattern": "increasing", "base": 11.0, "reorderLevel": 60, "safetyStock": 25, "unitCost": 2.40},
    {"code": "MED-027", "name": "Fluconazole 150mg", "category": "Antifungal", "pattern": "intermittent", "base": 2.0, "reorderLevel": 20, "safetyStock": 10, "unitCost": 3.10},
    {"code": "MED-028", "name": "Mupirocin 2% Ointment", "category": "Dermatology", "pattern": "low_stable", "base": 3.5, "reorderLevel": 20, "safetyStock": 8, "unitCost": 4.20},
    {"code": "MED-029", "name": "Ondansetron 4mg", "category": "Gastrointestinal", "pattern": "seasonal", "base": 15.0, "reorderLevel": 80, "safetyStock": 30, "unitCost": 1.90},
    {"code": "MED-030", "name": "Hydrochlorothiazide 25mg", "category": "Cardiovascular", "pattern": "stable", "base": 16.0, "reorderLevel": 85, "safetyStock": 35, "unitCost": 0.50}
]

SUPPLIERS = [
    {"supplierId": "SUP-001", "name": "HealthPlus Pharma", "leadTimeDays": 7, "contact": "orders@healthplus.com"},
    {"supplierId": "SUP-002", "name": "MedSupply Global", "leadTimeDays": 10, "contact": "supplies@medsupply.com"},
    {"supplierId": "SUP-003", "name": "CareLife Pharmaceuticals", "leadTimeDays": 5, "contact": "info@carelife.in"},
    {"supplierId": "SUP-004", "name": "Apex Lifesciences", "leadTimeDays": 14, "contact": "contact@apexlifesciences.com"},
    {"supplierId": "SUP-005", "name": "BioMed Healthcare", "leadTimeDays": 3, "contact": "support@biomedhealth.org"}
]


def generate_synthetic_data(output_dir: str = "../data/synthetic", start_date_str: str = "2025-09-01", days: int = 410):
    """
    Generates synthetic datasets with seed=42 and writes them to output_dir.
    """
    os.makedirs(output_dir, exist_ok=True)
    rng = np.random.default_rng(RANDOM_SEED)
    random.seed(RANDOM_SEED)

    start_date = datetime.date.fromisoformat(start_date_str)
    date_list = [start_date + datetime.timedelta(days=i) for i in range(days)]

    # 1. Daily Usage Generation
    daily_records = []

    # Pre-defined stockout windows (start_day_idx, duration_days) for specific medicines
    stockout_schedules = {
        "MED-002": [(120, 7), (290, 8)],      # Amoxicillin
        "MED-006": [(180, 6), (340, 5)],      # Azithromycin
        "MED-016": [(210, 10)],                # Ceftriaxone injection
        "MED-020": [(150, 5), (310, 6)],      # Montelukast
    }

    for med in MEDICINE_SPECS:
        code = med["code"]
        base = med["base"]
        pattern = med["pattern"]

        stockouts = stockout_schedules.get(code, [])

        for idx, current_date in enumerate(date_list):
            dow = current_date.weekday()  # Monday=0, Sunday=6
            is_weekend = dow in (5, 6)
            weekend_factor = 0.55 if is_weekend else 1.0

            # Pattern logic
            if "high_stable" in pattern or "stable" in pattern or "low_stable" in pattern:
                noise = rng.normal(0, max(1.0, base * 0.15))
                raw = (base + noise) * weekend_factor
                demand = max(0, int(round(raw)))
            elif "increasing" in pattern:
                # 40% growth over total period
                growth = 1.0 + 0.40 * (idx / days)
                noise = rng.normal(0, max(1.0, base * 0.15))
                raw = (base * growth + noise) * weekend_factor
                demand = max(0, int(round(raw)))
            elif "seasonal" in pattern:
                # Peak in winter (Nov - Feb, approx day 60-180 if starting Sep)
                # seasonal amplitude +/- 40%
                season_phase = 2 * np.pi * (idx + 45) / 365.25
                seasonal_multiplier = 1.0 + 0.40 * np.sin(season_phase)
                noise = rng.normal(0, max(1.0, base * 0.15))
                raw = (base * seasonal_multiplier + noise) * weekend_factor
                demand = max(0, int(round(raw)))
            elif "intermittent" in pattern:
                # 70% probability of 0 demand, otherwise discrete Poisson/uniform burst
                is_active = rng.uniform() < 0.28
                if is_active:
                    burst = rng.integers(1, int(base * 3) + 2)
                    demand = burst
                else:
                    demand = 0
            else:
                noise = rng.normal(0, max(1.0, base * 0.15))
                raw = (base + noise) * weekend_factor
                demand = max(0, int(round(raw)))

            # Check stockout condition
            is_stockout = False
            for so_start, so_len in stockouts:
                if so_start <= idx < (so_start + so_len):
                    is_stockout = True
                    break

            if is_stockout:
                units_dispensed = 0
                stockout_observed = True
            else:
                units_dispensed = demand
                stockout_observed = False

            daily_records.append({
                "medicineId": code,
                "date": current_date.isoformat(),
                "unitsDispensed": units_dispensed,
                "stockoutObserved": stockout_observed,
                "dataSource": "synthetic",
                "isDemo": True
            })

    daily_df = pd.DataFrame(daily_records)
    daily_path = os.path.join(output_dir, "daily_usage.csv")
    daily_df.to_csv(daily_path, index=False)
    print(f"Generated {len(daily_df)} daily usage rows at {daily_path}")

    # 2. Medicines Catalog
    meds_df = pd.DataFrame(MEDICINE_SPECS)
    meds_df["isDemo"] = True
    meds_path = os.path.join(output_dir, "medicines.csv")
    meds_df.to_csv(meds_path, index=False)
    print(f"Generated {len(meds_df)} medicines at {meds_path}")

    # 3. Suppliers
    suppliers_df = pd.DataFrame(SUPPLIERS)
    suppliers_df["isDemo"] = True
    supp_path = os.path.join(output_dir, "suppliers.csv")
    suppliers_df.to_csv(supp_path, index=False)
    print(f"Generated {len(suppliers_df)} suppliers at {supp_path}")

    # 4. Batches
    batches = []
    as_of = date_list[-1]
    for i, med in enumerate(MEDICINE_SPECS):
        code = med["code"]
        supp = SUPPLIERS[i % len(SUPPLIERS)]

        # Healthy batch (expires in 12-18 months)
        b1_mfg = as_of - datetime.timedelta(days=100)
        b1_exp = as_of + datetime.timedelta(days=400)
        b1_qty = int(med["reorderLevel"] * 1.5)
        batches.append({
            "batchNumber": f"B-{code}-01",
            "medicineId": code,
            "supplierId": supp["supplierId"],
            "initialQuantity": b1_qty,
            "currentQuantity": b1_qty,
            "receivedAt": b1_mfg.isoformat(),
            "manufacturingDate": b1_mfg.isoformat(),
            "expiryDate": b1_exp.isoformat(),
            "purchaseCostPerUnit": med["unitCost"],
            "status": "active",
            "isDemo": True
        })

        # Batch near expiry (for 1 in 3 medicines, expires in 15 to 45 days)
        if i % 3 == 0:
            b2_days = 20 if i % 2 == 0 else 45
            b2_exp = as_of + datetime.timedelta(days=b2_days)
            b2_mfg = b2_exp - datetime.timedelta(days=365)
            b2_qty = int(med["base"] * 10)
            batches.append({
                "batchNumber": f"B-{code}-02",
                "medicineId": code,
                "supplierId": supp["supplierId"],
                "initialQuantity": b2_qty,
                "currentQuantity": b2_qty,
                "receivedAt": b2_mfg.isoformat(),
                "manufacturingDate": b2_mfg.isoformat(),
                "expiryDate": b2_exp.isoformat(),
                "purchaseCostPerUnit": round(med["unitCost"] * 1.05, 2),
                "status": "active",
                "isDemo": True
            })

        # Expired batch for some medicines (to verify exclusion from usable stock)
        if i % 5 == 0:
            b3_exp = as_of - datetime.timedelta(days=15)
            b3_mfg = b3_exp - datetime.timedelta(days=365)
            b3_qty = 25
            batches.append({
                "batchNumber": f"B-{code}-EXP",
                "medicineId": code,
                "supplierId": supp["supplierId"],
                "initialQuantity": b3_qty,
                "currentQuantity": b3_qty,
                "receivedAt": b3_mfg.isoformat(),
                "manufacturingDate": b3_mfg.isoformat(),
                "expiryDate": b3_exp.isoformat(),
                "purchaseCostPerUnit": round(med["unitCost"] * 0.9, 2),
                "status": "expired",
                "isDemo": True
            })

    batches_df = pd.DataFrame(batches)
    batches_path = os.path.join(output_dir, "batches.csv")
    batches_df.to_csv(batches_path, index=False)
    print(f"Generated {len(batches_df)} batches at {batches_path}")

    # 5. Purchase Orders
    po_records = []
    statuses = ["draft", "pending_approval", "approved", "partially_received", "received"]
    for i in range(15):
        po_num = f"PO-2026-{1001 + i}"
        supp = SUPPLIERS[i % len(SUPPLIERS)]
        status = statuses[i % len(statuses)]
        po_date = as_of - datetime.timedelta(days=20 - i)
        exp_date = po_date + datetime.timedelta(days=supp["leadTimeDays"])
        po_records.append({
            "orderNumber": po_num,
            "supplierId": supp["supplierId"],
            "status": status,
            "orderDate": po_date.isoformat(),
            "expectedDeliveryDate": exp_date.isoformat(),
            "medicineId": MEDICINE_SPECS[i % len(MEDICINE_SPECS)]["code"],
            "quantityOrdered": 200 + i * 20,
            "isDemo": True
        })
    po_df = pd.DataFrame(po_records)
    po_path = os.path.join(output_dir, "purchase_orders.csv")
    po_df.to_csv(po_path, index=False)
    print(f"Generated {len(po_df)} purchase orders at {po_path}")

    return {
        "daily_usage_rows": len(daily_df),
        "medicines_count": len(meds_df),
        "batches_count": len(batches_df),
        "suppliers_count": len(suppliers_df),
        "purchase_orders_count": len(po_df)
    }


if __name__ == "__main__":
    generate_synthetic_data()
