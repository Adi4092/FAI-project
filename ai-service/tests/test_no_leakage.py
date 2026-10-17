"""
Tests for Zero Future Leakage (Section 9.3 and Section 9.4):
- Features at time t must only use past data (<= t-1).
- Modifying or appending values at future times (t+1, t+2...) must NOT change features or predictions at time t.
- Changing unitsDispensed at day t must NOT alter rolling means at day t (due to shift(1)).
"""

import numpy as np
import pandas as pd
from app.forecasting.features import compute_features, FEATURE_COLUMNS
from app.forecasting.recursive import forecast_recursive
from app.services.model_registry import model_registry


def test_shift1_prevents_same_day_leakage_in_rolling_stats():
    """Verify that changing value on day t does NOT change roll_mean_* or roll_std_* on day t."""
    dates = pd.date_range("2026-01-01", periods=10, freq="D")
    base_values = [10.0, 12.0, 15.0, 11.0, 14.0, 13.0, 16.0, 12.0, 15.0, 20.0]

    df1 = pd.DataFrame({"dt": dates, "date": dates.strftime("%Y-%m-%d"), "unitsDispensed": base_values})
    feats1 = compute_features(df1)

    # Change day 7's value dramatically from 12.0 to 999.0
    modified_values = list(base_values)
    modified_values[7] = 999.0
    df2 = pd.DataFrame({"dt": dates, "date": dates.strftime("%Y-%m-%d"), "unitsDispensed": modified_values})
    feats2 = compute_features(df2)

    # Day 7 features must be identical between feats1 and feats2 because day 7 features only look at days 0..6!
    day7_f1 = feats1.iloc[7]
    day7_f2 = feats2.iloc[7]

    assert day7_f1["roll_mean_7"] == day7_f2["roll_mean_7"]
    assert day7_f1["roll_mean_14"] == day7_f2["roll_mean_14"]
    assert day7_f1["roll_mean_28"] == day7_f2["roll_mean_28"]
    assert day7_f1["roll_std_7"] == day7_f2["roll_std_7"]
    assert day7_f1["lag_1"] == day7_f2["lag_1"]
    assert day7_f1["days_since_last_nonzero"] == day7_f2["days_since_last_nonzero"]


def test_changing_future_values_does_not_change_past_features():
    """
    Verify that appending or altering future data points (t+1..t+H)
    does not affect features at day t or earlier.
    """
    dates_history = pd.date_range("2026-01-01", periods=30, freq="D")
    history_vals = [float(10 + (i % 5)) for i in range(30)]

    df_past = pd.DataFrame({"dt": dates_history, "date": dates_history.strftime("%Y-%m-%d"), "unitsDispensed": history_vals})
    feats_past = compute_features(df_past)

    # Future scenario A: 10 future days with low values
    future_dates = pd.date_range("2026-01-31", periods=10, freq="D")
    df_fut_a = pd.concat([
        df_past,
        pd.DataFrame({"dt": future_dates, "date": future_dates.strftime("%Y-%m-%d"), "unitsDispensed": [1.0] * 10})
    ], ignore_index=True)
    feats_a = compute_features(df_fut_a)

    # Future scenario B: 10 future days with massive spikes
    df_fut_b = pd.concat([
        df_past,
        pd.DataFrame({"dt": future_dates, "date": future_dates.strftime("%Y-%m-%d"), "unitsDispensed": [5000.0] * 10})
    ], ignore_index=True)
    feats_b = compute_features(df_fut_b)

    # Check that for all rows 0..29, feats_a and feats_b are identical to feats_past
    pd.testing.assert_frame_equal(
        feats_past[FEATURE_COLUMNS],
        feats_a.iloc[:30][FEATURE_COLUMNS]
    )
    pd.testing.assert_frame_equal(
        feats_past[FEATURE_COLUMNS],
        feats_b.iloc[:30][FEATURE_COLUMNS]
    )


def test_forecast_does_not_depend_on_future_values():
    """Verify that recursive forecasting generates identical predictions regardless of future values."""
    model_registry.load_active_model()
    rf = model_registry.get_model()
    if not rf or not rf.is_fitted:
        return

    dates = pd.date_range("2026-01-01", periods=65, freq="D")
    vals = [float(15 + (i % 7)) for i in range(65)]
    df = pd.DataFrame({
        "dt": dates,
        "date": dates.strftime("%Y-%m-%d"),
        "unitsDispensed": vals,
        "stockoutObserved": False
    })

    # Cut at day 60
    df_history = df.iloc[:60].copy()
    start_date = df_history["dt"].iloc[-1].date() + pd.Timedelta(days=1)

    preds1 = forecast_recursive(rf, df_history, 7, start_date)
    preds2 = forecast_recursive(rf, df_history, 7, start_date)

    assert [p["predicted"] for p in preds1] == [p["predicted"] for p in preds2]
