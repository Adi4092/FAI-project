"""
Unit and Integration Tests for Expiry-Risk Simulation.
Tests:
1. Worked example from Section 9.7 & prompt:
   - 100 units, forecast 3 per day, expires in 10 days -> leftover 70, 70.0%, risk Critical
2. Multi-batch FEFO allocation across batches.
3. Incoming lot that changes the result.
4. Extrapolation beyond forecast horizon marked with lower confidence.
5. FastAPI /expiry-risk HTTP endpoint.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.expiry.simulator import run_expiry_simulation
from app.schemas.expiry import (
    ExpiryRiskRequest,
    BatchSimulationInput,
    IncomingLotInput,
    DailyForecastItem
)


@pytest.fixture
def client():
    return TestClient(app)


def test_expiry_risk_worked_example():
    """
    Worked example specified in prompt and Section 9.7:
    batch A 100 units expiring in 10 days; forecast demand 3 units/day;
    no other batches -> consumed 30, leftover 70, leftoverPct 70% -> Critical.
    """
    as_of = "2026-10-15"
    expiry = "2026-10-25"  # exactly 10 days after as_of
    forecast = [
        DailyForecastItem(date=f"2026-10-{15 + i:02d}", predicted=3.0)
        for i in range(10)
    ]
    batches = [
        BatchSimulationInput(
            batchId="batch-A",
            expiryDate=expiry,
            quantity=100.0,
            unitCost=5.0
        )
    ]
    req = ExpiryRiskRequest(
        asOfDate=as_of,
        windowDays=30,
        dailyForecast=forecast,
        batches=batches,
        incoming=[]
    )

    res = run_expiry_simulation(req)
    assert len(res.results) == 1
    r = res.results[0]
    assert r.batchId == "batch-A"
    assert r.expectedConsumed == 30.0
    assert r.expectedLeftover == 70.0
    assert r.leftoverPct == 70.0
    assert r.riskLevel == "critical"
    assert r.exposureValue == 350.0  # 70 * 5.0
    assert not r.extrapolated
    assert r.confidence == "normal"


def test_expiry_risk_multi_batch_fefo():
    """
    Multi-batch FEFO:
    Batch 1: 40 units, expires in 5 days (2026-10-20)
    Batch 2: 60 units, expires in 15 days (2026-10-30)
    Demand: 10 units/day for 15 days (total 150 units demanded)
    
    Under FEFO:
    Days 0..4 (5 days): 50 demand.
    Batch 1 has 40 units -> consumed 40, leftover 0.
    The remaining 10 demand on day 4 + days 5..14 (100 demand) = 110 demand hits Batch 2.
    Batch 2 has 60 units -> consumed 60, leftover 0.
    
    If demand was only 4 units/day (total 60):
    Days 0..4: 20 demand -> Batch 1 consumed 20, leftover 20 (50%, critical due to daysToExpiry<=14).
    Batch 2: days 5..14: 40 demand -> Batch 2 consumed 40, leftover 20 (33.3%, high).
    Batch 1 was prioritized over Batch 2.
    """
    as_of = "2026-10-15"
    forecast = [
        DailyForecastItem(date=f"2026-10-{15 + i:02d}", predicted=4.0)
        for i in range(15)
    ]
    batches = [
        BatchSimulationInput(batchId="b2", expiryDate="2026-10-30", quantity=60.0),
        BatchSimulationInput(batchId="b1", expiryDate="2026-10-20", quantity=40.0)
    ]
    req = ExpiryRiskRequest(
        asOfDate=as_of,
        windowDays=30,
        dailyForecast=forecast,
        batches=batches
    )
    res = run_expiry_simulation(req)
    r_map = {r.batchId: r for r in res.results}

    # Batch 1 (expires in 5 days): receives 5 * 4 = 20 demand
    assert r_map["b1"].expectedConsumed == 20.0
    assert r_map["b1"].expectedLeftover == 20.0
    assert r_map["b1"].leftoverPct == 50.0
    assert r_map["b1"].riskLevel == "critical"  # leftoverPct >= 30% and daysToExpiry <= 14

    # Batch 2 (expires in 15 days): receives 10 * 4 = 40 demand
    assert r_map["b2"].expectedConsumed == 40.0
    assert r_map["b2"].expectedLeftover == 20.0
    assert r_map["b2"].leftoverPct == 33.3
    assert r_map["b2"].riskLevel == "high"


def test_expiry_risk_with_incoming_lot_effect():
    """
    Test that an incoming lot arriving shifts FEFO consumption and changes leftover:
    Without incoming lot:
      Batch 1: 50 units, expires 2026-10-25 (10 days)
      Daily demand: 4 units/day for 10 days -> 40 consumed, 10 leftover.
    With incoming lot:
      Incoming lot arrives on 2026-10-17 with 20 units expiring 2026-10-21 (earlier expiry!)
      Under FEFO, starting 2026-10-17, the incoming lot expires before Batch 1!
      Incoming lot takes 20 demand.
      Batch 1 therefore gets 20 less demand -> only 20 consumed, 30 leftover!
      Leftover increases from 10 to 30.
    """
    as_of = "2026-10-15"
    forecast = [
        DailyForecastItem(date=f"2026-10-{15 + i:02d}", predicted=4.0)
        for i in range(10)
    ]
    batch = BatchSimulationInput(batchId="batch-1", expiryDate="2026-10-25", quantity=50.0)

    # 1. Without incoming
    req_no_inc = ExpiryRiskRequest(
        asOfDate=as_of,
        windowDays=30,
        dailyForecast=forecast,
        batches=[batch],
        incoming=[]
    )
    res_no_inc = run_expiry_simulation(req_no_inc)
    assert res_no_inc.results[0].expectedConsumed == 40.0
    assert res_no_inc.results[0].expectedLeftover == 10.0

    # 2. With incoming lot expiring earlier than batch-1
    incoming_lot = IncomingLotInput(
        expectedDate="2026-10-17",
        quantity=20.0,
        expiryDate="2026-10-22"
    )
    req_with_inc = ExpiryRiskRequest(
        asOfDate=as_of,
        windowDays=30,
        dailyForecast=forecast,
        batches=[batch],
        incoming=[incoming_lot]
    )
    res_with_inc = run_expiry_simulation(req_with_inc)
    # Batch 1 leftover increased from 10 to 30 because incoming lot absorbed 20 demand
    assert res_with_inc.results[0].expectedConsumed == 20.0
    assert res_with_inc.results[0].expectedLeftover == 30.0
    assert res_with_inc.results[0].leftoverPct == 60.0
    assert any("Confirmed incoming purchase order" in r for r in res_with_inc.results[0].reasons)


def test_expiry_risk_extrapolation_confidence():
    """
    Batch expiry extends beyond forecast horizon:
    Forecast has 5 days of demand.
    Batch expires in 20 days.
    Extrapolated must be True and confidence must be 'low'.
    """
    as_of = "2026-10-15"
    forecast = [
        DailyForecastItem(date=f"2026-10-{15 + i:02d}", predicted=5.0)
        for i in range(5)  # 2026-10-15 to 2026-10-19
    ]
    batch = BatchSimulationInput(batchId="b-extrap", expiryDate="2026-11-04", quantity=100.0)
    req = ExpiryRiskRequest(
        asOfDate=as_of,
        windowDays=30,
        dailyForecast=forecast,
        extrapolationDailyDemand=5.0,
        batches=[batch]
    )
    res = run_expiry_simulation(req)
    r = res.results[0]
    assert r.extrapolated is True
    assert r.confidence == "low"
    assert any("extrapolated beyond forecast horizon" in reason for reason in r.reasons)


def test_fastapi_expiry_risk_endpoint(client):
    """
    Integration test calling POST /expiry-risk through FastAPI HTTP endpoint.
    """
    payload = {
        "asOfDate": "2026-10-15",
        "windowDays": 30,
        "dailyForecast": [
            {"date": f"2026-10-{15 + i:02d}", "predicted": 3.0}
            for i in range(10)
        ],
        "batches": [
            {
                "batchId": "api-batch",
                "expiryDate": "2026-10-25",
                "quantity": 100.0,
                "unitCost": 12.50
            }
        ],
        "incoming": []
    }
    resp = client.post("/expiry-risk", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["asOfDate"] == "2026-10-15"
    assert len(data["results"]) == 1
    res = data["results"][0]
    assert res["batchId"] == "api-batch"
    assert res["expectedConsumed"] == 30.0
    assert res["expectedLeftover"] == 70.0
    assert res["leftoverPct"] == 70.0
    assert res["riskLevel"] == "critical"
    assert res["exposureValue"] == 875.0


def test_expiry_risk_no_saved_forecast_trailing_average():
    """
    When no saved forecast exists:
    Demand comes from trailing average (e.g. last 28 days).
    Reasons and confidence note must state clearly:
    'No saved forecast; estimated from the last 28 days of average usage'
    and NOT say 'extrapolated beyond forecast horizon'.
    """
    as_of = "2026-10-15"
    batch = BatchSimulationInput(batchId="b-trailing", expiryDate="2026-10-30", quantity=100.0)
    req = ExpiryRiskRequest(
        asOfDate=as_of,
        windowDays=30,
        dailyForecast=[],
        extrapolationDailyDemand=4.0,
        hasSavedForecast=False,
        trailingDays=28,
        batches=[batch]
    )
    res = run_expiry_simulation(req)
    assert len(res.results) == 1
    r = res.results[0]
    assert r.confidence == "low"
    assert r.confidenceNote == "No saved forecast; estimated from the last 28 days of average usage"
    assert "No saved forecast; estimated from the last 28 days of average usage" in r.reasons
    assert not any("beyond forecast horizon" in reason for reason in r.reasons)
    assert r.extrapolated is False

