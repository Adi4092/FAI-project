"""
Random Forest Global Forecaster for MedStock AI.
Complies with Section 9.4:
- Global model trained across medicines.
- RandomForestRegressor(n_estimators=150, min_samples_leaf=3, random_state=42).
- Target and scale-dependent features normalized by medicine_scale to allow single global model
  to generalize across low-volume (1-5 units/day) and high-volume (50-100 units/day) medicines.
- Stockout-masked rows (target_demand=NaN) are strictly excluded from training.
"""

from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from .features import FEATURE_COLUMNS, compute_features

SCALE_DEPENDENT_FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_7", "lag_14", "lag_28",
    "roll_mean_7", "roll_mean_14", "roll_mean_28",
    "roll_std_7"
]


class GlobalRandomForestModel:
    def __init__(
        self,
        n_estimators: int = 150,
        min_samples_leaf: int = 3,
        random_state: int = 42
    ):
        self.n_estimators = n_estimators
        self.min_samples_leaf = min_samples_leaf
        self.random_state = random_state
        self.model = RandomForestRegressor(
            n_estimators=self.n_estimators,
            min_samples_leaf=self.min_samples_leaf,
            random_state=self.random_state,
            n_jobs=-1
        )
        self.is_fitted = False
        self.feature_columns = FEATURE_COLUMNS

    def _normalize_features(self, df_features: pd.DataFrame) -> pd.DataFrame:
        """
        Normalizes scale-dependent features by medicine_scale.
        Calendar features remain unnormalized.
        """
        X = df_features[self.feature_columns].copy()
        scale = df_features["medicine_scale"].values.reshape(-1, 1)
        scale = np.where(scale <= 0, 1.0, scale)

        for col in SCALE_DEPENDENT_FEATURES:
            X[col] = X[col] / scale[:, 0]
        return X

    def fit(self, train_df: pd.DataFrame) -> "GlobalRandomForestModel":
        """
        Fits global RF on multi-medicine or single-medicine training DataFrame.
        train_df must contain features computed and 'target_demand' column.
        Rows where target_demand is NaN (e.g. stockouts) are dropped.
        """
        # Drop rows with NaN target (censored stockout days)
        valid = train_df.dropna(subset=["target_demand"]).copy()
        if len(valid) == 0:
            raise ValueError("Cannot train model: no valid non-masked target samples")

        X_norm = self._normalize_features(valid)
        y = valid["target_demand"].values
        scale = valid["medicine_scale"].values
        scale = np.where(scale <= 0, 1.0, scale)
        y_norm = y / scale

        self.model.fit(X_norm, y_norm)
        self.is_fitted = True
        return self

    def predict_one(self, feature_row: pd.DataFrame) -> float:
        """
        Predicts demand for a single row feature vector.
        Unnormalizes prediction using the row's medicine_scale.
        """
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted")

        X_norm = self._normalize_features(feature_row)
        pred_norm = float(self.model.predict(X_norm)[0])
        scale = float(feature_row["medicine_scale"].values[0])
        pred = max(0.0, pred_norm * scale)
        return float(round(pred, 2))

    def predict_batch(self, feature_df: pd.DataFrame) -> np.ndarray:
        """
        Vectorized batch prediction for multiple rows.
        """
        if not self.is_fitted:
            raise RuntimeError("Model is not fitted")

        X_norm = self._normalize_features(feature_df)
        preds_norm = self.model.predict(X_norm)
        scales = feature_df["medicine_scale"].values
        preds = np.maximum(0.0, preds_norm * scales)
        return np.round(preds, 2)

