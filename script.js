const videoElement = document.getElementById('cam');
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const colorBox = document.getElementById('colorBox');
const modeText = document.getElementById('modeText');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ----------------- Color Palette -----------------
const colors = [
  { rgb:[255,0,0], name:"RED" },
  { rgb:[255,165,0], name:"ORANGE" },
  { rgb:[255,255,0], name:"YELLOW" },
  { rgb:[0,255,0], name:"GREEN" },
  { rgb:[0,255,255], name:"CYAN" },
  { rgb:[255,0,255], name:"PURPLE" },
  { rgb:[255,255,255], name:"WHITE" },
  { rgb:[0,0,0], name:"CLEAR" }
];
let currentColorIndex = 4;
let currentColor = colors[currentColorIndex].rgb;

// Update color box
function updateColorBox() {
  colorBox.style.background = `rgb(${currentColor.join(",")})`;
}
updateColorBox();

// ----------------- Draw State -----------------
let drawing = false;
let lastX = 0, lastY = 0;
let scale = 1;

// ----------------- MediaPipe Hands -----------------
const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({maxNumHands:1,minDetectionConfidence:0.7,minTrackingConfidence:0.5});

hands.onResults(results => {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0){
    const landmarks = results.multiHandLandmarks[0];
    const idx = landmarks[8]; // index fingertip
    const thm = landmarks[4]; // thumb tip

    let x = idx.x * canvas.width;
    let y = idx.y * canvas.height;

    // Pinch distance
    const dx = (idx.x - thm.x) * canvas.width;
    const dy = (idx.y - thm.y) * canvas.height;
    const pinchDist = Math.hypot(dx,dy);

    // Punch / Zoom effect
    scale = pinchDist < 0.08 ? 1.5 : 1;
    canvas.style.transform = `scale(${scale}) scaleX(-1)`;

    if(pinchDist < 0.08 && y > 150){ // draw if pinch
      if(lastX && lastY){
        ctx.strokeStyle = `rgb(${currentColor.join(",")})`;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.shadowColor = `rgb(${currentColor.join(",")})`;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(lastX,lastY);
        ctx.lineTo(x,y);
        ctx.stroke();
      }
      lastX = x; lastY = y;
      drawing = true;
      modeText.innerText = "DRAWING";
    } else {
      lastX = 0; lastY = 0;
      drawing = false;
      modeText.innerText = "IDLE";
    }

  } else {
    lastX = 0; lastY = 0;
    modeText.innerText = "IDLE";
  }
});

// ----------------- Camera -----------------
const camera = new Camera(videoElement, {
  onFrame: async () => { await hands.send({image: videoElement}); },
  width: window.innerWidth,
  height: window.innerHeight
});
camera.start();

// ----------------- Voice Commands -----------------
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = false;
recognition.onresult = (event)=>{
  const cmd = event.results[event.results.length-1][0].transcript.toLowerCase();
  console.log("Voice:",cmd);
  if(cmd.includes("change color")){
    currentColorIndex = (currentColorIndex+1)%colors.length;
    currentColor = colors[currentColorIndex].rgb;
    updateColorBox();
    speak("Color changed");
  }
  if(cmd.includes("clear canvas")){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    speak("Canvas cleared");
  }
  if(cmd.includes("start drawing")) {
    speak("Drawing mode on");
  }
  if(cmd.includes("stop drawing")) {
    speak("Drawing mode off");
  }
};
recognition.start();

// ----------------- TTS -----------------
function speak(text){
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  speechSynthesis.speak(utter);
}
