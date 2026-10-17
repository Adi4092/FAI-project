"""
Evaluation Metrics for MedStock AI.
Complies with Section 9.5:
- MAE: Mean Absolute Error
- RMSE: Root Mean Square Error
- WAPE: Weighted Absolute Percentage Error (Σ|y - ŷ| / Σ|y|)
  Defined as null (None in Python) when denominator Σ|y| == 0.
- Masks (NaNs) are strictly excluded from calculations.
"""

from typing import Dict, Any, Optional
import numpy as np


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray
) -> Dict[str, Optional[float]]:
    """
    Computes MAE, RMSE, and WAPE.
    Excludes elements where y_true is NaN (e.g. stockout-masked days).
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    # Filter out NaNs (censored demand)
    valid_mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    if not np.any(valid_mask):
        return {
            "mae": None,
            "rmse": None,
            "wape": None,
            "note": "No valid non-masked observations in evaluation period"
        }

    yt = y_true[valid_mask]
    yp = y_pred[valid_mask]
    n = len(yt)

    abs_errors = np.abs(yt - yp)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(np.square(abs_errors))))

    sum_actual = float(np.sum(np.abs(yt)))
    if sum_actual == 0.0:
        wape = None
        note = "WAPE is undefined because sum of actual demand is 0"
    else:
        wape = float(np.sum(abs_errors) / sum_actual)
        note = None

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "wape": round(wape, 4) if wape is not None else None,
        "note": note
    }
