from flask import Flask, render_template, request, jsonify
import librosa
import numpy as np
import joblib
import os
import json

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

model = joblib.load('models/parkinsons_rf_model.pkl')
scaler = joblib.load('models/scaler.pkl')

def extract_features(audio_path):
    y, sr = librosa.load(audio_path, sr=16000)
    y, _ = librosa.effects.trim(y)
    y = y / np.max(np.abs(y))
    pitch = np.mean(librosa.yin(y, fmin=75, fmax=350, sr=sr))
    mfccs = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)
    hnr = np.mean(librosa.effects.harmonic(y)) / (np.mean(y) + 1e-6)
    features = np.concatenate([[pitch, hnr], mfccs])
    features = np.pad(features, (0, scaler.mean_.shape[0] - len(features)), 'constant')
    features = features.reshape(1, -1)
    return features

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'audio' not in request.files:
        return jsonify({'error': 'No file uploaded'})
    audio = request.files['audio']
    temp_path = 'temp.wav'
    audio.save(temp_path)
    feats = extract_features(temp_path)
    feats_scaled = scaler.transform(feats)
    prob = model.predict_proba(feats_scaled)[0][1]
    if prob > 0.7:
        label = "High Risk"
    elif prob > 0.4:
        label = "Moderate Risk"
    else:
        label = "Low Risk"
    user_ip = request.remote_addr.replace(':','_')
    os.makedirs('history', exist_ok=True)
    hist_file = f'history/{user_ip}_history.json'
    try:
        with open(hist_file, 'r') as f:
            history = json.load(f)
    except:
        history = []
    history.append({'score': float(prob), 'label': label})
    with open(hist_file, 'w') as f:
        json.dump(history, f)
    return jsonify({'label': label, 'prob': round(float(prob), 2), 'history': history})

if __name__ == '__main__':
    app.run(debug=True)
