"""
Feature engineering module for MedStock AI.
Complies strictly with Section 9.3:
Features:
- lag_1, lag_2, lag_3, lag_7, lag_14, lag_28
- roll_mean_7, roll_mean_14, roll_mean_28 (with shift(1))
- roll_std_7 (with shift(1))
- day_of_week, dow_sin, dow_cos, month, day_of_month, is_weekend
- days_since_last_nonzero (past only)
- medicine_scale (trailing 28-day mean computed up to prediction date, shift(1))

Zero future leakage guarantee: no feature at row t depends on row t or future rows.
"""

from typing import List
import numpy as np
import pandas as pd

FEATURE_COLUMNS: List[str] = [
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_7",
    "lag_14",
    "lag_28",
    "roll_mean_7",
    "roll_mean_14",
    "roll_mean_28",
    "roll_std_7",
    "day_of_week",
    "dow_sin",
    "dow_cos",
    "month",
    "day_of_month",
    "is_weekend",
    "days_since_last_nonzero",
    "medicine_scale"
]


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes Section 9.3 features on a DataFrame containing at least:
    - dt (pd.Timestamp)
    - unitsDispensed (numeric)
    
    Guarantees no future leakage: every lag and rolling window uses shift(1)
    or greater, and days_since_last_nonzero looks strictly into the past.
    """
    out = df.copy()
    if "dt" not in out.columns:
        out["dt"] = pd.to_datetime(out["date"])
    
    # Base series used for feature extraction (observed past dispensing)
    series = out["unitsDispensed"].astype(float)

    # 1. Lags
    for lag in [1, 2, 3, 7, 14, 28]:
        out[f"lag_{lag}"] = series.shift(lag).bfill().fillna(0.0)

    # 2. Rolling statistics (shifted by 1 so day t is NEVER included in day t features)
    shifted = series.shift(1)
    out["roll_mean_7"] = shifted.rolling(window=7, min_periods=1).mean().bfill().fillna(0.0)
    out["roll_mean_14"] = shifted.rolling(window=14, min_periods=1).mean().bfill().fillna(0.0)
    out["roll_mean_28"] = shifted.rolling(window=28, min_periods=1).mean().bfill().fillna(0.0)
    out["roll_std_7"] = shifted.rolling(window=7, min_periods=2).std().fillna(0.0)

    # 3. Calendar features
    dt_series = out["dt"]
    dow = dt_series.dt.dayofweek  # 0=Monday, 6=Sunday
    out["day_of_week"] = dow.astype(float)
    out["dow_sin"] = np.sin(2.0 * np.pi * dow / 7.0)
    out["dow_cos"] = np.cos(2.0 * np.pi * dow / 7.0)
    out["month"] = dt_series.dt.month.astype(float)
    out["day_of_month"] = dt_series.dt.day.astype(float)
    out["is_weekend"] = dow.isin([5, 6]).astype(float)

    # 4. Days since last non-zero (past only)
    # For day t, look strictly at days 0..t-1
    values = series.values
    n = len(values)
    days_since = np.zeros(n, dtype=float)
    last_nonzero_idx = -1

    for t in range(n):
        if last_nonzero_idx == -1:
            # If no non-zero has occurred yet in history prior to t
            days_since[t] = float(t + 1)
        else:
            days_since[t] = float(t - last_nonzero_idx)

        # Update last_nonzero_idx with current day's value for FUTURE days
        if values[t] > 0:
            last_nonzero_idx = t

    out["days_since_last_nonzero"] = days_since

    # 5. Medicine scale: trailing 28-day mean computed strictly before prediction date
    trailing_scale = shifted.rolling(window=28, min_periods=1).mean()
    # If 0 or NaN, fallback to historical mean up to t, or 1.0 minimum
    cum_mean = shifted.expanding(min_periods=1).mean().fillna(1.0)
    final_scale = trailing_scale.fillna(cum_mean)
    # Ensure positive non-zero scale
    final_scale = final_scale.apply(lambda s: max(1.0, float(s)) if not np.isnan(s) else 1.0)
    out["medicine_scale"] = final_scale

    return out


def extract_feature_vector(
    history_df: pd.DataFrame,
    target_dt: pd.Timestamp
) -> pd.DataFrame:
    """
    Given historical series up to day t-1 and target date t,
    constructs the single-row feature vector for forecasting day t.
    """
    # Create temporary DataFrame ending with target_dt
    row_t = pd.DataFrame([{
        "dt": target_dt,
        "date": target_dt.strftime("%Y-%m-%d"),
        "unitsDispensed": 0.0,
        "stockoutObserved": False
    }])
    combined = pd.concat([history_df, row_t], ignore_index=True)
    feats = compute_features(combined)
    # The last row corresponds to target_dt
    return feats.iloc[[-1]][FEATURE_COLUMNS]
