const videoElement = document.getElementById('cam');
const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');
drawCanvas.width = window.innerWidth;
drawCanvas.height = window.innerHeight;

const modeText = document.getElementById("modeText");
const colorBox = document.getElementById("colorBox");

// ------------------ Drawing ------------------
let drawing = false;
let currentColor = "red";
let brushSize = 12;
let lastX = 0, lastY = 0;
let velocity = 0;
let lastTime = Date.now();

// ------------------ Voice ------------------
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.lang = 'en-US';
recognition.interimResults = false;

recognition.onresult = (event) => {
    const transcript = event.results[event.results.length-1][0].transcript.toLowerCase();
    if(transcript.includes("start drawing")) { drawing=true; modeText.textContent="DRAWING"; }
    else if(transcript.includes("stop drawing")) { drawing=false; modeText.textContent="IDLE"; }
    else if(transcript.includes("clear canvas")) { drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height); drawCtx.beginPath(); }
    else if(transcript.includes("change color")) {
        const colors = ["red","white","purple","green","cyan","yellow"];
        let idx = colors.indexOf(currentColor);
        currentColor = colors[(idx+1)%colors.length];
        colorBox.style.background=currentColor;
    }
};
recognition.start();

// ------------------ Arc Palette ------------------
const palette = [
    {color:"red"}, {color:"orange"}, {color:"yellow"}, 
    {color:"green"}, {color:"cyan"}, {color:"purple"}, {color:"white"}, {color:"black"}
];
let selectedIndex = 0;

function drawArcPalette(){
    const cx = drawCanvas.width/2;
    const cy = 80;
    const radius = 80;
    const thickness = 50;
    const num = palette.length;
    const sector = 180/num;

    for(let i=0;i<num;i++){
        const start = i*sector;
        const end = (i+1)*sector;
        drawCtx.beginPath();
        drawCtx.strokeStyle = palette[i].color;
        drawCtx.lineWidth = thickness;
        drawCtx.arc(cx, cy, radius, start*Math.PI/180, end*Math.PI/180);
        drawCtx.stroke();
        if(i===selectedIndex){
            drawCtx.lineWidth=3;
            drawCtx.strokeStyle="white";
            drawCtx.arc(cx,cy,radius+10,start*Math.PI/180,end*Math.PI/180);
            drawCtx.stroke();
        }
    }
}

// ------------------ Draw Line with Glow ------------------
function drawLine(x,y){
    if(!drawing) return;
    const now = Date.now();
    velocity = Math.hypot(x-lastX, y-lastY)/(now-lastTime)*100;
    lastTime = now;

    drawCtx.strokeStyle = currentColor;
    drawCtx.lineWidth = brushSize;
    drawCtx.lineCap = "round";

    drawCtx.shadowBlur = 15;
    drawCtx.shadowColor = currentColor;

    drawCtx.beginPath();
    drawCtx.moveTo(lastX,lastY);
    drawCtx.lineTo(x,y);
    drawCtx.stroke();

    drawCtx.shadowBlur = 0;

    lastX=x; lastY=y;

    playVelocitySound(velocity);
}

function updateHand(x,y,pinch){
    if(pinch) drawing=true;
    else if(!pinch && !drawing) return;
    drawLine(x,y);
}

// ------------------ MediaPipe Hands ------------------
const hands = new Hands({locateFile:(file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({maxNumHands:1,minDetectionConfidence:0.7,minTrackingConfidence:0.5});
hands.onResults((results)=>{
    drawCtx.clearRect(0,0,drawCanvas.width,drawCanvas.height);
    drawArcPalette();

    if(!results.multiHandLandmarks) return;
    const lms = results.multiHandLandmarks[0];

    const x = lms[8].x*drawCanvas.width;
    const y = lms[8].y*drawCanvas.height;
    const dx = (lms[4].x-lms[8].x)*drawCanvas.width;
    const dy = (lms[4].y-lms[8].y)*drawCanvas.height;
    const pinch = Math.hypot(dx,dy)<60;

    updateHand(x,y,pinch);
});

// ------------------ Camera ------------------
const camera = new Camera(videoElement,{onFrame:async()=>{await hands.send({image:videoElement});},width:window.innerWidth,height:window.innerHeight});
camera.start();

// ------------------ Mouse fallback ------------------
drawCanvas.addEventListener("mousedown",e=>{drawing=true; lastX=e.offsetX; lastY=e.offsetY;});
drawCanvas.addEventListener("mouseup",()=>drawing=false);
drawCanvas.addEventListener("mousemove",e=>drawLine(e.offsetX,e.offsetY));

// ------------------ Velocity-based Sound ------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let osc = audioCtx.createOscillator();
osc.type = "sine";
osc.frequency.setValueAtTime(0, audioCtx.currentTime);
osc.connect(audioCtx.destination);
osc.start();

function playVelocitySound(v){
    // Clamp velocity for sound
    const freq = Math.min(Math.max(200 + v*5, 100), 1000);
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
}
