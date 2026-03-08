import json
import os
import numpy as np

ML_DIR = os.path.dirname(os.path.abspath(__file__))


def load_metrics() -> dict:
    """Load and return the saved metrics from training."""
    path = os.path.join(ML_DIR, "metrics.json")
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            "error": "metrics.json not found. Run train_model.py first.",
            "rmse": None,
            "mae": None,
            "rmse_baseline": None,
            "personalization_lift_pct": None,
            "precision_at_threshold": None,
            "recall_at_threshold": None,
            "feature_importance": {},
        }


def compute_decay_curves() -> dict:
    """
    Generate theoretical decay curves for the Metrics dashboard.
    Three lines: generic, consistent learner, binge learner.
    """
    days = np.arange(0, 31, 0.5).tolist()

    generic_S = 5.0
    consistent_S = 15.0
    binge_S = 2.0

    generic = [round(float(np.exp(-d / generic_S)), 4) for d in days]
    consistent = [round(float(np.exp(-d / consistent_S)), 4) for d in days]
    binge = [round(float(np.exp(-d / binge_S)), 4) for d in days]

    return {
        "days": days,
        "generic": generic,
        "consistent": consistent,
        "binge": binge,
        "threshold": 0.70,
    }


if __name__ == "__main__":
    metrics = load_metrics()
    print("\n=== STORED METRICS ===")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    curves = compute_decay_curves()
    print(f"\n=== DECAY CURVES === ({len(curves['days'])} data points)")
