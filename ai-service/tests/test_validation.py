"""
Tests for Request Validation and Error Formatting.
Verifies:
- Horizon validation: only 7, 15, 30 accepted; all others rejected with 422.
- Missing required fields rejected with 422.
- Error payloads are clean JSON without stack traces.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_valid_horizons_accepted():
    """Verify that horizons 7, 15, and 30 are accepted."""
    history = [
        {"date": f"2026-01-{(i+1):02d}", "unitsDispensed": 10.0, "stockoutObserved": False}
        for i in range(20)
    ]
    for horizon in [7, 15, 30]:
        response = client.post("/forecast", json={
            "medicineId": "MED-001",
            "horizonDays": horizon,
            "history": history,
            "modelPreference": "baseline"
        })
        assert response.status_code == 200, f"Expected 200 for horizon {horizon}, got {response.status_code}: {response.text}"
        data = response.json()
        assert len(data["forecast"]) == horizon


def test_invalid_horizons_rejected():
    """Verify that horizons other than 7, 15, 30 are rejected with HTTP 422 and clean JSON."""
    history = [
        {"date": f"2026-01-{(i+1):02d}", "unitsDispensed": 10.0, "stockoutObserved": False}
        for i in range(20)
    ]
    for invalid_h in [0, 5, 10, 14, 16, 28, 45, 60, -7]:
        response = client.post("/forecast", json={
            "medicineId": "MED-001",
            "horizonDays": invalid_h,
            "history": history
        })
        assert response.status_code == 422, f"Expected 422 for horizon {invalid_h}, got {response.status_code}"
        body = response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"
        # Verify no stack trace is exposed
        assert "traceback" not in response.text.lower()
        assert "Traceback" not in response.text


def test_missing_required_fields_rejected():
    """Verify missing medicineId or history is rejected with clean 422 error."""
    # Missing medicineId
    res1 = client.post("/forecast", json={"horizonDays": 15, "history": []})
    assert res1.status_code == 422
    assert res1.json()["success"] is False

    # Missing history
    res2 = client.post("/forecast", json={"medicineId": "MED-001", "horizonDays": 15})
    assert res2.status_code == 422
    assert res2.json()["success"] is False


def test_negative_units_dispensed_rejected():
    """Verify negative unitsDispensed is rejected by Pydantic validation."""
    response = client.post("/forecast", json={
        "medicineId": "MED-001",
        "horizonDays": 15,
        "history": [{"date": "2026-01-01", "unitsDispensed": -5.0, "stockoutObserved": False}]
    })
    assert response.status_code == 422
    assert response.json()["success"] is False
