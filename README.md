# VentWean AI — Extubation Readiness Predictor

VentWean AI is a clinical decision support system that predicts a patient's readiness for extubation (removal from mechanical ventilation) using machine learning. It provides a risk score and actionable recommendations to assist clinicians in weaning decisions.

---

## Features
- **Web-based interface** for easy data entry and result visualization
- **AI-powered prediction** using a trained neural network (Keras/TensorFlow)
- **Personalized recommendations**: Ready for extubation, proceed with SBT, continue monitoring, or delay weaning
- **Modern UI** with real-time validation and risk visualization

---

## Project Structure

```
Ventilator Project/
├── backend.py           # Flask API backend (prediction endpoint)
├── index.html           # Frontend web interface
├── scripts.js           # Frontend logic and scoring (for demo/testing)
├── style.css            # UI styles
├── requirements.txt     # Python dependencies
├── weaning_model.h5     # Trained Keras model (binary regression/classification)
├── scaler.pkl           # Feature scaler (joblib)
├── encoders.pkl         # Categorical encoders (joblib)
```

---

## Quick Start

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Ensure model and preprocessors are present
- `weaning_model.h5` — Trained Keras model
- `scaler.pkl` — Feature scaler (joblib)
- `encoders.pkl` — Categorical encoders (joblib)

> **Note:** These files must be present in the project root. If missing, retrain or request from the project author.

### 3. Run the backend server

```bash
python backend.py
```
- The Flask server will start at `http://127.0.0.1:5000/`

### 4. Open the web interface
- Open `index.html` in your browser (double-click or drag into browser)
- Enter patient parameters and click **Predict**

---

## API Usage

### Endpoint
- `POST /predict`

### Request JSON Example
```json
{
  "Age": 56,
  "Sex": "Male",
  "BMI": 24.5,
  "RR": 18,
  "VT": 450,
  "FiO2": 0.35,
  "PEEP": 5,
  "PS": 8,
  "MV": 7.2,
  "PaO2": 90,
  "PaCO2": 40,
  "SpO2": 97,
  "HR": 88,
  "MAP": 75,
  "SBP": 120,
  "GCS": 15,
  "RASS": 0,
  "Hb": 11.2,
  "Lactate": 1.1,
  "WBC": 8.5,
  "Cough_strength": "Strong",
  "Secretions": "Minimal",
  "Duration": 5
}
```

### Response JSON Example
```json
{
  "score": 82.5,
  "risk": "Low",
  "recommendation": "Ready for extubation trial"
}
```

---

## Model Details
- **Input features:** Demographics, respiratory, blood gas, vitals, neuro, labs, clinical
- **Output:** Score (0–100), risk category, recommendation
- **Model:** Keras/TensorFlow regression/classification model
- **Preprocessing:** Standard scaling, categorical encoding (joblib)

---

## Notes
- This tool is for research and educational purposes only. Not for clinical use without validation.
- For questions or retraining, contact the project author.

---

## License
MIT License
