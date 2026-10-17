"""
Model Training and Serialization Service for MedStock AI.
Complies with Section 9.4, 9.5, and 9.6:
- Trains global Random Forest regressor on multi-medicine daily history.
- Chronological split used for evaluation during training.
- Persists model artifact via Joblib.
- Writes metadata JSON with real computed metrics.
- Updates ModelRegistry in memory.
"""

import os
import json
import datetime
import logging
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
import joblib

from ..forecasting.masking import prepare_and_mask_series
from ..forecasting.features import compute_features, FEATURE_COLUMNS
from ..forecasting.random_forest import GlobalRandomForestModel
from ..forecasting.baseline import MovingAverageBaseline
from ..evaluation.metrics import compute_metrics
from ..services.model_registry import model_registry
from ..config import settings

logger = logging.getLogger("medstock.trainer")


def train_global_model(
    custom_records: Optional[List[Any]] = None,
    version_note: Optional[str] = None,
    model_version: Optional[str] = None,
    output_dir: Optional[str] = None,
    update_active: bool = True
) -> Dict[str, Any]:
    """
    Trains the global Random Forest model:
    1. Splits data chronologically with a 30-day holdout.
    2. Fits evaluation model strictly on data before the holdout to compute honest
       out-of-sample metrics (lastEvaluationMetrics).
    3. Refits the final production model on 100% of data (including holdout period).
    4. Persists the final model artifact and metadata JSON to target_dir.
    5. Optionally updates the in-memory ModelRegistry.
    """
    # 1. Load data
    if custom_records and len(custom_records) > 0:
        records_data = []
        for r in custom_records:
            if isinstance(r, dict):
                records_data.append(r)
            else:
                records_data.append(r.model_dump())
        df_raw = pd.DataFrame(records_data)
    else:
        # Load from synthetic daily_usage.csv
        csv_path = os.path.join(settings.DATA_DIR, "daily_usage.csv")
        if not os.path.exists(csv_path):
            from ..data.synthetic_generator import generate_synthetic_data
            generate_synthetic_data(settings.DATA_DIR)
        df_raw = pd.read_csv(csv_path)

    medicines = df_raw["medicineId"].unique().tolist()
    logger.info(f"Training on {len(medicines)} medicines with {len(df_raw)} records...")

    # 2. Process each medicine and prepare chronological train & test sets
    train_dfs = []
    test_dfs = []
    holdout_days = 30  # Holdout last 30 days chronologically for evaluation

    min_date = df_raw["date"].min()
    max_date = df_raw["date"].max()

    for med_id in medicines:
        med_rows = df_raw[df_raw["medicineId"] == med_id].to_dict("records")
        prepared_df, _ = prepare_and_mask_series(med_rows, med_id)
        feats_df = compute_features(prepared_df)

        if len(feats_df) > holdout_days + 30:
            med_train = feats_df.iloc[:-holdout_days].copy()
            med_test = feats_df.iloc[-holdout_days:].copy()
        else:
            split_idx = int(len(feats_df) * 0.8)
            med_train = feats_df.iloc[:split_idx].copy()
            med_test = feats_df.iloc[split_idx:].copy()

        train_dfs.append(med_train)
        test_dfs.append(med_test)

    combined_train = pd.concat(train_dfs, ignore_index=True)
    combined_test = pd.concat(test_dfs, ignore_index=True)

    # 3. Fit Global Random Forest on combined train (for holdout evaluation)
    eval_rf_model = GlobalRandomForestModel(
        n_estimators=150,
        min_samples_leaf=3,
        random_state=42
    )
    eval_rf_model.fit(combined_train)

    # 4. Evaluate RF and Baseline on Holdout
    valid_test = combined_test.dropna(subset=["target_demand"]).copy()
    y_test_true = valid_test["target_demand"].values
    
    # Predict with evaluation RF (one-step ahead)
    rf_preds = eval_rf_model.predict_batch(valid_test)
    rf_one_step_metrics = compute_metrics(y_test_true, rf_preds)

    # Baseline evaluation on the same holdout
    baseline = MovingAverageBaseline(window=7)
    base_preds = []
    for i, med_test in enumerate(test_dfs):
        med_train = train_dfs[i]
        avg = baseline.calculate_trailing_average(med_train)
        base_preds.extend([avg] * len(med_test))
    base_preds_series = pd.Series(base_preds, index=combined_test.index)
    valid_base_preds = base_preds_series.loc[valid_test.index].values
    baseline_metrics = compute_metrics(y_test_true, valid_base_preds)

    # 4b. Multi-step recursive evaluation across all medicines for horizons 7, 15, 30
    from ..evaluation.recursive_eval import evaluate_recursive_multi_horizon
    recursive_metrics = evaluate_recursive_multi_horizon(eval_rf_model, df_raw, horizons=[7, 15, 30])

    # Use the 30-day recursive metrics as the primary out-of-sample holdout metrics
    rf_recursive_30d = recursive_metrics["horizon_30"]["randomForest"]
    baseline_recursive_30d = recursive_metrics["horizon_30"]["baseline"]

    # 5. Refit final production model on ALL data (100% of historical observations)
    # This ensures production forecasts benefit from all recent data up to the last day.
    combined_all = pd.concat([combined_train, combined_test], ignore_index=True)
    final_rf_model = GlobalRandomForestModel(
        n_estimators=150,
        min_samples_leaf=3,
        random_state=42
    )
    final_rf_model.fit(combined_all)

    # 6. Versioning and Model Persistence
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if model_version:
        version_tag = model_version
    elif version_note:
        version_tag = f"rf-2026.10.1-{version_note[:50]}"
    else:
        version_tag = "rf-2026.10.1"

    target_dir = output_dir or settings.MODEL_DIR
    os.makedirs(target_dir, exist_ok=True)
    model_artifact_path = os.path.join(target_dir, settings.ACTIVE_MODEL_FILENAME)
    meta_path = os.path.join(target_dir, settings.METADATA_FILENAME)

    joblib.dump(final_rf_model, model_artifact_path)

    metadata = {
        "activeModelName": "random_forest",
        "modelVersion": version_tag,
        "trainedAt": now_str,
        "refitOnFullData": True,
        "featureList": FEATURE_COLUMNS,
        "trainingWindow": {
            "from": str(min_date),
            "to": str(max_date)
        },
        "medicinesCount": len(medicines),
        "totalRecords": len(df_raw),
        "minimumHistoryRequirements": {
            "rejectBelowDays": 14,
            "provisionalBaselineDays": "14-59",
            "fullRandomForestDays": 60
        },
        "lastEvaluationMetrics": {
            "randomForest": rf_recursive_30d,
            "baseline": baseline_recursive_30d,
            "holdoutDays": holdout_days,
            "evaluationType": "multi-step recursive forecasting (no actual holdout values used)",
            "recursiveByHorizon": recursive_metrics,
            "oneStepAheadMetrics": {
                "randomForest": rf_one_step_metrics,
                "baseline": baseline_metrics
            },
            "evaluationSplitMethod": "Evaluated out-of-sample on chronological holdouts (trained on data before holdout); final production model refit on full 100% history."
        }
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Update in-memory registry if requested
    if update_active:
        model_registry.set_active_model(final_rf_model, metadata)
    logger.info(f"Model {version_tag} trained, evaluated, refit on full data, and saved to {target_dir}.")

    return {
        "success": True,
        "modelVersion": version_tag,
        "modelName": "random_forest",
        "trainedAt": now_str,
        "refitOnFullData": True,
        "medicinesCount": len(medicines),
        "totalRecords": len(df_raw),
        "trainingWindow": metadata["trainingWindow"],
        "evaluationMetrics": metadata["lastEvaluationMetrics"],
        "message": "Model evaluated on holdout, refit on full data, and persisted successfully"
    }

