from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


class DailyHistoryRecord(BaseModel):
    date: str = Field(..., description="Date string in YYYY-MM-DD format", example="2026-01-01")
    unitsDispensed: float = Field(..., ge=0, description="Units dispensed/consumed on this date", example=12.0)
    stockoutObserved: bool = Field(default=False, description="Whether usable stock was 0 or demand was capped")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        # Validate format YYYY-MM-DD
        import datetime
        try:
            # Handle potential ISO formats with T or just YYYY-MM-DD
            if "T" in v:
                v = v.split("T")[0]
            datetime.date.fromisoformat(v)
            return v
        except Exception:
            raise ValueError(f"Invalid date format '{v}'. Expected YYYY-MM-DD.")


class ForecastDay(BaseModel):
    date: str = Field(..., description="Forecast date YYYY-MM-DD")
    predicted: float = Field(..., ge=0, description="Predicted demand for this day")


class EvaluationMetrics(BaseModel):
    mae: Optional[float] = None
    rmse: Optional[float] = None
    wape: Optional[float] = None
    baselineMae: Optional[float] = None
    baselineRmse: Optional[float] = None
    baselineWape: Optional[float] = None
    holdoutDays: int = 0
    note: Optional[str] = None


class DataWindow(BaseModel):
    from_date: str = Field(..., alias="from")
    to_date: str = Field(..., alias="to")
    days: int
    maskedDays: int

    model_config = {
        "populate_by_name": True
    }


class ForecastRequest(BaseModel):
    medicineId: str = Field(..., min_length=1, description="Medicine ID or code")
    horizonDays: int = Field(default=15, description="Forecast horizon in days: 7, 15, or 30")
    history: List[DailyHistoryRecord] = Field(..., description="Historical daily consumption records")
    modelPreference: Literal["auto", "random_forest", "baseline"] = Field(
        default="auto",
        description="Model preference"
    )

    @field_validator("horizonDays")
    @classmethod
    def validate_horizon(cls, v: int) -> int:
        if v not in (7, 15, 30):
            raise ValueError(f"Invalid horizonDays: {v}. Must be exactly 7, 15, or 30.")
        return v


class ForecastResponse(BaseModel):
    modelName: str
    modelVersion: str
    forecast: List[ForecastDay]
    totalPredicted: float
    metrics: EvaluationMetrics
    provisional: bool
    dataWindow: DataWindow
    warnings: List[str] = Field(default_factory=list)


class ModelInfoResponse(BaseModel):
    activeModelName: str
    modelVersion: str
    trainedAt: Optional[str] = None
    featureList: List[str]
    trainingWindow: Optional[dict] = None
    minimumHistoryRequirements: dict
    lastEvaluationMetrics: Optional[dict] = None


class HealthResponse(BaseModel):
    status: str
    modelLoaded: bool
    version: str
