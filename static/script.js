let trendChart;
window.onload = function() {
  // Setup Chart
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Risk Score',
        data: [],
        borderColor: '#1878E8',
        backgroundColor: 'rgba(24,120,232,0.14)',
        fill: true,
        tension: 0.2,
        pointRadius: 4
      }]
    },
    options: {
      plugins: {legend: {display: false}},
      scales: {
        x: { title: { display: false } },
        y: {
          min: 0, max: 1,
          title: { display: true, text: 'Risk Score' }
        }
      }
    }
  });
};

let mediaRecorder, audioChunks = [];
const recordBtn = document.getElementById('recordButton');
const stopBtn = document.getElementById('stopButton');
const uploadBtn = document.getElementById('uploadBtn');
const audioFileInput = document.getElementById('audiofile');
const resultDiv = document.getElementById('result');
const audioPlayback = document.getElementById('audioPlayback');

recordBtn.onclick = async () => {
  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.start();
  recordBtn.disabled = true; stopBtn.disabled = false;

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  recordBtn.disabled = false; stopBtn.disabled = true;

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    audioPlayback.src = URL.createObjectURL(audioBlob);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    resultDiv.textContent = "Processing...";

    fetch('/predict', { method: 'POST', body: formData })
      .then(res => res.json()).then(data => {
        updateResults(data);
      });
  };
};

uploadBtn.onclick = () => {
  const file = audioFileInput.files[0];
  if (!file) { resultDiv.textContent = "Please select a file."; return; }
  const formData = new FormData();
  formData.append('audio', file);
  resultDiv.textContent = "Processing...";

  fetch('/predict', { method: 'POST', body: formData })
    .then(res => res.json()).then(data => {
      updateResults(data);
    });
};

function updateResults(data) {
  if(data.error){
    resultDiv.textContent = data.error;
    return;
  }
  let color, icon;
  if (data.label === "Low Risk") {
    color = "green"; icon = "✅";
  } else if (data.label === "Moderate Risk") {
    color = "#fec938"; icon = "⚠️";
  } else {
    color = "red"; icon = "❌";
  }
  resultDiv.innerHTML = `<span style="color:${color};font-size:1.3em;">${icon} ${data.label}</span>
    <br>Risk Score: ${data.prob}`;
  // Chart updates:
  if (data.history) {
    const scores = data.history.map(h => h.score);
    trendChart.data.labels = scores.map((v, i) => "Test " + (i + 1));
    trendChart.data.datasets[0].data = scores;
    trendChart.update();
  }
}
