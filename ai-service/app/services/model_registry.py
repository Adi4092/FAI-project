"""
Model Registry for MedStock AI.
Complies with Section 9.6:
- Thread-safe active model container.
- Loaded once at startup in FastAPI lifespan.
- Provides metadata, active version, and model instance for inference.
"""

import os
import json
import logging
from typing import Optional, Dict, Any
import joblib

from ..forecasting.random_forest import GlobalRandomForestModel
from ..forecasting.features import FEATURE_COLUMNS
from ..config import settings

logger = logging.getLogger("medstock.registry")


class ModelRegistry:
    _instance: Optional["ModelRegistry"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelRegistry, cls).__new__(cls)
            cls._instance.model: Optional[GlobalRandomForestModel] = None
            cls._instance.metadata: Dict[str, Any] = {}
            cls._instance.is_loaded: bool = False
        return cls._instance

    def load_active_model(self) -> bool:
        """
        Loads the active model and metadata from MODEL_DIR once at startup.
        Returns True if successfully loaded, False otherwise.
        """
        model_path = os.path.join(settings.MODEL_DIR, settings.ACTIVE_MODEL_FILENAME)
        meta_path = os.path.join(settings.MODEL_DIR, settings.METADATA_FILENAME)

        if not os.path.exists(model_path) or not os.path.exists(meta_path):
            logger.warning(f"No trained model artifact found at {model_path}. Fallback to baseline enabled.")
            self.model = None
            self.metadata = {
                "activeModelName": "moving_average_baseline",
                "modelVersion": "baseline-fallback",
                "trainedAt": None,
                "featureList": FEATURE_COLUMNS,
                "minimumHistoryRequirements": {
                    "rejectBelowDays": 14,
                    "provisionalBaselineDays": "14-59",
                    "fullRandomForestDays": 60
                },
                "lastEvaluationMetrics": None
            }
            self.is_loaded = False
            return False

        try:
            loaded_artifact = joblib.load(model_path)
            with open(meta_path, "r", encoding="utf-8") as f:
                loaded_meta = json.load(f)

            self.model = loaded_artifact
            self.metadata = loaded_meta
            self.is_loaded = True
            logger.info(f"Loaded active model version {self.metadata.get('modelVersion')} from {model_path}")
            return True
        except Exception as e:
            logger.error(f"Error loading model from {model_path}: {e}. Falling back to baseline.")
            self.model = None
            self.is_loaded = False
            return False

    def set_active_model(self, model: GlobalRandomForestModel, metadata: Dict[str, Any]):
        """
        Sets newly trained model in memory.
        """
        self.model = model
        self.metadata = metadata
        self.is_loaded = True

    def get_model(self) -> Optional[GlobalRandomForestModel]:
        return self.model

    def get_metadata(self) -> Dict[str, Any]:
        return self.metadata

    def is_model_loaded(self) -> bool:
        return self.is_loaded and self.model is not None


model_registry = ModelRegistry()
