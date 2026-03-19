from flask import Flask, request, jsonify
import numpy as np
import joblib
from tensorflow.keras.models import load_model
from flask_cors import CORS

app = Flask(__name__)

CORS(app)   # ✅ Add this line
model = load_model("weaning_model.h5", compile=False)
scaler = joblib.load("scaler.pkl")
encoders = joblib.load("encoders.pkl")

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    # Encode categorical
    data["Sex"] = encoders["Sex"].transform([data["Sex"]])[0]
    data["Cough_strength"] = encoders["Cough_strength"].transform([data["Cough_strength"]])[0]
    data["Secretions"] = encoders["Secretions"].transform([data["Secretions"]])[0]

    input_list = list(data.values())
    input_array = np.array(input_list, dtype=float).reshape(1, -1)

    input_scaled = scaler.transform(input_array)
    prediction = model.predict(input_scaled)

    print(prediction)

    # score = 9
    score = float(prediction[0][0])

    if score >= 75:
        risk = "Low"
        reco = "Ready for extubation trial"
    elif score >= 60:
        risk = "Medium"
        reco = "Proceed with SBT"
    elif score >= 50:
        risk = "Medium"
        reco = "Continue monitoring"
    else:
        risk = "High"
        reco = "Delay weaning"

    return jsonify({
        "score": round(score, 2),
        "risk": risk,
        "recommendation": reco
    })

if __name__ == "__main__":
    app.run(debug=True)