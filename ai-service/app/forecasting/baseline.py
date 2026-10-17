"""
Baseline Forecaster for MedStock AI.
Complies with Section 9.4:
Moving-average baseline (default 7-day window, configurable) projected flat over the horizon.
Excludes stockout-masked days from the average calculation so censored days do not artificially deflate the baseline.
"""

from typing import List, Dict, Any
import datetime
import numpy as np
import pandas as pd


class MovingAverageBaseline:
    def __init__(self, window: int = 7):
        self.window = window
        self.name = "moving_average_baseline"

    def calculate_trailing_average(self, df: pd.DataFrame) -> float:
        """
        Computes the trailing window average of non-masked demand.
        If recent days contain stockouts, only non-stockout days are averaged.
        If no non-stockout days exist in window, falls back to expanding historical mean.
        """
        valid_series = df.loc[df["stockoutObserved"] == False, "unitsDispensed"]
        if valid_series.empty:
            return 0.0

        tail = valid_series.tail(self.window)
        if tail.empty:
            return float(valid_series.mean())
        return float(max(0.0, tail.mean()))

    def forecast(
        self,
        df: pd.DataFrame,
        horizon_days: int,
        start_date: datetime.date
    ) -> List[Dict[str, Any]]:
        """
        Projects trailing moving average flat over the horizon.
        Returns list of {"date": "YYYY-MM-DD", "predicted": float}.
        """
        avg_value = round(self.calculate_trailing_average(df), 2)
        forecast_list = []
        for d in range(horizon_days):
            target_date = start_date + datetime.timedelta(days=d)
            forecast_list.append({
                "date": target_date.strftime("%Y-%m-%d"),
                "predicted": avg_value
            })
        return forecast_list
