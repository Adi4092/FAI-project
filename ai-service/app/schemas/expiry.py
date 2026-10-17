from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class BatchSimulationInput(BaseModel):
    batchId: str = Field(..., description="Unique batch ID")
    expiryDate: str = Field(..., description="Batch expiry date YYYY-MM-DD")
    quantity: float = Field(..., ge=0, description="Current usable quantity")
    unitCost: Optional[float] = Field(default=None, ge=0, description="Purchase cost per unit")
    receivedAt: Optional[str] = Field(default=None, description="Date batch was received")


class IncomingLotInput(BaseModel):
    expectedDate: str = Field(..., description="Expected arrival date YYYY-MM-DD")
    quantity: float = Field(..., gt=0, description="Incoming units ordered")
    expiryDate: str = Field(..., description="Expiry date of incoming batch")


class DailyForecastItem(BaseModel):
    date: str = Field(..., description="Forecast date YYYY-MM-DD")
    predicted: float = Field(..., ge=0, description="Predicted demand units")


class ExpiryRiskRequest(BaseModel):
    asOfDate: str = Field(..., description="Simulation baseline date YYYY-MM-DD")
    windowDays: int = Field(default=90, ge=1, le=365, description="Simulation lookahead window in days")
    dailyForecast: List[DailyForecastItem] = Field(default_factory=list, description="Day-by-day forecasted demand")
    extrapolationDailyDemand: Optional[float] = Field(default=None, ge=0, description="Flat daily demand beyond forecast horizon")
    hasSavedForecast: Optional[bool] = Field(default=None, description="Whether demand originates from a saved ML forecast")
    trailingDays: Optional[int] = Field(default=28, description="Number of days used for trailing average fallback")
    batches: List[BatchSimulationInput] = Field(..., description="List of usable inventory batches to simulate")
    incoming: List[IncomingLotInput] = Field(default_factory=list, description="Confirmed incoming purchase order deliveries")


class BatchExpiryRiskResult(BaseModel):
    batchId: str
    expectedConsumed: float
    expectedLeftover: float
    leftoverPct: float
    exposureValue: Optional[float] = None
    riskLevel: Literal["low", "medium", "high", "critical"]
    reasons: List[str]
    suggestedActions: List[str]
    extrapolated: bool
    confidence: Literal["normal", "low"]
    confidenceNote: Optional[str] = None


class ExpiryRiskResponse(BaseModel):
    asOfDate: str
    results: List[BatchExpiryRiskResult]
