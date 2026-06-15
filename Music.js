// --- Configuration & State ---
const GRID_SIZE = 16;
let isPlaying = false;
let currentStep = 0; 
let intervalId = null;
let audioCtx = null;

// Track active visual waves traveling across the grid
let activeWaves = [];

const frequencies = [
    987.77, 880.00, 783.99, 698.46, 659.25, 587.33, 523.25, 493.88,
    440.00, 392.00, 349.23, 329.63, 293.66, 261.63, 220.00, 196.00
];

const gridState = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0));

// Matching your HTML structure elements
const gridContainer = document.querySelector('.grid');
const playBtn = document.getElementById('play-btn');      // Ensure your HTML button has this ID
const clearBtn = document.getElementById('clear-btn');    // Ensure your HTML button has this ID
const cellElements = {};

// --- Step 1: Initialize Grid Matching Your Structure ---
for (let r = 0; r < GRID_SIZE; r++) {
    cellElements[r] = {};
    for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        
        // Creating the internal light element required by your CSS
        const cellLight = document.createElement('div');
        cellLight.classList.add('cell-light');
        cell.appendChild(cellLight);
        
        cell.addEventListener('mousedown', () => {
            if (gridState[r][c] === 0) {
                gridState[r][c] = 1;
                cell.classList.add('active');
                playTone(frequencies[r]);
            } else {
                gridState[r][c] = 0;
                cell.classList.remove('active');
                cell.style.removeProperty('--ripple-heat');
            }
        });

        gridContainer.appendChild(cell);
        // We store references to both so we can manipulate the container or the light layer
        cellElements[r][c] = { cell, cellLight };
    }
}

// --- Step 2: Audio Engine ---
function playTone(baseFrequency) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = baseFrequency; 

    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.4);
}

// --- Step 3: Fast Visual Wave Expansion ---
function updateVisualWaves() {
    let nextWaves = [];

    // Clear wave opacity variables from the previous step
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (gridState[r][c] === 0) {
                cellElements[r][c].cell.style.removeProperty('--ripple-heat');
            }
        }
    }

    activeWaves.forEach(wave => {
        let waveStillVisible = false;

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const distance = Math.sqrt(Math.pow(r - wave.centerRow, 2) + Math.pow(c - wave.centerCol, 2));
                
                // If cell lands on the primary ring wave front
                if (Math.abs(distance - wave.radius) < 0.6) {
                    waveStillVisible = true;
                    
                    // Utilize your custom CSS property --ripple-heat to illuminate the cell-light
                    if (gridState[r][c] === 0) {
                        cellElements[r][c].cell.style.setProperty('--ripple-heat', '0.45'); 
                    }
                }
            }
        }

        // Keep the radius short (max 4 steps) so it fades away incredibly fast and doesn't crowd
        if (waveStillVisible && wave.radius < 4) {
            nextWaves.push({
                centerRow: wave.centerRow,
                centerCol: wave.centerCol,
                radius: wave.radius + 1
            });
        }
    });

    activeWaves = nextWaves;
}

// --- Step 4: The Master Clock Sequence ---
function clockTick() {
    // 1. Process column timeline hits
    for (let r = 0; r < GRID_SIZE; r++) {
        if (gridState[r][currentStep] === 1) {
            playTone(frequencies[r]);
            
            // Spark a fast wave from this cell
            activeWaves.push({ centerRow: r, centerCol: currentStep, radius: 0 });
        }
    }

    // 2. Advance existing waves
    updateVisualWaves();

    // 3. Keep moving forward down the columns
    currentStep = (currentStep + 1) % GRID_SIZE;
}

// --- Step 5: Controls ---
playBtn.addEventListener('click', () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (isPlaying) {
        clearInterval(intervalId);
        playBtn.innerText = 'Play';
        playBtn.classList.remove('action-button--highlighted');
        activeWaves = [];
        // Reset cell variables
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                cellElements[r][c].cell.style.removeProperty('--ripple-heat');
            }
        }
    } else {
        intervalId = setInterval(clockTick, 150); // Locked to strict tempo speed
        playBtn.innerText = 'Pause';
        playBtn.classList.add('action-button--highlighted');
    }
    isPlaying = !isPlaying;
});

clearBtn.addEventListener('click', () => {
    activeWaves = [];
    currentStep = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            gridState[r][c] = 0;
            cellElements[r][c].cell.classList.remove('active');
            cellElements[r][c].cell.style.removeProperty('--ripple-heat');
        }
    }
});