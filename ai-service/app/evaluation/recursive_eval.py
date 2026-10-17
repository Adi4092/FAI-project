"""
Multi-Horizon Recursive Holdout Evaluation for MedStock AI.
Evaluates both Random Forest (multi-step recursive) and Moving Average Baseline
on strictly out-of-sample holdout windows of 7, 15, and 30 days across all medicines.
Zero actual holdout values are used during recursive forecasting.
"""

from typing import Dict, Any, List
import datetime
import numpy as np
import pandas as pd

from .metrics import compute_metrics
from ..forecasting.masking import prepare_and_mask_series
from ..forecasting.features import compute_features
from ..forecasting.baseline import MovingAverageBaseline
from ..forecasting.recursive import forecast_recursive
from ..forecasting.random_forest import GlobalRandomForestModel


def evaluate_recursive_multi_horizon(
    rf_model: GlobalRandomForestModel,
    df_raw: pd.DataFrame,
    horizons: List[int] = [7, 15, 30]
) -> Dict[str, Any]:
    """
    For each horizon H in horizons:
      For each medicine:
        - Train portion: strictly observations before the last H days.
        - Holdout portion: the last H days.
        - Recursive forecast: starts at day T-H+1, strictly predicting step-by-step
          without using any actual holdout observations.
        - Baseline forecast: projected flat using trailing moving average before holdout.
      Aggregates out-of-sample errors across all medicines and computes MAE, RMSE, WAPE.
    """
    baseline = MovingAverageBaseline(window=7)
    medicines = df_raw["medicineId"].unique().tolist()

    results_by_horizon = {}

    for H in horizons:
        rf_all_actuals = []
        rf_all_preds = []
        base_all_preds = []

        for med_id in medicines:
            med_rows = df_raw[df_raw["medicineId"] == med_id].to_dict("records")
            prep_df, _ = prepare_and_mask_series(med_rows, med_id)

            if len(prep_df) <= H + 14:
                continue

            train_df = prep_df.iloc[:-H].copy()
            holdout_df = prep_df.iloc[-H:].copy()

            start_date = holdout_df["dt"].iloc[0].date()
            y_actual = holdout_df["target_demand"].values

            # 1. RF Multi-step recursive forecast (NO actual holdout values used)
            rf_res = forecast_recursive(rf_model, train_df, H, start_date)
            y_pred_rf = np.array([p["predicted"] for p in rf_res])

            # 2. Baseline forecast (trailing mean before holdout)
            base_res = baseline.forecast(train_df, H, start_date)
            y_pred_base = np.array([p["predicted"] for p in base_res])

            rf_all_actuals.extend(y_actual)
            rf_all_preds.extend(y_pred_rf)
            base_all_preds.extend(y_pred_base)

        rf_metrics = compute_metrics(np.array(rf_all_actuals), np.array(rf_all_preds))
        base_metrics = compute_metrics(np.array(rf_all_actuals), np.array(base_all_preds))

        results_by_horizon[f"horizon_{H}"] = {
            "horizonDays": H,
            "totalHoldoutObservations": len(rf_all_actuals),
            "randomForest": rf_metrics,
            "baseline": base_metrics
        }

    return results_by_horizon
