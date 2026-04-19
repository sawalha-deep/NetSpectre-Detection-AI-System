#!/usr/bin/env python3
# ==========================================
# Deep Learning IDS (FINAL)
# ==========================================

import pandas as pd
import numpy as np
import hashlib
import joblib

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils import class_weight

from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Dense, Dropout, Embedding,
    Conv1D, GlobalMaxPooling1D, Concatenate
)
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.metrics import Precision, Recall, AUC
from tensorflow.keras.callbacks import EarlyStopping

# ==========================================
# CONFIG
# ==========================================
CSV_FILE = "CSVS/final_dataset.csv"

MODEL_OUT = "models/sqli_dl_model4.h5"
TOKENIZER_OUT = "models/tokenizer4.joblib"
SCALER_OUT = "models/scaler4.joblib"
META_OUT = "models/meta4.joblib"

MAX_WORDS = 20000
MAX_LEN = 120
EPOCHS = 20
BATCH_SIZE = 128
HASH_SPLIT_RATIO = 0.8
THRESHOLD = 0.80   # IDS-friendly threshold

# ==========================================
# LOAD DATA
# ==========================================
df = pd.read_csv(CSV_FILE)
df["payload"] = df["payload"].fillna("").astype(str)

# ==========================================
# HASH SPLIT (ANTI DATA-LEAKAGE)
# ==========================================
df["phash"] = df["payload"].apply(
    lambda x: hashlib.md5(x.encode(errors="ignore")).hexdigest()
)

unique_hashes = df["phash"].unique()
np.random.shuffle(unique_hashes)

split = int(len(unique_hashes) * HASH_SPLIT_RATIO)
train_hashes = unique_hashes[:split]
test_hashes  = unique_hashes[split:]

train_df = df[df["phash"].isin(train_hashes)]
test_df  = df[df["phash"].isin(test_hashes)]

print(f"[+] Train samples: {len(train_df)}")
print(f"[+] Test  samples: {len(test_df)}")

# ==========================================
# FEATURES
# ==========================================
NUMERIC_FEATURES = [
    "method_get","method_post",
    "uri_length","payload_length",
    "param_count","payload_entropy",
    "token_count","longest_token","avg_token_len",
    "digit_ratio","special_ratio",
    "quote_ratio","dquote_ratio",
    "comment_ratio","operator_ratio",
    "semicolon_ratio","paren_ratio",
    "encoded_ratio","space_ratio",
    "frame_len","retransmission"
]

X_train_num = train_df[NUMERIC_FEATURES]
X_test_num  = test_df[NUMERIC_FEATURES]

y_train = train_df["label"].values
y_test  = test_df["label"].values

# ==========================================
# SCALE NUMERIC (FIXED: with feature names)
# ==========================================
scaler = StandardScaler()
X_train_num = scaler.fit_transform(X_train_num)
X_test_num  = scaler.transform(X_test_num)

joblib.dump(scaler, SCALER_OUT)

# ==========================================
# TEXT FEATURES (CHAR LEVEL CNN)
# ==========================================
tokenizer = Tokenizer(
    num_words=MAX_WORDS,
    char_level=True,
    lower=True
)

tokenizer.fit_on_texts(train_df["payload"])

X_train_txt = pad_sequences(
    tokenizer.texts_to_sequences(train_df["payload"]),
    maxlen=MAX_LEN
)

X_test_txt = pad_sequences(
    tokenizer.texts_to_sequences(test_df["payload"]),
    maxlen=MAX_LEN
)

joblib.dump(tokenizer, TOKENIZER_OUT)

# ==========================================
# CLASS WEIGHTS (CRITICAL FOR IDS)
# ==========================================
weights = class_weight.compute_class_weight(
    class_weight="balanced",
    classes=np.unique(y_train),
    y=y_train
)

CLASS_WEIGHT = {0: weights[0], 1: weights[1]}
print("[+] Class weights:", CLASS_WEIGHT)

# ==========================================
# MODEL ARCHITECTURE
# ==========================================
num_input = Input(shape=(X_train_num.shape[1],), name="num_input")
x_num = Dense(64, activation="relu")(num_input)
x_num = Dropout(0.4)(x_num)

txt_input = Input(shape=(MAX_LEN,), name="txt_input")
embed = Embedding(MAX_WORDS, 64)(txt_input)

c3 = Conv1D(128, 3, activation="relu")(embed)
c5 = Conv1D(128, 5, activation="relu")(embed)
c7 = Conv1D(128, 7, activation="relu")(embed)

p3 = GlobalMaxPooling1D()(c3)
p5 = GlobalMaxPooling1D()(c5)
p7 = GlobalMaxPooling1D()(c7)

x_txt = Concatenate()([p3, p5, p7])

merged = Concatenate()([x_num, x_txt])
merged = Dense(128, activation="relu")(merged)
merged = Dropout(0.5)(merged)

output = Dense(1, activation="sigmoid")(merged)

model = Model(inputs=[num_input, txt_input], outputs=output)

model.compile(
    optimizer=Adam(1e-4),
    loss="binary_crossentropy",
    metrics=[
        Precision(name="precision"),
        Recall(name="recall"),
        AUC(name="auc")
    ]
)

model.summary()

# ==========================================
# TRAIN
# ==========================================
early_stop = EarlyStopping(
    monitor="val_loss",
    patience=3,
    restore_best_weights=True
)

model.fit(
    [X_train_num, X_train_txt],
    y_train,
    validation_data=([X_test_num, X_test_txt], y_test),
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    class_weight=CLASS_WEIGHT,
    callbacks=[early_stop]
)

# ==========================================
# EVALUATION
# ==========================================
probs = model.predict([X_test_num, X_test_txt]).ravel()
y_pred = (probs >= THRESHOLD).astype(int)

print("\n[+] Threshold:", THRESHOLD)
print(classification_report(y_test, y_pred))
print("[+] Confusion Matrix")
print(confusion_matrix(y_test, y_pred))

# ==========================================
# SAVE EVERYTHING
# ==========================================
model.save(MODEL_OUT)
joblib.dump({"threshold": THRESHOLD}, META_OUT)

print("[✔] Model saved:", MODEL_OUT)
print("[✔] Scaler saved:", SCALER_OUT)
print("[✔] Tokenizer saved:", TOKENIZER_OUT)
print("[✔] Meta saved:", META_OUT)
