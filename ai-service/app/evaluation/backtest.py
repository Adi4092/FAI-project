"""
Chronological Backtest and Comparative Evaluator for MedStock AI.
Complies with Section 9.5 & Section 9.6:
- Strictly chronological split (never shuffled).
- Holdout window = max(14, horizonDays).
- Evaluates Random Forest vs Moving Average Baseline on identical holdout period.
- Masked stockout days excluded from holdout target comparison.
- Picks better model in auto mode based on lower WAPE (or lower MAE if WAPE is null).
"""

from typing import Dict, Any, Tuple
import datetime
import numpy as np
import pandas as pd

from .metrics import compute_metrics
from ..forecasting.baseline import MovingAverageBaseline
from ..forecasting.random_forest import GlobalRandomForestModel
from ..forecasting.recursive import forecast_recursive


def run_chronological_evaluation(
    df: pd.DataFrame,
    rf_model: GlobalRandomForestModel,
    horizon_days: int = 15
) -> Dict[str, Any]:
    """
    Performs a strictly chronological holdout split and compares RF against Baseline.
    df must be a prepared and masked continuous daily DataFrame.
    """
    total_days = len(df)
    holdout_days = max(14, horizon_days)

    if total_days <= holdout_days:
        # Not enough history for holdout split
        return {
            "error": "INSUFFICIENT_HISTORY_FOR_HOLDOUT",
            "message": f"Total days ({total_days}) must be greater than holdout period ({holdout_days})"
        }

    train_df = df.iloc[:-holdout_days].copy()
    test_df = df.iloc[-holdout_days:].copy()

    # Holdout actual values (masked stockout days are NaN)
    y_actual = test_df["target_demand"].values
    holdout_start_date = test_df["dt"].iloc[0].date()

    # 1. Baseline Holdout Forecast
    baseline = MovingAverageBaseline(window=7)
    base_preds_dict = baseline.forecast(train_df, holdout_days, holdout_start_date)
    y_pred_baseline = np.array([p["predicted"] for p in base_preds_dict])
    baseline_metrics = compute_metrics(y_actual, y_pred_baseline)

    # 2. RF Holdout Forecast (recursive)
    rf_metrics = {"mae": None, "rmse": None, "wape": None, "note": "RF not fitted"}
    if rf_model.is_fitted:
        rf_preds_dict = forecast_recursive(rf_model, train_df, holdout_days, holdout_start_date)
        y_pred_rf = np.array([p["predicted"] for p in rf_preds_dict])
        rf_metrics = compute_metrics(y_actual, y_pred_rf)

    # 3. Model Selection in Auto Mode
    # Rule: Pick lower WAPE; if WAPE is null, pick lower MAE. Do not assume RF wins.
    selected_model = "baseline"
    selection_reason = "Baseline selected by default"

    rf_wape = rf_metrics.get("wape")
    base_wape = baseline_metrics.get("wape")
    rf_mae = rf_metrics.get("mae")
    base_mae = baseline_metrics.get("mae")

    if rf_model.is_fitted and rf_mae is not None:
        if rf_wape is not None and base_wape is not None:
            if rf_wape < base_wape:
                selected_model = "random_forest"
                selection_reason = f"Random Forest achieved lower WAPE ({rf_wape:.4f} vs {base_wape:.4f})"
            else:
                selected_model = "baseline"
                selection_reason = f"Baseline achieved lower or equal WAPE ({base_wape:.4f} vs {rf_wape:.4f})"
        elif rf_wape is not None:
            selected_model = "random_forest"
            selection_reason = "Random Forest has valid WAPE while baseline WAPE is undefined"
        elif base_wape is not None:
            selected_model = "baseline"
            selection_reason = "Baseline has valid WAPE while Random Forest WAPE is undefined"
        else:
            # Both WAPEs null, fall back to MAE
            if rf_mae < base_mae:
                selected_model = "random_forest"
                selection_reason = f"Random Forest achieved lower MAE ({rf_mae:.2f} vs {base_mae:.2f}) with zero actual demand"
            else:
                selected_model = "baseline"
                selection_reason = f"Baseline achieved lower or equal MAE ({base_mae:.2f} vs {rf_mae:.2f}) with zero actual demand"

    return {
        "holdoutDays": holdout_days,
        "baseline": baseline_metrics,
        "randomForest": rf_metrics,
        "selectedModel": selected_model,
        "selectionReason": selection_reason
    }
