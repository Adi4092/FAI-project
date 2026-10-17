"""
FastAPI Route Handlers for MedStock AI.
Complies strictly with Section 9.1, 9.5, and 9.6:
- GET /health
- GET /model-info
- POST /forecast
- POST /evaluate
- POST /train
"""

import datetime
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from ..schemas import (
    HealthResponse,
    ModelInfoResponse,
    ForecastRequest,
    ForecastResponse,
    ForecastDay,
    EvaluationMetrics,
    DataWindow,
    EvaluateRequest,
    EvaluateResponse,
    ComparativeEvaluation,
    ModelMetricDetail,
    TrainRequest,
    TrainResponse,
    ExpiryRiskRequest,
    ExpiryRiskResponse
)
from ..expiry.simulator import run_expiry_simulation
from ..forecasting.masking import prepare_and_mask_series
from ..forecasting.baseline import MovingAverageBaseline
from ..forecasting.random_forest import GlobalRandomForestModel
from ..forecasting.features import FEATURE_COLUMNS
from ..forecasting.recursive import forecast_recursive
from ..evaluation.backtest import run_chronological_evaluation
from ..services.model_registry import model_registry
from ..services.trainer import train_global_model
from ..config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def get_health():
    """
    GET /health -> {status, modelLoaded, version}
    """
    meta = model_registry.get_metadata()
    return HealthResponse(
        status="ok",
        modelLoaded=model_registry.is_model_loaded(),
        version=meta.get("modelVersion", "none")
    )


@router.get("/model-info", response_model=ModelInfoResponse)
def get_model_info():
    """
    GET /model-info -> active model name/version, trained at, feature list,
    training window, minimum history requirements, last evaluation metrics.
    """
    meta = model_registry.get_metadata()
    features = meta.get("featureList") or FEATURE_COLUMNS
    return ModelInfoResponse(
        activeModelName=meta.get("activeModelName", "none"),
        modelVersion=meta.get("modelVersion", "none"),
        trainedAt=meta.get("trainedAt"),
        featureList=features,
        trainingWindow=meta.get("trainingWindow"),
        minimumHistoryRequirements=meta.get("minimumHistoryRequirements", {
            "rejectBelowDays": 14,
            "provisionalBaselineDays": "14-59",
            "fullRandomForestDays": 60
        }),
        lastEvaluationMetrics=meta.get("lastEvaluationMetrics")
    )


@router.post("/forecast", response_model=ForecastResponse)
def generate_forecast(req: ForecastRequest):
    """
    POST /forecast
    Generates multi-step demand forecast using baseline or Random Forest.
    Enforces minimum history rules (Section 9.6), stockout masking (Section 9.2),
    and zero-leakage recursive forecasting (Section 9.4).
    """
    warnings: List[str] = []

    # 1. Data Preparation and Stockout Masking
    try:
        prepared_df, data_window_dict = prepare_and_mask_series(req.history, req.medicineId)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DATA_PREPARATION_ERROR", "message": str(e)}
        )

    valid_days = data_window_dict["validDays"]
    total_days = data_window_dict["days"]

    # 2. Minimum History Rules (Section 9.6)
    if valid_days < 14:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INSUFFICIENT_HISTORY",
                "message": f"Insufficient history ({valid_days} valid non-masked days). A minimum of 14 days is required for forecasting.",
                "validDays": valid_days,
                "requiredDays": 14
            }
        )

    # Check for intermittent demand
    valid_series = prepared_df.loc[prepared_df["stockoutObserved"] == False, "unitsDispensed"]
    zero_ratio = float((valid_series == 0).sum()) / max(1, len(valid_series))
    if zero_ratio >= 0.50:
        warnings.append("intermittent demand — forecast less reliable")

    # Forecast start date is day after the end of historical series
    last_dt = prepared_df["dt"].max().date()
    start_date = last_dt + datetime.timedelta(days=1)

    # 3. Model Selection
    baseline = MovingAverageBaseline(window=7)
    rf_model = model_registry.get_model()
    active_meta = model_registry.get_metadata()

    provisional = False
    model_to_use = "baseline"

    # Evaluation metrics placeholder
    eval_metrics = EvaluationMetrics(
        mae=None,
        rmse=None,
        wape=None,
        baselineMae=None,
        baselineRmse=None,
        baselineWape=None,
        holdoutDays=0
    )

    if valid_days < 60:
        # 14 - 59 days: Baseline only, provisional=True, warning added
        model_to_use = "baseline"
        provisional = True
        warnings.append("Insufficient history for Random Forest (minimum 60 days required); baseline model used with provisional flag.")
    else:
        # >= 60 days: Full Random Forest vs Baseline comparison
        provisional = False

        if req.modelPreference == "baseline":
            model_to_use = "baseline"
        elif req.modelPreference == "random_forest":
            if rf_model and rf_model.is_fitted:
                model_to_use = "random_forest"
            else:
                model_to_use = "baseline"
                warnings.append("Random Forest model artifact not loaded; falling back to moving-average baseline.")
        else:
            # "auto" mode: compare RF against baseline on chronological holdout
            if rf_model and rf_model.is_fitted:
                backtest_res = run_chronological_evaluation(prepared_df, rf_model, req.horizonDays)
                if "error" not in backtest_res:
                    model_to_use = backtest_res["selectedModel"]
                    rf_m = backtest_res["randomForest"]
                    bm_m = backtest_res["baseline"]
                    eval_metrics = EvaluationMetrics(
                        mae=rf_m.get("mae"),
                        rmse=rf_m.get("rmse"),
                        wape=rf_m.get("wape"),
                        baselineMae=bm_m.get("mae"),
                        baselineRmse=bm_m.get("rmse"),
                        baselineWape=bm_m.get("wape"),
                        holdoutDays=backtest_res.get("holdoutDays", req.horizonDays),
                        note=backtest_res.get("selectionReason")
                    )
                else:
                    model_to_use = "baseline"
            else:
                model_to_use = "baseline"
                warnings.append("Random Forest model artifact not loaded; falling back to moving-average baseline.")

    # 4. Generate Predictions
    if model_to_use == "random_forest" and rf_model and rf_model.is_fitted:
        raw_forecast = forecast_recursive(rf_model, prepared_df, req.horizonDays, start_date)
        model_name = "random_forest"
        model_version = active_meta.get("modelVersion", "rf-active")
    else:
        raw_forecast = baseline.forecast(prepared_df, req.horizonDays, start_date)
        model_name = "moving_average_baseline"
        model_version = "baseline-v1"

    forecast_items = [
        ForecastDay(date=item["date"], predicted=round(item["predicted"], 2))
        for item in raw_forecast
    ]
    total_predicted = round(sum(item.predicted for item in forecast_items), 2)

    return ForecastResponse(
        modelName=model_name,
        modelVersion=model_version,
        forecast=forecast_items,
        totalPredicted=total_predicted,
        metrics=eval_metrics,
        provisional=provisional,
        dataWindow=DataWindow(
            from_date=data_window_dict["from"],
            to_date=data_window_dict["to"],
            days=total_days,
            maskedDays=data_window_dict["maskedDays"]
        ),
        warnings=warnings
    )


