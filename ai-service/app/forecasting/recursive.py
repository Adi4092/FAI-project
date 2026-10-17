"""
Recursive Multi-step Forecaster for MedStock AI.
Complies strictly with Section 9.4:
- Predict day t+1, append prediction to history buffer,
  recompute lag/rolling features, continue up to horizon H.
- Never uses actual future values.
"""

from typing import List, Dict, Any
import datetime
import pandas as pd
from .features import compute_features, FEATURE_COLUMNS
from .random_forest import GlobalRandomForestModel


def forecast_recursive(
    rf_model: GlobalRandomForestModel,
    history_df: pd.DataFrame,
    horizon_days: int,
    start_date: datetime.date
) -> List[Dict[str, Any]]:
    """
    Executes multi-step recursive forecasting using the trained GlobalRandomForestModel.
    Returns list of dicts: [{"date": "YYYY-MM-DD", "predicted": float}]
    """
    # Create working buffer of history
    buffer_df = history_df[["dt", "date", "unitsDispensed", "stockoutObserved"]].copy()
    buffer_df["dt"] = pd.to_datetime(buffer_df["dt"])
    buffer_df["unitsDispensed"] = buffer_df["unitsDispensed"].astype(float)
    buffer_df["stockoutObserved"] = buffer_df["stockoutObserved"].astype(bool)

    forecast_results: List[Dict[str, Any]] = []

    for step in range(horizon_days):
        current_dt = pd.Timestamp(start_date + datetime.timedelta(days=step))
        date_str = current_dt.strftime("%Y-%m-%d")

        # Create temporary row for current_dt to compute lagged/rolling features
        temp_row = pd.DataFrame([{
            "dt": current_dt,
            "date": date_str,
            "unitsDispensed": 0.0,
            "stockoutObserved": False
        }])

        candidate_df = pd.concat([buffer_df, temp_row], ignore_index=True)
        # Compute features across the updated buffer
        feats_df = compute_features(candidate_df)
        last_row = feats_df.iloc[[-1]]

        # Predict next day
        pred_val = rf_model.predict_one(last_row)
        forecast_results.append({
            "date": date_str,
            "predicted": pred_val
        })

        # Append prediction into history buffer for future recursive steps
        temp_row["unitsDispensed"] = pred_val
        buffer_df = pd.concat([buffer_df, temp_row], ignore_index=True)

    return forecast_results
