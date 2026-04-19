import joblib
import pandas as pd
from nfstream import NFStreamer

# تحميل النموذج + scaler
bundle = joblib.load("/home/kali/NetSpectre/model.joblib.back")
model = bundle["model"]
scaler = bundle["scaler"]

# أسماء الخصائص EXACTLY كما في التدريب
FEATURES = list(scaler.feature_names_in_)

print("🚀 IDS started (Normal / Attack + Probability) on wlan0")

streamer = NFStreamer(
    source="wlan0",
    idle_timeout=5
)

for flow in streamer:
    duration = flow.bidirectional_duration_ms / 1000
    if duration <= 0:
        continue

    # كل الخصائص = 0
    sample = dict.fromkeys(FEATURES, 0)

    # الخصائص المتاحة من NFStream
    sample["'Flow Duration'"] = flow.bidirectional_duration_ms
    sample["'Tot Fwd Pkts'"] = flow.src2dst_packets
    sample["'Tot Bwd Pkts'"] = flow.dst2src_packets
    sample["'TotLen Fwd Pkts'"] = flow.src2dst_bytes
    sample["'TotLen Bwd Pkts'"] = flow.dst2src_bytes

    sample["'Flow Byts/s'"] = flow.bidirectional_bytes / duration
    sample["'Flow Pkts/s'"] = flow.bidirectional_packets / duration
    sample["'Fwd Pkts/s'"] = flow.src2dst_packets / duration
    sample["'Bwd Pkts/s'"] = flow.dst2src_packets / duration

    # DataFrame بنفس الترتيب
    df = pd.DataFrame([sample], columns=FEATURES)

    # Scale
    df_scaled = scaler.transform(df)

    # Predict
    pred = model.predict(df_scaled)[0]
    proba = model.predict_proba(df_scaled)[0]

    normal_prob = proba[0] * 100
    attack_prob = proba[1] * 100

    if pred == 0:
        print(
            f"🟢 NORMAL | {flow.src_ip} -> {flow.dst_ip} "
            f"| Normal: {normal_prob:.2f}% | Attack: {attack_prob:.2f}%"
        )
    else:
        print(
            f"🚨 ATTACK | {flow.src_ip} -> {flow.dst_ip} "
            f"| Normal: {normal_prob:.2f}% | Attack: {attack_prob:.2f}%"
        )
