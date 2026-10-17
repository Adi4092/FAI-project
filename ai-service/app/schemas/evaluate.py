from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from .forecast import DailyHistoryRecord, DataWindow


class ModelMetricDetail(BaseModel):
    mae: Optional[float] = None
    rmse: Optional[float] = None
    wape: Optional[float] = None


class ComparativeEvaluation(BaseModel):
    randomForest: ModelMetricDetail
    baseline: ModelMetricDetail
    holdoutDays: int
    selectedModel: str
    selectionReason: str


class EvaluateRequest(BaseModel):
    medicineId: str = Field(..., min_length=1)
    history: List[DailyHistoryRecord]
    horizonDays: int = Field(default=15, description="Holdout/evaluation horizon (7, 15, or 30)")

    @field_validator("horizonDays")
    @classmethod
    def validate_horizon(cls, v: int) -> int:
        if v not in (7, 15, 30):
            raise ValueError(f"Invalid horizonDays: {v}. Must be exactly 7, 15, or 30.")
        return v


class EvaluateResponse(BaseModel):
    medicineId: str
    dataWindow: DataWindow
    metrics: ComparativeEvaluation
    warnings: List[str] = Field(default_factory=list)
