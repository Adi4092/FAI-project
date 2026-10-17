"""
Data preparation and masking module for MedStock AI.
Complies with Section 9.2:
- Builds continuous daily series.
- Fills missing days with 0 only where no stockout was observed.
- Censored demand: days with stockoutObserved=True are masked (np.nan in target_demand),
  excluded from training and evaluation targets, never treated as true zero demand.
- Preserves legitimate zero-dispensing days on intermittent items where stockoutObserved=False.
"""

from typing import List, Dict, Any, Tuple
import datetime
import numpy as np
import pandas as pd


def prepare_and_mask_series(
    records: List[Any],
    medicine_id: str = "MED-UNKNOWN"
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Takes records (list of dicts or Pydantic DailyHistoryRecord objects),
    converts to a continuous daily DataFrame indexed by Date, applies stockout masking,
    and returns (DataFrame, data_window_metadata).

    Resulting DataFrame columns:
    - date (str YYYY-MM-DD)
    - dt (pd.Timestamp)
    - unitsDispensed (float)
    - stockoutObserved (bool)
    - target_demand (float: np.nan if stockoutObserved=True, else unitsDispensed)
    """
    if not records:
        raise ValueError("Cannot prepare series: history is empty")

    raw_data = []
    for r in records:
        if isinstance(r, dict):
            d_str = r.get("date")
            u = float(r.get("unitsDispensed", 0.0))
            so = bool(r.get("stockoutObserved", False))
        else:
            d_str = getattr(r, "date")
            u = float(getattr(r, "unitsDispensed", 0.0))
            so = bool(getattr(r, "stockoutObserved", False))

        if "T" in d_str:
            d_str = d_str.split("T")[0]
        raw_data.append({
            "date": d_str,
            "unitsDispensed": u,
            "stockoutObserved": so
        })

    df = pd.DataFrame(raw_data)
    df["dt"] = pd.to_datetime(df["date"], format="%Y-%m-%d")
    
    # Sort chronologically and drop any duplicates by keeping the last
    df = df.sort_values("dt").drop_duplicates(subset=["dt"], keep="last")

    min_dt = df["dt"].min()
    max_dt = df["dt"].max()

    # Reindex over full continuous daily date range
    full_range = pd.date_range(start=min_dt, end=max_dt, freq="D", name="dt")
    df = df.set_index("dt").reindex(full_range)
    df.index.name = "dt"

    # Fill missing days with 0 only where no stockout was observed
    # For dates that were not in the provided records:
    df["stockoutObserved"] = df["stockoutObserved"].fillna(False).astype(bool)
    df["unitsDispensed"] = df["unitsDispensed"].fillna(0.0).astype(float)
    df["date"] = df.index.strftime("%Y-%m-%d")
    df = df.reset_index()

    # Apply masking for censored demand:
    # Days with stockoutObserved=True must NEVER be treated as true zero demand;
    # they are masked (NaN) so they are excluded from training and holdout evaluation targets.
    df["target_demand"] = df["unitsDispensed"].astype(float)
    df.loc[df["stockoutObserved"] == True, "target_demand"] = np.nan

    total_days = len(df)
    masked_days = int(df["stockoutObserved"].sum())
    valid_days = total_days - masked_days

    data_window = {
        "from": min_dt.strftime("%Y-%m-%d"),
        "to": max_dt.strftime("%Y-%m-%d"),
        "days": total_days,
        "maskedDays": masked_days,
        "validDays": valid_days
    }

    return df, data_window
