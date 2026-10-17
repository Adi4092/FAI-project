"""
Tests for Data Preparation and Masking (Section 9.2):
- Days with stockoutObserved=True must be masked (np.nan in target_demand).
- Masked days are strictly excluded from training and holdout evaluation targets.
- Stockout days must NEVER be treated as zero demand.
- Missing days in calendar range are filled with 0.0 only where no stockout was observed.
- Legitimate zero-dispensing days on intermittent items (where stockoutObserved=False)
  are preserved as 0.0, NOT masked.
"""

import numpy as np
import pandas as pd
from app.forecasting.masking import prepare_and_mask_series
from app.evaluation.metrics import compute_metrics


def test_stockout_days_are_masked_not_zero():
    """Verify stockoutObserved=True sets target_demand to NaN, not 0.0."""
    history = [
        {"date": "2026-01-01", "unitsDispensed": 15.0, "stockoutObserved": False},
        {"date": "2026-01-02", "unitsDispensed": 0.0, "stockoutObserved": True},  # Stockout
        {"date": "2026-01-03", "unitsDispensed": 14.0, "stockoutObserved": False},
        {"date": "2026-01-04", "unitsDispensed": 0.0, "stockoutObserved": True},  # Stockout
        {"date": "2026-01-05", "unitsDispensed": 16.0, "stockoutObserved": False},
    ]
    df, meta = prepare_and_mask_series(history, "MED-001")

    assert meta["days"] == 5
    assert meta["maskedDays"] == 2
    assert meta["validDays"] == 3

    # On stockout days, target_demand MUST be NaN (censored), never 0.0
    assert np.isnan(df.loc[df["date"] == "2026-01-02", "target_demand"].values[0])
    assert np.isnan(df.loc[df["date"] == "2026-01-04", "target_demand"].values[0])

    # On non-stockout days, target_demand equals unitsDispensed
    assert df.loc[df["date"] == "2026-01-01", "target_demand"].values[0] == 15.0
    assert df.loc[df["date"] == "2026-01-03", "target_demand"].values[0] == 14.0


def test_intermittent_zeros_are_not_masked():
    """Verify legitimate zero-dispensing days with stockoutObserved=False are preserved as 0.0."""
    history = [
        {"date": "2026-01-01", "unitsDispensed": 10.0, "stockoutObserved": False},
        {"date": "2026-01-02", "unitsDispensed": 0.0, "stockoutObserved": False},  # Legitimate zero
        {"date": "2026-01-03", "unitsDispensed": 0.0, "stockoutObserved": False},  # Legitimate zero
        {"date": "2026-01-04", "unitsDispensed": 12.0, "stockoutObserved": False},
    ]
    df, meta = prepare_and_mask_series(history, "MED-024")

    assert meta["maskedDays"] == 0
    assert meta["validDays"] == 4
    # Ensure targets are 0.0 and NOT NaN
    assert df.loc[df["date"] == "2026-01-02", "target_demand"].values[0] == 0.0
    assert df.loc[df["date"] == "2026-01-03", "target_demand"].values[0] == 0.0


def test_missing_calendar_days_filled():
    """Verify gap in dates is filled with continuous calendar days."""
    history = [
        {"date": "2026-01-01", "unitsDispensed": 10.0, "stockoutObserved": False},
        # Gap on 2026-01-02 and 2026-01-03
        {"date": "2026-01-04", "unitsDispensed": 15.0, "stockoutObserved": False},
    ]
    df, meta = prepare_and_mask_series(history, "MED-001")
    assert meta["days"] == 4
    dates = df["date"].tolist()
    assert dates == ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]
    # Missing days default to 0.0 unitsDispensed and stockoutObserved=False
    assert df.loc[df["date"] == "2026-01-02", "unitsDispensed"].values[0] == 0.0
    assert df.loc[df["date"] == "2026-01-02", "stockoutObserved"].values[0] == False


def test_metrics_ignore_masked_days():
    """Verify compute_metrics ignores NaN values in y_true without treating them as 0."""
    y_true = np.array([10.0, np.nan, 20.0, np.nan, 30.0])  # 2 masked days
    y_pred = np.array([12.0, 50.0,   18.0, 99.0,   30.0])

    # Errors on valid days: |10-12|=2, |20-18|=2, |30-30|=0 -> MAE = (2+2+0)/3 = 1.333
    metrics = compute_metrics(y_true, y_pred)
    assert metrics["mae"] == round(4.0 / 3.0, 3)
    # Sum actual = 10 + 20 + 30 = 60. Sum abs err = 4. WAPE = 4 / 60 = 0.0667
    assert metrics["wape"] == round(4.0 / 60.0, 4)
