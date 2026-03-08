import joblib
import numpy as np
import pandas as pd
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

ML_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(ML_DIR, "decay_model.joblib")

FEATURES = [
    "complexity_tier",
    "dependency_depth",
    "review_count",
    "spacing_score",
    "time_spent_avg",
    "feynman_score",
    "revisit_rate",
    "practice_fail_rate",
    "confidence_gap",
    "days_since_review",
]

THRESHOLD = float(os.getenv("DECAY_THRESHOLD", "0.70"))

_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model
    try:
        _model = joblib.load(MODEL_PATH)
        return _model
    except FileNotFoundError:
        logger.warning(
            "Decay model not found at %s. Using default retention 0.5.", MODEL_PATH
        )
        return None


def compute_spacing_score(review_timestamps: list[datetime]) -> float:
    """Higher score = better spacing between reviews."""
    if len(review_timestamps) < 2:
        return 0.3
    gaps = []
    sorted_ts = sorted(review_timestamps)
    for i in range(1, len(sorted_ts)):
        gap = (sorted_ts[i] - sorted_ts[i - 1]).total_seconds() / 86400
        gaps.append(gap)
    ideal = [2**i for i in range(len(gaps))]
    if len(gaps) < 2:
        return 0.5
    correlation = np.corrcoef(gaps, ideal[: len(gaps)])[0, 1]
    if np.isnan(correlation):
        return 0.5
    return float(np.clip((correlation + 1) / 2, 0, 1))


def predict_node_retention(node_features: dict) -> dict:
    """
    Predict retention for a single node.

    Edge cases handled:
    - days_since_review = 0 → retention 1.0
    - review_count = 0 → state 'red', retention 0.0
    - last_reviewed is None → days = 99, retention 0.0
    - model not found → default 0.5
    """
    days = node_features.get("days_since_review", 0)
    review_count = node_features.get("review_count", 0)

    if review_count == 0:
        return {
            "retention": 0.0,
            "days_until_decay": 0,
            "alert": False,
            "node_state": "red",
        }

    if days == 0:
        return {
            "retention": 1.0,
            "days_until_decay": 99.0,
            "alert": False,
            "node_state": "green",
        }

    model = _load_model()
    if model is None:
        return {
            "retention": 0.5,
            "days_until_decay": 5.0,
            "alert": False,
            "node_state": "yellow",
        }

    X = pd.DataFrame([{f: node_features.get(f, 0) for f in FEATURES}])
    R = float(np.clip(model.predict(X)[0], 0.0, 1.0))

    S_est = days / max(-np.log(R + 1e-9), 0.01)
    if R < THRESHOLD:
        days_until_decay = 0.0
    else:
        days_until_decay = float(-S_est * np.log(THRESHOLD))

    return {
        "retention": round(R, 4),
        "days_until_decay": round(days_until_decay, 1),
        "alert": days_until_decay <= 3 and R >= 0.60,
        "node_state": _retention_to_state(R, days_until_decay),
    }


def _retention_to_state(R: float, days: float) -> str:
    if R >= 0.85:
        return "green"
    if R >= 0.70:
        return "yellow"
    if days <= 3 and R >= 0.60:
        return "fading"
    return "red"
