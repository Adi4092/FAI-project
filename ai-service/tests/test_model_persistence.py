"""
Tests for Model Persistence and Joblib Round-Trip (Section 9.6):
- Serializes and deserializes GlobalRandomForestModel with Joblib.
- Verifies that predictions after load match pre-save predictions exactly.
- Verifies model metadata and versioning.
"""

import os
import tempfile
import joblib
import numpy as np
import pandas as pd
from app.forecasting.random_forest import GlobalRandomForestModel
from app.forecasting.features import compute_features
from app.services.model_registry import ModelRegistry


def test_joblib_save_and_load_roundtrip():
    """Verify Joblib serialization produces identical predictions after reload."""
    dates = pd.date_range("2026-01-01", periods=50, freq="D")
    df = pd.DataFrame({
        "dt": dates,
        "date": dates.strftime("%Y-%m-%d"),
        "unitsDispensed": np.sin(np.arange(50)) * 5.0 + 20.0,
        "stockoutObserved": False
    })
    feats = compute_features(df)
    feats["target_demand"] = feats["unitsDispensed"]

    # Fit model
    rf = GlobalRandomForestModel(n_estimators=30, random_state=42)
    rf.fit(feats)

    # Sample row for prediction
    test_row = feats.iloc[[-1]]
    pred_before = rf.predict_one(test_row)

    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = os.path.join(tmpdir, "model.joblib")
        joblib.dump(rf, model_path)

        loaded_rf = joblib.load(model_path)
        pred_after = loaded_rf.predict_one(test_row)

        assert pred_before == pred_after
        assert loaded_rf.is_fitted is True


def test_registry_loads_active_model():
    """Verify ModelRegistry successfully loads model from configured MODEL_DIR."""
    registry = ModelRegistry()
    loaded = registry.load_active_model()
    # The active model was trained and saved to trained_models/
    assert loaded is True
    assert registry.is_model_loaded() is True
    meta = registry.get_metadata()
    assert meta["activeModelName"] == "random_forest"
    assert "modelVersion" in meta
