import numpy as np
import pandas as pd
import random
import os

np.random.seed(42)
random.seed(42)

DOMAINS = ["machine_learning", "coding", "finance", "biology", "history"]
N_USERS = 1000
LEARNER_TYPES = {
    "consistent": {"review_gap_mean": 3, "review_gap_std": 1, "engage_mean": 0.8},
    "binge":      {"review_gap_mean": 14, "review_gap_std": 5, "engage_mean": 0.5},
    "gradual":    {"review_gap_mean": 7, "review_gap_std": 2, "engage_mean": 0.65},
}


def ebbinghaus_retention(t_days: float, S: float) -> float:
    """R(t) = e^(-t/S), clamped to [0, 1]"""
    return float(np.clip(np.exp(-t_days / S), 0.0, 1.0))


def generate_record(user_id: int, domain: str, learner_type: str) -> dict:
    lt = LEARNER_TYPES[learner_type]
    complexity_tier = random.randint(1, 3)
    dependency_depth = random.randint(0, 5)
    review_count = random.randint(1, 20)

    if learner_type == "binge":
        spacing_score = np.random.beta(2, 5)
    elif learner_type == "consistent":
        spacing_score = np.random.beta(5, 2)
    else:
        spacing_score = np.random.beta(3, 3)

    time_spent_avg = max(1, np.random.normal(lt["engage_mean"] * 20, 5))
    feynman_score = np.random.beta(3, 3) if review_count > 2 else 0.0
    revisit_rate = (
        np.random.beta(4, 2) if learner_type == "binge" else np.random.beta(2, 5)
    )
    practice_fail_rate = max(0, np.random.normal(1 - lt["engage_mean"], 0.15))
    confidence_gap = abs(np.random.normal(0, 0.2))

    S_true = (
        2.0
        + spacing_score * 8
        + feynman_score * 5
        + (review_count / 20) * 4
        - complexity_tier * 1.5
        - dependency_depth * 0.3
        + time_spent_avg * 0.1
        - practice_fail_rate * 3
    )
    S_true = max(0.5, S_true)

    days_since = abs(np.random.normal(lt["review_gap_mean"], lt["review_gap_std"]))

    R_true = ebbinghaus_retention(days_since, S_true)
    R_true = float(np.clip(R_true + np.random.normal(0, 0.05), 0, 1))

    return {
        "user_id": user_id,
        "domain": domain,
        "learner_type": learner_type,
        "complexity_tier": complexity_tier,
        "dependency_depth": dependency_depth,
        "review_count": review_count,
        "spacing_score": round(spacing_score, 4),
        "time_spent_avg": round(time_spent_avg, 2),
        "feynman_score": round(feynman_score, 4),
        "revisit_rate": round(revisit_rate, 4),
        "practice_fail_rate": round(practice_fail_rate, 4),
        "confidence_gap": round(confidence_gap, 4),
        "days_since_review": round(days_since, 2),
        "S_true": round(S_true, 4),
        "R_true": round(R_true, 4),
    }


def generate_dataset():
    records = []
    for user_id in range(N_USERS):
        lt = random.choice(list(LEARNER_TYPES.keys()))
        domain = random.choice(DOMAINS)
        n_concepts = random.randint(10, 50)
        for _ in range(n_concepts):
            records.append(generate_record(user_id, domain, lt))

    df = pd.DataFrame(records)

    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "dataset.csv")
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} records for {N_USERS} users → {out_path}")
    return df


if __name__ == "__main__":
    generate_dataset()
