// --- KONFIGURASI ---
const API_KEY = 'AIzaSyBSAXWzuShCOiowAcWU4Nb5B0fhtnzNGC4'; // Ganti dengan API Key Anda
const SPREADSHEET_ID = '1uZ9D5mx95vw40o7-1H5czIXAGgIAhoUF5muEj8BkxGw'; // Ganti dengan Spreadsheet ID Anda
const RANGE = 'Sheet1!A:D'; 

// --- ELEMENT REFERENCES ---
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const questionBox = document.getElementById('questionBox');
const answerLeftBox = document.getElementById('answerLeft');
const answerRightBox = document.getElementById('answerRight');
const textLeft = document.getElementById('textLeft');
const textRight = document.getElementById('textRight');

const feedbackOverlay = document.getElementById('feedbackOverlay');
const feedbackText = document.getElementById('feedbackText');
const startButton = document.getElementById('startButton');
const startScreen = document.getElementById('startScreen');
const scoreDisplay = document.getElementById('scoreDisplay');

// --- STATE ---
let currentQuestionIndex = 0;
let score = 0;
let questions = [];
let answerCooldown = false;
let isGameRunning = false;

// --- GOOGLE SHEETS LOGIC ---
async function loadQuestions() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.values) throw new Error("Data kosong atau error");

    const rows = data.values;
    return rows.slice(1).map(row => ({
      question: row[1],
      answers: [row[2], row[3]],
      correct: row[2], 
    }));
  } catch (error) {
    console.error("Gagal memuat soal:", error);
    alert("Gagal memuat soal. Cek API Key atau Koneksi.");
    return [];
  }
}

// --- GAME LOGIC ---
async function initQuiz() {
  startButton.textContent = "Loading...";
  questions = await loadQuestions();
  
  if (questions.length > 0) {
    // Fade out start screen
    startScreen.style.opacity = '0';
    setTimeout(() => {
        startScreen.style.display = 'none';
        // Show Game UI
        questionBox.style.display = 'block';
        answerLeftBox.style.display = 'flex';
        answerRightBox.style.display = 'flex';
        isGameRunning = true;
        loadQuestion(currentQuestionIndex);
    }, 500);
  }
}

startButton.addEventListener('click', initQuiz);

function loadQuestion(index) {
  const question = questions[index];
  if (question) {
    questionBox.textContent = question.question;

    // Randomize answers
    const answers = [question.answers[0], question.answers[1]];
    const correctAnswer = question.correct;
    answers.sort(() => Math.random() - 0.5);

    textLeft.textContent = answers[0];
    textRight.textContent = answers[1];

    // Store correct answer mapping
    question.currentCorrect = correctAnswer;
  }
}

function handleAnswer(selectedAnswer) {
  if (answerCooldown || !isGameRunning) return;
  
  answerCooldown = true;
  const correctAnswer = questions[currentQuestionIndex].currentCorrect;
  const isCorrect = selectedAnswer === correctAnswer;
  
  if (isCorrect) score++;
  scoreDisplay.textContent = `Score: ${Math.round((100 / questions.length) * score)}`;

  showFeedback(isCorrect, selectedAnswer);

  setTimeout(() => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
      loadQuestion(currentQuestionIndex);
      answerCooldown = false;
    } else {
      endGame();
    }
  }, 1500);
}

function showFeedback(isCorrect, answer) {
  feedbackOverlay.className = `feedback-overlay show ${isCorrect ? 'correct' : 'wrong'}`;
  feedbackText.innerHTML = isCorrect ? 
    `BENAR! 🎉` : 
    `SALAH! ❌<br><span style="font-size:1rem; opacity:0.8">Jawaban: ${answer}</span>`;
  
  setTimeout(() => {
    feedbackOverlay.className = 'feedback-overlay'; // Hide
    if (isGameRunning && currentQuestionIndex < questions.length) {
        answerCooldown = false; 
    }
  }, 1200);
}

