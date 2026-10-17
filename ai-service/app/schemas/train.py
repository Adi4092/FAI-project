from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .forecast import DailyHistoryRecord


class MultiMedicineUsageRecord(DailyHistoryRecord):
    medicineId: str = Field(..., min_length=1, description="Identifier of the medicine")


class TrainRequest(BaseModel):
    history: Optional[List[MultiMedicineUsageRecord]] = Field(
        default=None,
        description="Optional list of multi-medicine daily records. If omitted, uses default synthetic dataset."
    )
    versionNote: Optional[str] = Field(default=None, description="Optional note for the new model version")


class TrainResponse(BaseModel):
    success: bool
    modelVersion: str
    modelName: str
    trainedAt: str
    medicinesCount: int
    totalRecords: int
    trainingWindow: Dict[str, str]
    evaluationMetrics: Dict[str, Any]
    message: str
