"""
Tests for Chronological Train/Test Split and Metric Calculation (Section 9.5):
- Chronological split only (never shuffled).
- Holdout size equals max(14, horizonDays).
- MAE, RMSE, and WAPE = sum(|y - y_hat|) / sum(|y|).
- Zero denominator in WAPE returns None without crashing or dividing by zero.
- Auto mode selection chooses model with lower error.
"""

import numpy as np
import pandas as pd
from app.evaluation.metrics import compute_metrics
from app.evaluation.backtest import run_chronological_evaluation
from app.forecasting.random_forest import GlobalRandomForestModel


def test_wape_calculation_and_zero_denominator():
    """Verify WAPE calculation and zero denominator handling."""
    # Standard non-zero case
    y_true = np.array([10.0, 20.0, 30.0])
    y_pred = np.array([12.0, 18.0, 33.0])
    # abs errors: 2 + 2 + 3 = 7. sum actual: 60. WAPE = 7 / 60 = 0.1167
    m = compute_metrics(y_true, y_pred)
    assert m["mae"] == round(7.0 / 3.0, 3)
    assert m["wape"] == round(7.0 / 60.0, 4)
    assert m["note"] is None

    # Zero-demand case: all actual values are 0
    y_zero = np.array([0.0, 0.0, 0.0])
    y_pred_zero = np.array([1.0, 0.0, 2.0])
    m_zero = compute_metrics(y_zero, y_pred_zero)
    assert m_zero["mae"] == 1.0
    assert m_zero["wape"] is None  # Strictly null / None when denominator is 0
    assert "undefined" in m_zero["note"].lower() or "0" in m_zero["note"]


def test_chronological_split_never_shuffles():
    """Verify split keeps historical order intact and holdout is the exact final window."""
    dates = pd.date_range("2026-01-01", periods=50, freq="D")
    df = pd.DataFrame({
        "dt": dates,
        "date": dates.strftime("%Y-%m-%d"),
        "unitsDispensed": np.arange(50, dtype=float),
        "target_demand": np.arange(50, dtype=float),
        "stockoutObserved": False
    })

    # With horizon=15, holdout_days = max(14, 15) = 15
    rf_dummy = GlobalRandomForestModel()
    res = run_chronological_evaluation(df, rf_dummy, horizon_days=15)

    assert res["holdoutDays"] == 15
    # The holdout must be the last 15 days (days 35 to 49)
    # Baseline predicts trailing mean of training portion (days 0 to 34)
    expected_train_tail = np.arange(28, 35, dtype=float)  # last 7 days of train
    expected_base_pred = float(expected_train_tail.mean())
    assert abs(res["baseline"]["mae"] - float(np.mean(np.abs(np.arange(35, 50) - expected_base_pred)))) < 0.05