function endGame() {
    isGameRunning = false;
    const finalScore = Math.round((100 / questions.length) * score);
    
    questionBox.style.display = 'none';
    answerLeftBox.style.display = 'none';
    answerRightBox.style.display = 'none';

    startScreen.style.display = 'flex';
    startScreen.style.opacity = '1';
    
    const content = document.querySelector('.start-content');
    content.innerHTML = `
        <h1>Quiz Selesai!</h1>
        <p style="font-size: 2rem; font-weight: bold; color: ${finalScore >= 70 ? '#4ade80' : '#f87171'}">${finalScore}/100</p>
        <button class="start-button" onclick="location.reload()">Main Lagi 🔄</button>
    `;
}

// --- MEDIAPIPE SETUP ---
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
});

camera.start();

// --- AR RENDERING & POSITIONING ---
function onResults(results) {
    // Draw video
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Mirroring logic yang benar
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 && isGameRunning) {
        const landmarks = results.multiFaceLandmarks[0];
        
        // Get coordinates (MediaPipe 0-1 normalized coordinates)
        // Landmark 1 = Nose Tip, 10 = Top of Head
        const nose = landmarks[1];
        const headTop = landmarks[10];

        // Convert to canvas coordinates
        // Karena kita mirror canvas, perhitungan X juga harus dibalik relatif terhadap lebar canvas
        const width = canvasElement.width;
        const height = canvasElement.height;

        // Koordinat X asli (normalized)
        const rawX = headTop.x; 
        // Koordinat X yang sudah dibalik (untuk CSS left positioning)
        const screenX = (1 - rawX) * width; 
        const screenY = headTop.y * height;

        // --- POSISI ELEMENT UI ---
        // 1. Question Box (Diatas kepala)
        // Offset Y dikurangi agar melayang diatas kepala
        const qX = screenX - (questionBox.offsetWidth / 2);
        const qY = screenY - 180; // Naikkan angka ini untuk lebih tinggi

        questionBox.style.transform = `translate(${qX}px, ${qY}px)`;

        // 2. Answer Boxes (Kiri & Kanan Kepala)
        // Left Answer (Di layar sebelah kiri wajah pengguna)
        const leftX = screenX - (answerLeftBox.offsetWidth) - 120; // Jarak 120px dari tengah
        const answerY = screenY + 50; // Sejajar kuping/pipi
        
        answerLeftBox.style.transform = `translate(${leftX}px, ${answerY}px)`;

        // Right Answer (Di layar sebelah kanan wajah pengguna)
        const rightX = screenX + 120; 
        answerRightBox.style.transform = `translate(${rightX}px, ${answerY}px)`;

        // --- LOGIKA DETEKSI GERAKAN ---
        // Kita gunakan posisi hidung relatif terhadap tengah gambar (0.5)
        // Karena di-mirror:
        // x < 0.5 artinya wajah di kanan layar (kiri user yang sesungguhnya jika tidak mirror, tapi di layar terlihat kanan)
        // x > 0.5 artinya wajah di kiri layar
        
        // Mari gunakan logika rotasi sederhana atau posisi X
        const deltaX = nose.x - 0.5; // -0.5 (Kanan Layar/Kiri User) s/d +0.5 (Kiri Layar/Kanan User)
        
        // Threshold sensitivitas
        const threshold = 0.08; 

        // PENTING: Karena mirror, logika arah juga terbalik secara visual
        // nose.x membesar = bergerak ke kiri layar (Kanan User)
        // nose.x mengecil = bergerak ke kanan layar (Kiri User)
        
        if (!answerCooldown) {
            if (deltaX < -threshold) {
                // Kepala bergerak ke Kanan Layar (Visual: Jawaban Kanan / B)
                  handleAnswer(textRight.textContent);
            } else if (deltaX > threshold) {
                // Kepala bergerak ke Kiri Layar (Visual: Jawaban Kiri / A)
                handleAnswer(textLeft.textContent);
            }
        }
    }
    
    canvasCtx.restore();
}