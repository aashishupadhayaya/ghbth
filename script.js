const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const drawCanvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d");
const modeText = document.getElementById("mode");
const colorBox = document.getElementById("colorBox");

let currentColor = "red";
let drawing = false;
let smoothX = 0;
let smoothY = 0;
const PINCH_THRESHOLD = 40;
const SMOOTHING = 0.6;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
drawCanvas.width = window.innerWidth;
drawCanvas.height = window.innerHeight;

colorBox.style.background = currentColor;

// Camera setup
navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
    video.srcObject = stream;
});

// MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(results => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        const x = indexTip.x * canvas.width;
        const y = indexTip.y * canvas.height;

        if (smoothX === 0) {
            smoothX = x;
            smoothY = y;
        }

        smoothX = smoothX * (1 - SMOOTHING) + x * SMOOTHING;
        smoothY = smoothY * (1 - SMOOTHING) + y * SMOOTHING;

        const dx = (indexTip.x - thumbTip.x) * canvas.width;
        const dy = (indexTip.y - thumbTip.y) * canvas.height;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // HUD circle (sci-fi pointer)
        ctx.beginPath();
        ctx.arc(smoothX, smoothY, 15, 0, 2 * Math.PI);
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.shadowColor = "red";
        ctx.shadowBlur = 20;
        ctx.stroke();

        if (dist < PINCH_THRESHOLD && smoothY > 150) {
            drawing = true;
            modeText.textContent = "DRAWING";

            drawCtx.strokeStyle = currentColor;
            drawCtx.lineWidth = 8;
            drawCtx.lineCap = "round";
            drawCtx.shadowColor = "red";
            drawCtx.shadowBlur = 15;

            drawCtx.lineTo(smoothX, smoothY);
            drawCtx.stroke();
            drawCtx.beginPath();
            drawCtx.moveTo(smoothX, smoothY);
        } else {
            drawing = false;
            modeText.textContent = "IDLE";
            drawCtx.beginPath();
        }
    } else {
        modeText.textContent = "NO HAND DETECTED";
    }
});

// Camera feed loop
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1280,
    height: 720
});

camera.start();
// ----------- Voice Commands Jarvis Mode -----------
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';
recognition.interimResults = false;

recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
    console.log("Heard:", transcript);

    if (transcript.includes("start drawing")) {
        modeText.textContent = "DRAWING";
    } else if (transcript.includes("stop drawing")) {
        modeText.textContent = "IDLE";
    } else if (transcript.includes("clear canvas")) {
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    } else if (transcript.includes("change color")) {
        // Cycle colors
        const colors = ["red", "white", "purple", "green"];
        let currentIndex = colors.indexOf(currentColor);
        currentColor = colors[(currentIndex + 1) % colors.length];
        colorBox.style.background = currentColor;
    }
};

// Start voice recognition automatically
recognition.start();

// Handle errors
recognition.onerror = (event) => {
    console.log("Speech recognition error:", event.error);
};
