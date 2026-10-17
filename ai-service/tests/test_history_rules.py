"""
Tests for Section 9.6 Minimum History Rules and Intermittent Warnings:
- < 14 valid days rejected with INSUFFICIENT_HISTORY (HTTP 422).
- 14-59 valid days: baseline only, provisional=True, warning added.
- >= 60 valid days: provisional=False, RF/baseline comparison enabled.
- Intermittent / zero-heavy series triggers warning.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_insufficient_history_below_14_days_rejected():
    """Verify that history with fewer than 14 non-masked days returns 422 INSUFFICIENT_HISTORY."""
    history = [
        {"date": f"2026-01-{(i+1):02d}", "unitsDispensed": 10.0, "stockoutObserved": False}
        for i in range(10)  # Only 10 days
    ]
    response = client.post("/forecast", json={
        "medicineId": "MED-001",
        "horizonDays": 15,
        "history": history
    })
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INSUFFICIENT_HISTORY"
    assert "14" in body["error"]["message"]
    # Ensure no stack trace
    assert "traceback" not in response.text.lower()


def test_insufficient_history_when_masked_days_reduce_valid_count():
    """Verify that 15 total days with 3 stockout days (leaving 12 valid) is rejected."""
    history = [
        {"date": f"2026-01-{(i+1):02d}", "unitsDispensed": 10.0, "stockoutObserved": (i < 3)}
        for i in range(15)  # 15 days total, 3 masked -> 12 valid days
    ]
    response = client.post("/forecast", json={
        "medicineId": "MED-001",
        "horizonDays": 7,
        "history": history
    })
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "INSUFFICIENT_HISTORY"
    assert body["error"]["validDays"] == 12


def test_provisional_baseline_between_14_and_59_days():
    """Verify that 14-59 days forces moving average baseline with provisional=True and warning."""
    history = [
        {"date": f"2026-01-{(i+1):02d}", "unitsDispensed": 15.0, "stockoutObserved": False}
        for i in range(30)  # 30 days
    ]
    response = client.post("/forecast", json={
        "medicineId": "MED-001",
        "horizonDays": 15,
        "history": history,
        "modelPreference": "random_forest"  # Even if requesting RF, rule forces baseline
    })
    assert response.status_code == 200
    data = response.json()
    assert data["provisional"] is True
    assert data["modelName"] == "moving_average_baseline"
    assert any("provisional" in w.lower() or "baseline" in w.lower() for w in data["warnings"])


def test_full_model_at_60_or_more_days():
    """Verify that >= 60 days produces non-provisional forecast."""
    # 70 days history
    import datetime
    start = datetime.date(2026, 1, 1)
    history = [
        {
            "date": (start + datetime.timedelta(days=i)).isoformat(),
            "unitsDispensed": 20.0 + (i % 5),
            "stockoutObserved": False
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
    assert data["provisional"] is False
    assert len(data["forecast"]) == 15


def test_intermittent_series_warning():
    """Verify that mostly-zero series triggers intermittent demand warning."""
    # 35 days with 80% zeros
    history = [
        {
            "date": f"2026-01-{(i+1):02d}",
            "unitsDispensed": 12.0 if (i % 5 == 0) else 0.0,
            "stockoutObserved": False
        }
        for i in range(31)
    ]
    response = client.post("/forecast", json={
        "medicineId": "MED-024",
        "horizonDays": 15,
        "history": history
    })
    assert response.status_code == 200
    data = response.json()
    assert any("intermittent demand" in w for w in data["warnings"])
