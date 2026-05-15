import { gameState } from './state.js';
import { ENEMY_MAX_SPEED } from './config.js';

const collisionChordDict = [
    { root: 220, semitones: [0, 4, 7] },
    { root: 246.94, semitones: [0, 3, 7] },
    { root: 261.63, semitones: [0, 4, 7, 11] },
    { root: 293.66, semitones: [0, 5, 9] },
    { root: 329.63, semitones: [0, 4, 7] }
];

export function createReverbBuffer(ctx, duration, decay) {
    const rate = ctx.sampleRate;
    const len = rate * duration;
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

export function initAudio() {
    if (gameState.audioStarted) return;
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gameState.masterGain = gameState.audioCtx.createGain();
    gameState.masterGain.gain.value = 0.35;

    gameState.reverbNode = gameState.audioCtx.createConvolver();
    gameState.reverbNode.buffer = createReverbBuffer(gameState.audioCtx, 2.2, 2.8);
    const reverbGain = gameState.audioCtx.createGain();
    reverbGain.gain.value = 0.45;
    gameState.reverbNode.connect(reverbGain);
    reverbGain.connect(gameState.audioCtx.destination);

    gameState.masterGain.connect(gameState.audioCtx.destination);
    gameState.masterGain.connect(gameState.reverbNode);
    gameState.audioStarted = true;
}

export function buildCollisionNotes() {
    const notes = [];
    for (const ch of collisionChordDict) {
        for (const st of ch.semitones) {
            notes.push(ch.root * Math.pow(2, st / 12));
        }
    }
    return notes;
}

const collisionNotes = buildCollisionNotes();
const ENEMY_SPEED_BANDS = Array.from({ length: collisionNotes.length }, (_, i) => (i / collisionNotes.length) * ENEMY_MAX_SPEED);

export function speedToNoteIndex(speed) {
    let idx = 0;
    for (let i = ENEMY_SPEED_BANDS.length - 1; i >= 0; i--) {
        if (speed >= ENEMY_SPEED_BANDS[i]) { idx = i; break; }
    }
    return idx;
}

export function playCollisionTone(speed) {
    if (!gameState.audioStarted || !gameState.audioCtx) return;
    const idx = speedToNoteIndex(Math.min(speed, ENEMY_MAX_SPEED));
    const freq = collisionNotes[idx];

    const osc = gameState.audioCtx.createOscillator();
    const gain = gameState.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(gameState.masterGain);

    const t = gameState.audioCtx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
    gain.gain.setValueAtTime(0.22, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.start(t);
    osc.stop(t + 0.65);
}

export function ensureAudio() {
    if (!gameState.audioStarted) initAudio();
    else if (gameState.audioCtx && gameState.audioCtx.state === 'suspended') gameState.audioCtx.resume();
}
