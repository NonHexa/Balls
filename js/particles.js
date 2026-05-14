import { gameState } from './state.js';

export class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 0.5;
        this.color = color;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt / 60;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1;
    }
}

export function updateParticles(dt) {
    gameState.particles.forEach(p => p.update(dt));
    gameState.particles = gameState.particles.filter(p => p.life > 0);
}

export function drawParticles(ctx) {
    gameState.particles.forEach(p => p.draw(ctx));
}

export function spawnUpgradeParticles(x, y, color = '#ff00ff') {
    for (let i = 0; i < 20; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}
