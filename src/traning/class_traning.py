#!/usr/bin/env python3
import argparse
import joblib
import optuna
import numpy as np
import pandas as pd

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, classification_report
from sklearn.utils.class_weight import compute_class_weight

from xgboost import XGBClassifier

# ================= CONFIG =================
TARGET_COL = "attack_type"
RANDOM_SEED = 42
N_TRIALS = 150
FEATURE_IMPORTANCE_THRESHOLD = 0.01   # 🔥 Feature Selection

# ================= MAIN =================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-f", "--file", required=True, help="attacks csv")
    parser.add_argument("-o", "--output", default="attack_type_xgb_fs.joblib")
    args = parser.parse_args()

    print("[+] Loading dataset...")
    df = pd.read_csv(args.file)

    # ========== CLEAN ==========
    df = df.dropna()
    df = df.replace([np.inf, -np.inf], 0)

    X = df.drop(columns=[TARGET_COL])
    y = df[TARGET_COL]

    all_features = X.columns.tolist()

    # ========== LABEL ENCODE ==========
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    # ========== SPLIT ==========
    X_train, X_val, y_train, y_val = train_test_split(
        X, y_enc,
        test_size=0.2,
        stratify=y_enc,
        random_state=RANDOM_SEED
    )

    # ========== SCALING ==========
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val   = scaler.transform(X_val)

    # ========== CLASS WEIGHTS ==========
    classes = np.unique(y_train)
    weights = compute_class_weight(
        class_weight="balanced",
        classes=classes,
        y=y_train
    )
    class_weights = dict(zip(classes, weights))
    sample_weights = np.array([class_weights[i] for i in y_train])

    # ========== OPTUNA OBJECTIVE ==========
    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 600),
            "max_depth": trial.suggest_int("max_depth", 4, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "gamma": trial.suggest_float("gamma", 0, 5),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),

            "objective": "multi:softmax",
            "num_class": len(classes),
            "eval_metric": "mlogloss",
            "tree_method": "hist",
            "random_state": RANDOM_SEED,
        }

        model = XGBClassifier(**params)
        model.fit(X_train, y_train, sample_weight=sample_weights)

        preds = model.predict(X_val)
        return f1_score(y_val, preds, average="weighted")

    # ========== RUN OPTUNA ==========
    print("[+] Running Optuna...")
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=N_TRIALS, show_progress_bar=True)

    print(f"\n[✓] Best F1 = {study.best_value:.4f}")

    # ========== TRAIN TEMP MODEL ==========
    best_params = study.best_params
    best_params.update({
        "objective": "multi:softprob",
        "num_class": len(classes),
        "eval_metric": "mlogloss",
        "tree_method": "hist",
        "random_state": RANDOM_SEED,
    })

    temp_model = XGBClassifier(**best_params)
    temp_model.fit(X_train, y_train, sample_weight=sample_weights)

    # ========== FEATURE SELECTION ==========
    importances = temp_model.feature_importances_
    importance_df = pd.Series(importances, index=all_features)

    selected_features = importance_df[
        importance_df >= FEATURE_IMPORTANCE_THRESHOLD
    ].index.tolist()

    print("\n[✓] Selected Features:")
    for f in selected_features:
        print(f"  - {f}")

    # ========== REBUILD DATA WITH SELECTED FEATURES ==========
    X = df[selected_features]
    X_train, X_val, y_train, y_val = train_test_split(
        X, y_enc,
        test_size=0.2,
        stratify=y_enc,
        random_state=RANDOM_SEED
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val   = scaler.transform(X_val)

    sample_weights = np.array([class_weights[i] for i in y_train])

    # ========== FINAL MODEL ==========
    final_model = XGBClassifier(**best_params)
    final_model.fit(X_train, y_train, sample_weight=sample_weights)

    preds = final_model.predict(X_val)

    print("\n====== FINAL MODEL REPORT ======")
    print(classification_report(y_val, preds, target_names=le.classes_))

    # ========== SAVE ==========
    bundle = {
        "model": final_model,
        "scaler": scaler,
        "label_encoder": le,
        "features": selected_features,
        "classes": le.classes_.tolist(),
        "best_params": study.best_params,
        "feature_importance": importance_df[selected_features].to_dict()
    }

    joblib.dump(bundle, args.output)
    print(f"\n[✓] Saved professional model → {args.output}")

# ================= RUN =================
if __name__ == "__main__":
    main()