@router.post("/evaluate", response_model=EvaluateResponse)
def evaluate_medicine(req: EvaluateRequest):
    """
    POST /evaluate
    Runs chronological holdout evaluation for a medicine's history.
    Returns baseline vs RF metrics.
    """
    prepared_df, data_window_dict = prepare_and_mask_series(req.history, req.medicineId)
    valid_days = data_window_dict["validDays"]

    if valid_days < 14:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INSUFFICIENT_HISTORY",
                "message": f"Insufficient history ({valid_days} valid days). Minimum 14 days required for evaluation."
            }
        )

    warnings: List[str] = []
    valid_series = prepared_df.loc[prepared_df["stockoutObserved"] == False, "unitsDispensed"]
    zero_ratio = float((valid_series == 0).sum()) / max(1, len(valid_series))
    if zero_ratio >= 0.50:
        warnings.append("intermittent demand — forecast less reliable")

    rf_model = model_registry.get_model()
    if not rf_model or not rf_model.is_fitted:
        # Use an unfitted dummy wrapper if model not loaded
        rf_model = GlobalRandomForestModel()

    backtest_res = run_chronological_evaluation(prepared_df, rf_model, req.horizonDays)
    if "error" in backtest_res:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": backtest_res["error"], "message": backtest_res["message"]}
        )

    rf_metrics = backtest_res["randomForest"]
    bm_metrics = backtest_res["baseline"]

    return EvaluateResponse(
        medicineId=req.medicineId,
        dataWindow=DataWindow(
            from_date=data_window_dict["from"],
            to_date=data_window_dict["to"],
            days=data_window_dict["days"],
            maskedDays=data_window_dict["maskedDays"]
        ),
        metrics=ComparativeEvaluation(
            randomForest=ModelMetricDetail(
                mae=rf_metrics.get("mae"),
                rmse=rf_metrics.get("rmse"),
                wape=rf_metrics.get("wape")
            ),
            baseline=ModelMetricDetail(
                mae=bm_metrics.get("mae"),
                rmse=bm_metrics.get("rmse"),
                wape=bm_metrics.get("wape")
            ),
            holdoutDays=backtest_res["holdoutDays"],
            selectedModel=backtest_res["selectedModel"],
            selectionReason=backtest_res["selectionReason"]
        ),
        warnings=warnings
    )


@router.post("/train", response_model=TrainResponse)
def train_model(req: TrainRequest):
    """
    POST /train
    Retrains the global model from supplied or synthetic multi-medicine history,
    bumps modelVersion, and persists with Joblib.
    """
    try:
        res = train_global_model(req.history, req.versionNote)
        return TrainResponse(
            success=True,
            modelVersion=res["modelVersion"],
            modelName=res["modelName"],
            trainedAt=res["trainedAt"],
            medicinesCount=res["medicinesCount"],
            totalRecords=res["totalRecords"],
            trainingWindow=res["trainingWindow"],
            evaluationMetrics=res["evaluationMetrics"],
            message=res["message"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "TRAINING_FAILED", "message": f"Model training failed: {str(e)}"}
        )


@router.post("/expiry-risk", response_model=ExpiryRiskResponse)
def evaluate_expiry_risk(req: ExpiryRiskRequest):
    """
    POST /expiry-risk
    Evaluates FEFO inventory consumption across batches, incorporates incoming lots,
    extrapolates beyond forecast horizon, evaluates shelf-life risks and wastage,
    and returns risk levels, reasons, and suggested actions.
    """
    try:
        return run_expiry_simulation(req)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EXPIRY_SIMULATION_FAILED", "message": f"Expiry risk simulation failed: {str(e)}"}
        )
