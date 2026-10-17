"""
End-to-End API Tests for MedStock AI Service:
- GET /health
- GET /model-info
- POST /forecast
- POST /evaluate
- POST /train
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_get_health(client):
    """Verify GET /health returns status, modelLoaded, and version."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "modelLoaded" in data
    assert "version" in data


def test_get_model_info(client):
    """Verify GET /model-info returns active model information and features."""
    response = client.get("/model-info")
    assert response.status_code == 200
    data = response.json()
    assert "activeModelName" in data
    assert "modelVersion" in data
    assert "featureList" in data
    assert "minimumHistoryRequirements" in data
    assert len(data["featureList"]) >= 15


def test_post_forecast_full_cycle(client):
    """Verify POST /forecast with 70 days history returns forecast, totalPredicted, metrics, and dataWindow."""
    import datetime
    start = datetime.date(2026, 1, 1)
    history = [
        {
            "date": (start + datetime.timedelta(days=i)).isoformat(),
            "unitsDispensed": 25.0 + (i % 6),
            "stockoutObserved": (i == 40)  # 1 stockout day
        }
        for i in range(70)
    ]
    response = client.post("/forecast", json={
        "medicineId": "MED-001",
        "horizonDays": 15,
        "history": history,
        "modelPreference": "auto"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["modelName"] in ["random_forest", "moving_average_baseline"]
    assert len(data["forecast"]) == 15
    assert data["totalPredicted"] > 0
    assert data["dataWindow"]["days"] == 70
    assert data["dataWindow"]["maskedDays"] == 1
    assert data["provisional"] is False


def test_post_evaluate_cycle(client):
    """Verify POST /evaluate returns comparative metrics between RF and baseline."""
    import datetime
    start = datetime.date(2026, 1, 1)
    history = [
        {
            "date": (start + datetime.timedelta(days=i)).isoformat(),
            "unitsDispensed": 18.0 + (i % 5),
            "stockoutObserved": False
        }
        for i in range(50)
    ]
    response = client.post("/evaluate", json={
        "medicineId": "MED-001",
        "horizonDays": 15,
        "history": history
    })
    assert response.status_code == 200
    data = response.json()
    assert data["medicineId"] == "MED-001"
    assert "metrics" in data
    metrics = data["metrics"]
    assert "randomForest" in metrics
    assert "baseline" in metrics
    assert metrics["holdoutDays"] == 15
    assert metrics["selectedModel"] in ["random_forest", "baseline"]


import tempfile
import os
from app.services.model_registry import model_registry


def test_post_train_cycle(client, monkeypatch):
    """Verify POST /train runs retrain and updates version in an isolated temporary directory, without modifying active production model."""
    with tempfile.TemporaryDirectory() as tmpdir:
        monkeypatch.setattr("app.services.trainer.settings.MODEL_DIR", tmpdir)
        monkeypatch.setattr("app.config.settings.MODEL_DIR", tmpdir)

        # Preserve the current production model and metadata from registry
        prev_model = model_registry.get_model()
        prev_meta = dict(model_registry.get_metadata()) if model_registry.get_metadata() else {}

        response = client.post("/train", json={
            "versionNote": "test-retrain"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "test-retrain" in data["modelVersion"]
        assert data["medicinesCount"] >= 1
        assert data["totalRecords"] > 0

        # Verify artifacts were written to the temporary directory, NOT trained_models/
        assert os.path.exists(os.path.join(tmpdir, "active_model.joblib"))
        assert os.path.exists(os.path.join(tmpdir, "active_model_meta.json"))

        # Restore production model in registry
        if prev_model:
            model_registry.set_active_model(prev_model, prev_meta)

