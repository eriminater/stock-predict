"""Three prediction models: Original, Volatility, Regression."""

import numpy as np
from sklearn.linear_model import LinearRegression
import logging

logger = logging.getLogger(__name__)


def predict_original(
    us_close_latest: float,
    us_close_prev: float,
    fx_latest: float,
    fx_prev: float,
    jp_close_latest: float,
) -> dict:
    """Model 1: Simple proportional model."""
    predicted = (us_close_latest / us_close_prev) * (fx_latest / fx_prev) * jp_close_latest
    return {
        "model_type": "original",
        "predicted_open": round(predicted, 2),
        "parameters": {
            "us_close_latest": us_close_latest,
            "us_close_prev": us_close_prev,
            "fx_latest": fx_latest,
            "fx_prev": fx_prev,
            "jp_close_latest": jp_close_latest,
        },
    }


def predict_volatility(
    us_close_latest: float,
    us_close_prev: float,
    fx_latest: float,
    fx_prev: float,
    jp_close_latest: float,
    jp_returns_90d: list[float],
    us_returns_90d: list[float],
) -> dict:
    """Model 2: Volatility-adjusted model."""
    jp_std = np.std(jp_returns_90d) if jp_returns_90d else 0.01
    us_std = np.std(us_returns_90d) if us_returns_90d else 0.01
    sensitivity = jp_std / us_std if us_std > 0 else 1.0

    us_return = (us_close_latest / us_close_prev) - 1
    fx_return = (fx_latest / fx_prev) - 1

    predicted = jp_close_latest * (1 + us_return * sensitivity + fx_return)
    return {
        "model_type": "volatility",
        "predicted_open": round(predicted, 2),
        "parameters": {
            "sensitivity": round(sensitivity, 4),
            "jp_std": round(float(jp_std), 6),
            "us_std": round(float(us_std), 6),
            "us_return": round(us_return, 6),
            "fx_return": round(fx_return, 6),
            "jp_close_latest": jp_close_latest,
        },
    }


def predict_regression(
    us_closes: list[float],
    jp_closes: list[float],
    jp_opens: list[float],
    fx_closes: list[float],
    ind_closes: list[float],
) -> dict:
    """Model 3: OLS regression on log returns (90-day rolling window)."""
    # Filter out None values - build aligned arrays
    valid = []
    for i in range(min(len(us_closes), len(jp_closes), len(fx_closes), len(ind_closes), len(jp_opens))):
        if all(v is not None and v > 0 for v in [us_closes[i], jp_closes[i], fx_closes[i], ind_closes[i], jp_opens[i]]):
            valid.append(i)
    n = len(valid)
    if n < 10:
        return {
            "model_type": "regression",
            "predicted_open": round(jp_closes[-1], 2) if jp_closes and jp_closes[-1] else 0,
            "parameters": {"error": "insufficient data"},
        }

    uc = [us_closes[i] for i in valid]
    jc = [jp_closes[i] for i in valid]
    jo = [jp_opens[i] for i in valid]
    fc = [fx_closes[i] for i in valid]
    ic = [ind_closes[i] for i in valid]

    us_log_ret = [np.log(uc[i] / uc[i - 1]) for i in range(1, n)]
    fx_log_ret = [np.log(fc[i] / fc[i - 1]) for i in range(1, n)]
    ind_log_ret = [np.log(ic[i] / ic[i - 1]) for i in range(1, n)]
    jp_gaps = [(jo[i] - jc[i - 1]) / jc[i - 1] for i in range(1, n)]

    X = np.column_stack([us_log_ret[:-1], fx_log_ret[:-1], ind_log_ret[:-1]])
    y = np.array(jp_gaps[:-1])

    if len(X) < 5:
        return {
            "model_type": "regression",
            "predicted_open": round(jp_closes[-1], 2),
            "parameters": {"error": "insufficient data"},
        }

    reg = LinearRegression().fit(X, y)
    beta1, beta2, beta3 = reg.coef_
    alpha = reg.intercept_
    r_squared = reg.score(X, y)

    latest_x = np.array([[us_log_ret[-1], fx_log_ret[-1], ind_log_ret[-1]]])
    gap_pred = reg.predict(latest_x)[0]
    predicted = jp_closes[-1] * (1 + gap_pred)

    return {
        "model_type": "regression",
        "predicted_open": round(predicted, 2),
        "parameters": {
            "alpha": round(alpha, 6),
            "beta1": round(beta1, 4),
            "beta2": round(beta2, 4),
            "beta3": round(beta3, 4),
            "r_squared": round(r_squared, 4),
        },
    }


def calculate_accuracy_stats(predictions: list[dict], days: int = 30) -> dict:
    """Calculate accuracy stats for a set of predictions."""
    recent = [p for p in predictions if p.get("actual_open") is not None][-days:]
    if not recent:
        return {"avg_error": None, "hit_rate": "0/0", "max_error": None}

    errors = []
    for p in recent:
        err = abs((p["predicted_open"] - p["actual_open"]) / p["actual_open"] * 100)
        errors.append(err)

    hits = sum(1 for e in errors if e <= 1.0)
    return {
        "avg_error": round(np.mean(errors), 2),
        "hit_rate": f"{hits}/{len(errors)}",
        "max_error": round(max(errors), 2),
    }
