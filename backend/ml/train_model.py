import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib
import json
import os

ML_DIR = os.path.dirname(os.path.abspath(__file__))

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
TARGET = "R_true"


def train():
    df = pd.read_csv(os.path.join(ML_DIR, "dataset.csv"))
    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

    y_pred = np.clip(model.predict(X_test), 0, 1)

    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)

    y_baseline = np.exp(-X_test["days_since_review"] / 5.0).clip(0, 1)
    rmse_base = np.sqrt(mean_squared_error(y_test, y_baseline))
    lift = (rmse_base - rmse) / rmse_base * 100

    threshold = 0.70
    y_pred_flag = (y_pred < threshold).astype(int)
    y_true_flag = (y_test.values < threshold).astype(int)
    tp = ((y_pred_flag == 1) & (y_true_flag == 1)).sum()
    fp = ((y_pred_flag == 1) & (y_true_flag == 0)).sum()
    fn = ((y_pred_flag == 0) & (y_true_flag == 1)).sum()
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0

    metrics = {
        "rmse": round(float(rmse), 4),
        "mae": round(float(mae), 4),
        "rmse_baseline": round(float(rmse_base), 4),
        "personalization_lift_pct": round(float(lift), 2),
        "precision_at_threshold": round(float(precision), 4),
        "recall_at_threshold": round(float(recall), 4),
        "threshold": threshold,
        "feature_importance": dict(
            zip(FEATURES, model.feature_importances_.round(4).tolist())
        ),
    }

    joblib.dump(model, os.path.join(ML_DIR, "decay_model.joblib"))
    with open(os.path.join(ML_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n=== MODEL METRICS ===")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    return model, metrics


if __name__ == "__main__":
    train()
