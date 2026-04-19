import joblib
path="/home/kali/NetSpectre/model.joblib"
bundle = joblib.load(path)
scaler = bundle["scaler"]

print(path)
print(scaler.feature_names_in_)

