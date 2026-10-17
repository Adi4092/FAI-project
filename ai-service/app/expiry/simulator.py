"""
Expiry-Risk Simulation Engine for MedStock AI.
Implements Section 9.7 of the specification:
- Day-by-day FEFO allocation across usable batches and confirmed incoming lots.
- Shelf-life timeline evaluation.
- Extrapolation detection beyond forecast horizon.
- Configurable risk thresholds (Low, Medium, High, Critical).
- Factual reason generation and non-clinical suggested actions.
"""

import datetime
from typing import List, Dict, Any, Optional
from ..schemas.expiry import (
    BatchSimulationInput,
    IncomingLotInput,
    DailyForecastItem,
    BatchExpiryRiskResult,
    ExpiryRiskResponse,
    ExpiryRiskRequest
)


def run_expiry_simulation(
    req: Optional[ExpiryRiskRequest] = None,
    *,
    as_of_date_str: Optional[str] = None,
    window_days: int = 90,
    batches: Optional[List[BatchSimulationInput]] = None,
    daily_forecast: Optional[List[DailyForecastItem]] = None,
    incoming: Optional[List[IncomingLotInput]] = None,
    extrapolation_daily_demand: Optional[float] = None
) -> ExpiryRiskResponse:
    """
    Executes day-by-day FEFO simulation.
    Accepts either an ExpiryRiskRequest object or keyword arguments.
    """
    if req is not None:
        as_of_date_str = req.asOfDate
        window_days = req.windowDays
        batches = req.batches
        daily_forecast = req.dailyForecast
        incoming = req.incoming
        extrapolation_daily_demand = req.extrapolationDailyDemand
        has_saved_forecast = req.hasSavedForecast if req.hasSavedForecast is not None else (len(daily_forecast) > 0)
        trailing_days = req.trailingDays or 28
    else:
        batches = batches or []
        daily_forecast = daily_forecast or []
        incoming = incoming or []
        has_saved_forecast = len(daily_forecast) > 0
        trailing_days = 28

    as_of_date = datetime.date.fromisoformat(as_of_date_str)
    
    # 1. Prepare Demand Map
    forecast_map: Dict[str, float] = {
        item.date: float(item.predicted) for item in daily_forecast
    }
    
    if extrapolation_daily_demand is not None:
        fallback_demand = max(0.0, float(extrapolation_daily_demand))
    elif daily_forecast:
        fallback_demand = sum(item.predicted for item in daily_forecast) / len(daily_forecast)
    else:
        fallback_demand = 0.0

    # 2. Determine Timeline Bounds
    window_end_date = as_of_date + datetime.timedelta(days=window_days)
    batch_expiries = [datetime.date.fromisoformat(b.expiryDate) for b in batches]
    
    if batch_expiries:
        max_expiry = max(batch_expiries)
        timeline_end = max(window_end_date, max_expiry)
    else:
        timeline_end = window_end_date

    total_days = (timeline_end - as_of_date).days + 1

    # 3. Initialize Lots Tracking
    lots: List[Dict[str, Any]] = []

    for b in batches:
        b_exp = datetime.date.fromisoformat(b.expiryDate)
        b_recv = datetime.date.fromisoformat(b.receivedAt) if b.receivedAt else as_of_date
        lots.append({
            "lotId": b.batchId,
            "isBatch": True,
            "expiryDate": b_exp,
            "availableDate": as_of_date,
            "receivedAt": b_recv,
            "initialQuantity": float(b.quantity),
            "remainingQuantity": float(b.quantity),
            "consumed": 0.0,
            "unitCost": b.unitCost,
            "extrapolatedUsed": False
        })

    for idx, inc in enumerate(incoming):
        inc_exp = datetime.date.fromisoformat(inc.expiryDate)
        inc_avail = datetime.date.fromisoformat(inc.expectedDate)
        lots.append({
            "lotId": f"incoming_{idx}_{inc.expectedDate}",
            "isBatch": False,
            "expiryDate": inc_exp,
            "availableDate": inc_avail,
            "receivedAt": inc_avail,
            "initialQuantity": float(inc.quantity),
            "remainingQuantity": float(inc.quantity),
            "consumed": 0.0,
            "unitCost": None,
            "extrapolatedUsed": False
        })

    # 4. Day-by-day FEFO Allocation Loop
    for day_offset in range(total_days):
        current_date = as_of_date + datetime.timedelta(days=day_offset)
        date_str = current_date.isoformat()

        # Demand determination
        if date_str in forecast_map:
            day_demand = forecast_map[date_str]
            is_extrapolated = False
        else:
            day_demand = fallback_demand
            is_extrapolated = True

        # Eligible lots on current_date:
        # Available on or before current_date, strictly before expiryDate
        active_lots = [
            lot for lot in lots
            if lot["availableDate"] <= current_date < lot["expiryDate"]
            and lot["remainingQuantity"] > 0
        ]

        if not active_lots or day_demand <= 0:
            continue

        # Sort FEFO: earliest expiryDate first, then receivedAt
        active_lots.sort(key=lambda l: (l["expiryDate"], l["receivedAt"]))

        rem_demand = day_demand
        for lot in active_lots:
            if rem_demand <= 0:
                break

            alloc = min(lot["remainingQuantity"], rem_demand)
            lot["remainingQuantity"] -= alloc
            lot["consumed"] += alloc
            rem_demand -= alloc

            if is_extrapolated and lot["isBatch"]:
                lot["extrapolatedUsed"] = True

    # 5. Compile Results for each Batch
    results: List[BatchExpiryRiskResult] = []
    max_forecast_date = (
        max(datetime.date.fromisoformat(item.date) for item in daily_forecast)
        if daily_forecast
        else as_of_date
    )

    for b in batches:
        b_exp = datetime.date.fromisoformat(b.expiryDate)
        b_lot = next(l for l in lots if l["lotId"] == b.batchId and l["isBatch"])

        initial_qty = b_lot["initialQuantity"]
        expected_consumed = round(b_lot["consumed"], 2)
        expected_leftover = round(max(0.0, initial_qty - expected_consumed), 2)
        
        if initial_qty > 0:
            leftover_pct = round((expected_leftover / initial_qty) * 100.0, 1)
        else:
            leftover_pct = 0.0

        exposure_value = (
            round(expected_leftover * b.unitCost, 2)
            if b.unitCost is not None
            else None
        )

        days_to_expiry = max(0, (b_exp - as_of_date).days)

        # Risk level determination per Section 9.7:
        # - Low: leftoverPct < 10%
        # - Medium: 10% <= leftoverPct < 30%
        # - High: 30% <= leftoverPct < 60%
        # - Critical: leftoverPct >= 60%, OR (leftoverPct >= 30% and daysToExpiry <= 14)
        if leftover_pct >= 60.0 or (leftover_pct >= 30.0 and days_to_expiry <= 14):
            risk_level = "critical"
        elif leftover_pct >= 30.0:
            risk_level = "high"
        elif leftover_pct >= 10.0:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Reasons generation
        reasons: List[str] = []
        if days_to_expiry <= 14:
            reasons.append(f"Only {days_to_expiry} days of shelf life remain (immediate expiry window)")
        elif days_to_expiry <= 30:
            reasons.append(f"Only {days_to_expiry} days of shelf life remain")
        elif days_to_expiry <= 90:
            reasons.append(f"{days_to_expiry} days of shelf life remain within review horizon")

        consumed_pct = round(100.0 - leftover_pct, 1)
        if leftover_pct > 0:
            reasons.append(f"Projected demand covers only {consumed_pct}% of this batch under FEFO")
        else:
            reasons.append("Projected demand fully covers this batch before expiration")

        # Check if other earlier lots or incoming lots impacted this batch
        other_earlier_lots = [
            l for l in lots
            if l["lotId"] != b.batchId and l["expiryDate"] < b_exp and l["consumed"] > 0
        ]
        if other_earlier_lots:
            reasons.append("Earlier-expiring batches are prioritized for consumption under FEFO")

        other_incoming_lots = [
            l for l in lots
            if not l["isBatch"] and l["availableDate"] < b_exp and l["consumed"] > 0
        ]
        if other_incoming_lots:
            reasons.append("Confirmed incoming purchase order deliveries absorb a portion of projected demand")

        b_last_active = b_exp - datetime.timedelta(days=1)
        confidence_note = None
        if has_saved_forecast:
            extrapolated = b_lot["extrapolatedUsed"] or (b_last_active > max_forecast_date)
            if extrapolated:
                confidence = "low"
                confidence_note = "Estimate extrapolated beyond forecast horizon — lower confidence"
                reasons.append(confidence_note)
            else:
                confidence = "normal"
        else:
            extrapolated = False
            confidence = "low"
            confidence_note = f"No saved forecast; estimated from the last {trailing_days} days of average usage"
            reasons.append(confidence_note)

        # Suggested actions (non-clinical per Section 9.7)
        suggested_actions: List[str] = []
        if risk_level in ["critical", "high"]:
            suggested_actions.append("Prioritise dispensing this batch")
            suggested_actions.append("Review pending reorders to avoid excess accumulation")
            suggested_actions.append("Check redistribution or supplier return options")
            suggested_actions.append("Avoid placing new replenishment orders until usable stock clears")
        elif risk_level == "medium":
            suggested_actions.append("Monitor dispensing velocity against expiration timeline")
            suggested_actions.append("Ensure FEFO adherence in dispensing operations")
        else:
            suggested_actions.append("Stock projected to clear before expiry under regular consumption")

        results.append(BatchExpiryRiskResult(
            batchId=b.batchId,
            expectedConsumed=expected_consumed,
            expectedLeftover=expected_leftover,
            leftoverPct=leftover_pct,
            exposureValue=exposure_value,
            riskLevel=risk_level,
            reasons=reasons,
            suggestedActions=suggested_actions,
            extrapolated=extrapolated,
            confidence=confidence,
            confidenceNote=confidence_note
        ))

    return ExpiryRiskResponse(
        asOfDate=as_of_date_str,
        results=results
    )
