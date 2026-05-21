import { gameState, refs } from './state.js';
import { enemyTypes, palettes, PRESTIGE_ENEMY_STAT_BONUS, PRESTIGE_SPAWN_BONUS, ENEMY_MAX_SPEED, upgrades, prestigeUpgrades, difficultyPresets } from './config.js';
import { playCollisionTone } from './audio.js';
import { Particle, spawnUpgradeParticles } from './particles.js';

export class PlayerBall {
    constructor() {
        this.orbitRadius = 150;
        this.angle = 0;
        this.size = 16;
        this.blink = 0;
        this.damage = 1;
    }

    update(mx, my) {
        if (mx !== null) {
            this.angle = Math.atan2(my - gameState.center.y, mx - gameState.center.x);
        }
        this.x = gameState.center.x + Math.cos(this.angle) * this.orbitRadius;
        this.y = gameState.center.y + Math.sin(this.angle) * this.orbitRadius;
    }

    draw(ctx) {
        ctx.save();
        if (this.blink === 1) ctx.globalAlpha = 0.2;
        else if (this.blink === 2) ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
    }
}

export class OrbitBall {
    constructor(angle) {
        this.angle = angle;
        this.orbitRadius = 60;
        this.size = 14;
        this.angularSpeed = 0.02;
        this.damage = 0.25;
        this.x = 0;
        this.y = 0;
    }

    update(centerAngle, i, total, dt) {
        if (gameState.orbitControlActive) {
            // Orbit slowly around center instead of following
            this.angle += this.angularSpeed * 0.3 * dt;
            
            if (gameState.magnetLevel > 0 && gameState.enemies.length > 0) {
                let nearest = null;
                let nd = Infinity;
                for (const e of gameState.enemies) {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < nd) { nd = d; nearest = e; }
                }
                if (nearest) {
                    const desired = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                    let diff = desired - this.angle;
                    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                    this.angle += diff * gameState.magnetStrength * dt;
                }
            }
        } else {
            // Original behavior: follow player
            const spreadOffset = gameState.player2 ? Math.PI / total : 0;
            const baseTarget = centerAngle + spreadOffset + i * (Math.PI * 2 / total);
            this.angle += ((baseTarget - this.angle) * 0.1 + this.angularSpeed) * dt;
            this.angle += Math.sin(Date.now() * 0.002 + i) * 0.01 * dt;

            if (gameState.magnetLevel > 0 && gameState.enemies.length > 0) {
                let nearest = null;
                let nd = Infinity;
                for (const e of gameState.enemies) {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < nd) { nd = d; nearest = e; }
                }
                if (nearest) {
                    const desired = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                    let diff = desired - this.angle;
                    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                    this.angle += diff * gameState.magnetStrength * dt;
                }
            }
        }
        this.x = gameState.center.x + Math.cos(this.angle) * this.orbitRadius;
        this.y = gameState.center.y + Math.sin(this.angle) * this.orbitRadius;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = palettes[gameState.currentPalette].orbitBall;
        ctx.fill();
    }
}

export class Enemy {
    constructor(forceType = null) {
        gameState.spawnCount++;
        let t;
        if (forceType) t = forceType;
        else if (gameState.spawnCount < 5) t = enemyTypes.medium;
        else if (gameState.spawnCount < 15) t = Math.random() < 0.7 ? enemyTypes.medium : enemyTypes.slow;
        else {
            const pool = [
                { type: enemyTypes.medium, w: 35 },
                { type: enemyTypes.slow,   w: 20 },
                { type: enemyTypes.fast,   w: 15 }
            ];
            if (gameState.wave >= 3) pool.push({ type: enemyTypes.zigzag,   w: 12 });
            if (gameState.wave >= 4) pool.push({ type: enemyTypes.shielded, w: 8 });
            if (gameState.wave >= 5) pool.push({ type: enemyTypes.splitter, w: 8 });
            if (gameState.wave >= 6) pool.push({ type: enemyTypes.ghost,    w: 7 });
            if (gameState.wave >= 7) pool.push({ type: enemyTypes.hunter,   w: 8 });
            if (gameState.wave >= 8) pool.push({ type: enemyTypes.wisp,     w: 8 });
            if (gameState.wave >= 9) pool.push({ type: enemyTypes.bomber,   w: 7 });
            if (gameState.wave >= 10) pool.push({ type: enemyTypes.brute,   w: 6 });
            if (gameState.wave >= 11) pool.push({ type: enemyTypes.orbiter, w: 6 });

            const totalW = pool.reduce((s, p) => s + p.w, 0);
            let r = Math.random() * totalW;
            t = pool[pool.length - 1].type;
            for (const p of pool) {
                r -= p.w;
                if (r <= 0) { t = p.type; break; }
            }
        }

        Object.assign(this, JSON.parse(JSON.stringify(t)));
        const palette = palettes[gameState.currentPalette];
        for (const [enemyType, color] of Object.entries(palette.enemyColors)) {
            if (this.color === enemyTypes[enemyType]?.color) {
                this.color = color;
                break;
            }
        }

        const prestigeStatMul = 1 + gameState.prestigeCount * PRESTIGE_ENEMY_STAT_BONUS;
        const healthScale = (1.2 + (gameState.difficultyRamp * 0.8)) * prestigeStatMul;
        this.life = Math.ceil(this.life * healthScale);
        if (gameState.wave > 5) {
            this.life += Math.floor((gameState.wave - 5) * 0.3);
            this.speedMultiplier *= 1 + (gameState.wave - 5) * 0.02;
        }
        this.speedMultiplier *= prestigeStatMul;

        if (this.zigzags) this.zigTimer = Math.random() * Math.PI * 2;
        if (this.phases) {
            this.phaseTimer = Math.random() * Math.PI * 2;
            this.visible = true;
        }
        if (this.hasShield) this.shielded = true;
        if (this.orbitsCenter) {
            this.orbitAngle = Math.random() * Math.PI * 2;
            this.orbitDist = 130 + Math.random() * 120;
        }

        const e = Math.random();
        if (e < 0.25)  { this.x = 0; this.y = Math.random() * refs.canvas.height; }
        else if (e < 0.5) { this.x = refs.canvas.width; this.y = Math.random() * refs.canvas.height; }
        else if (e < 0.75) { this.x = Math.random() * refs.canvas.width; this.y = 0; }
        else { this.x = Math.random() * refs.canvas.width; this.y = refs.canvas.height; }

        this.vx = 0;
        this.vy = 0;
        this.isBoss = false;
    }

    takeDamage(dmg) {
        if (this.phases && !this.visible) return false;
        if (this.shielded) {
            this.shielded = false;
            this.color = this.color === '#ffff00' ? '#cc8800' : this.color;
            for (let i = 0; i < 8; i++) gameState.particles.push(new Particle(this.x, this.y, '#ffff00'));
            return false;
        }
        if (this.armored) dmg *= 0.65;
        this.life -= dmg;
        return true;
    }

    update(dt) {
        let tx = gameState.center.x;
        let ty = gameState.center.y;
        if (this.huntsPlayer && gameState.player) {
            tx = gameState.player.x;
            ty = gameState.player.y;
        }

        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speedScale = (0.5 + (gameState.difficultyRamp * 0.5)) * gameState.diffSpeedMul;
        this.vx += dx / dist * this.gravity * this.speedMultiplier * speedScale * dt;
        this.vy += dy / dist * this.gravity * this.speedMultiplier * speedScale * dt;

        if (this.zigzags) {
            this.zigTimer += 0.08 * dt;
            const perpX = -dy / dist;
            const perpY = dx / dist;
            this.vx += perpX * Math.sin(this.zigTimer) * 0.8 * dt;
            this.vy += perpY * Math.sin(this.zigTimer) * 0.8 * dt;
        }

        if (this.phases) {
            this.phaseTimer += 0.025 * dt;
            this.visible = Math.sin(this.phaseTimer) > -0.3;
        }

        if (this.jitters) {
            this.vx += (Math.random() - 0.5) * 0.45 * dt;
            this.vy += (Math.random() - 0.5) * 0.45 * dt;
        }

        if (this.orbitsCenter) {
            this.orbitAngle += 0.02 * dt;
            const ox = gameState.center.x + Math.cos(this.orbitAngle) * this.orbitDist;
            const oy = gameState.center.y + Math.sin(this.orbitAngle) * this.orbitDist;
            this.vx += (ox - this.x) * 0.0025 * dt;
            this.vy += (oy - this.y) * 0.0025 * dt;
            this.orbitDist = Math.max(40, this.orbitDist - 0.03 * dt);
        }

        if (gameState.cryoLevel > 0 && !this.isBoss && this.color !== '#8800ff') {
            const cd = Math.hypot(this.x - gameState.center.x, this.y - gameState.center.y);
            if (cd < gameState.cryoRadius) {
                const slow = Math.pow(gameState.cryoSlow, dt);
                this.vx *= slow;
                this.vy *= slow;
            }
        }

        const spd = Math.hypot(this.vx, this.vy);
        if (spd > ENEMY_MAX_SPEED) {
            this.vx *= ENEMY_MAX_SPEED / spd;
            this.vy *= ENEMY_MAX_SPEED / spd;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.save();
        if (this.phases && !this.visible) ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        if (this.shielded) {
            ctx.strokeStyle = 'rgba(255,255,0,0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.armored) {
            ctx.strokeStyle = 'rgba(255,180,80,0.65)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class BossEnemy {
    constructor(x = null, y = null, size = 40, generation = 0) {
        this.size = size;
        this.generation = generation;
        this.maxGeneration = 2;
        this.life = 1;
        this.color = palettes[gameState.currentPalette].bossColors[0];
        this.x = x ?? Math.random() * refs.canvas.width;
        this.y = y ?? -50;
        this.vx = 0;
        this.vy = 1;
        this.blink = 0;
        this.isBoss = true;
    }

    update(dt) {
        const dx = gameState.center.x - this.x;
        const dy = gameState.center.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 0.06 + this.generation * 0.02;
        this.vx += dx / dist * speed * dt;
        this.vy += dy / dist * speed * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

export class FastBoss extends BossEnemy {
    constructor() {
        super();
        this.size = 30;
        this.color = palettes[gameState.currentPalette].bossColors[1];
    }

    update(dt) {
        const dx = gameState.center.x - this.x;
        const dy = gameState.center.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.vx += dx / dist * 0.15 * dt;
        this.vy += dy / dist * 0.15 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
}

export class TankBoss extends BossEnemy {
    constructor() {
        super();
        this.size = 60;
        this.life = 10 + gameState.bossLevel * 3;
        this.color = palettes[gameState.currentPalette].bossColors[2];
    }
}

export class OrbiterBoss extends BossEnemy {
    constructor() {
        super(refs.canvas.width / 2 + 200, refs.canvas.height / 2);
        this.size = 35;
        this.life = 12 + gameState.bossLevel * 2;
        this.color = palettes[gameState.currentPalette].bossColors[3];
        this.orbitAngle = 0;
        this.orbitSpeed = 0.015;
        this.orbitDist = 250;
        this.spawnTimer = 0;
        this.maxGeneration = 0;
    }

    update(dt) {
        this.orbitAngle += this.orbitSpeed * dt;
        this.x = gameState.center.x + Math.cos(this.orbitAngle) * this.orbitDist;
        this.y = gameState.center.y + Math.sin(this.orbitAngle) * this.orbitDist;
        this.vx = 0;
        this.vy = 0;
        this.spawnTimer += dt;
        if (this.spawnTimer > 180) {
            this.spawnTimer = 0;
            gameState.enemies.push(new Enemy(enemyTypes.fast));
        }
        if (this.life < 6) this.orbitSpeed = 0.025;
    }

    draw(ctx) {
        super.draw(ctx);
        ctx.strokeStyle = 'rgba(0,255,170,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gameState.center.x, gameState.center.y, this.orbitDist, 0, Math.PI * 2);
        ctx.stroke();
    }
}

export class PulseBoss extends BossEnemy {
    constructor() {
        super();
        this.size = 50;
        this.life = 18 + gameState.bossLevel * 3;
        this.color = palettes[gameState.currentPalette].bossColors[4];
        this.pulseTimer = 0;
        this.pulseFlash = 0;
        this.maxGeneration = 0;
    }

    update(dt) {
        const dx = gameState.center.x - this.x;
        const dy = gameState.center.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist > 200) {
            this.vx += dx / dist * 0.04 * dt;
            this.vy += dy / dist * 0.04 * dt;
        } else {
            this.vx *= Math.pow(0.95, dt);
            this.vy *= Math.pow(0.95, dt);
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.pulseTimer += dt;
        if (this.pulseTimer > 300) {
            this.pulseTimer = 0;
            this.pulseFlash = 1;
            gameState.orbitBalls.forEach(o => {
                const pdx = o.x - this.x;
                const pdy = o.y - this.y;
                const pd = Math.hypot(pdx, pdy) || 1;
                o.angle += (pdx / pd) * 0.5;
            });
            gameState.shakeTime = 0.15;
            for (let i = 0; i < 20; i++) gameState.particles.push(new Particle(this.x, this.y, '#ff8800'));
        }
    }

    draw(ctx) {
        if (this.pulseFlash > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 200 * (1 - this.pulseFlash), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,136,0,${this.pulseFlash})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            this.pulseFlash -= 0.02;
        }
        super.draw(ctx);
    }
}

let enemyInterval = null;

export function spawnEnemy() {
    if (!gameState.gameOver && !gameState.isPaused && gameState.enemies.length < 6 + gameState.wave * 3) {
        if (gameState.spawnCount > 15 && Math.random() < 0.15) {
            const edge = Math.random();
            for (let i = 0; i < 50; i++) {
                let x, y;
                if (edge < 0.25) { x = 0; y = Math.random() * refs.canvas.height; }
                else if (edge < 0.5) { x = refs.canvas.width; y = Math.random() * refs.canvas.height; }
                else if (edge < 0.75) { x = Math.random() * refs.canvas.width; y = 0; }
                else { x = Math.random() * refs.canvas.width; y = refs.canvas.height; }
                gameState.particles.push(new Particle(x, y, '#ff2222'));
            }
            setTimeout(() => {
                gameState.enemies.push(new Enemy(enemyTypes.fast));
            }, 500);
        } else {
            gameState.enemies.push(new Enemy());
        }
    }

    const prestigeSpawnMul = 1 + gameState.prestigeCount * PRESTIGE_SPAWN_BONUS;
    const delay = Math.max(220, 1500 - gameState.wave * 70) * gameState.diffSpawnMul / (gameState.gameSpeed * prestigeSpawnMul);
    enemyInterval = setTimeout(spawnEnemy, delay);
}

export function startEnemySpawn() {
    clearTimeout(enemyInterval);
    spawnEnemy();
}

export function stopEnemySpawn() {
    clearTimeout(enemyInterval);
    enemyInterval = null;
}

export function updateLaserSystem(deltaTime) {
    const lvl = upgrades.find(u => u.name === 'Laser').level;
    if (lvl === 0) return;
    if (gameState.isPaused) return;

    gameState.laserCooldown -= deltaTime;
    if (gameState.laserCooldown > 0) return;

    const delay = gameState.laserFireDelay;
    const dmg = gameState.laserDamage;
    const targetCount = 1 + gameState.multiLevel;
    const targeted = new Set();

    for (let t = 0; t < targetCount; t++) {
        let nearest = null;
        let nd = Infinity;
        for (const e of gameState.enemies) {
            if (targeted.has(e)) continue;
            if (e.phases && !e.visible) continue;
            const d = Math.hypot(e.x - gameState.player.x, e.y - gameState.player.y);
            if (d < nd) { nd = d; nearest = e; }
        }
        if (!nearest) break;
        targeted.add(nearest);
        fireLaserChain(nearest, dmg);
    }
    if (targeted.size > 0) gameState.laserCooldown = delay;
}

export function fireLaserChain(startEnemy, dmg) {
    const targets = [startEnemy];
    const hit = new Set([startEnemy]);

    for (let i = 0; i < gameState.pierceLevel; i++) {
        const last = targets[targets.length - 1];
        let nearest = null;
        let nd = Infinity;
        for (const e of gameState.enemies) {
            if (hit.has(e)) continue;
            if (e.phases && !e.visible) continue;
            const d = Math.hypot(e.x - last.x, e.y - last.y);
            if (d < nd && d < gameState.pierceRange) { nd = d; nearest = e; }
        }
        if (!nearest) break;
        targets.push(nearest);
        hit.add(nearest);
    }

    for (const enemy of targets) fireLaserAt(enemy, dmg);
    for (let i = 1; i < targets.length; i++) {
        gameState.activeLaserBeams.push({
            x1: targets[i-1].x, y1: targets[i-1].y,
            x2: targets[i].x, y2: targets[i].y,
            alpha: 0.7
        });
    }
}

export function fireLaserAt(enemy, dmg) {
    if (enemy.takeDamage) enemy.takeDamage(dmg);
    else enemy.life -= dmg;
    gameState.activeLaserBeams.push({
        x1: gameState.player.x, y1: gameState.player.y,
        x2: enemy.x, y2: enemy.y,
        alpha: 1
    });
    for (let i = 0; i < 12; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, '#ff00ff'));
}

export function drawLaserBeams(ctx, dt) {
    for (const beam of gameState.activeLaserBeams) {
        ctx.strokeStyle = `rgba(255,0,255,${beam.alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(beam.x1, beam.y1);
        ctx.lineTo(beam.x2, beam.y2);
        ctx.stroke();
        beam.alpha -= 0.08 * dt;
    }
    gameState.activeLaserBeams = gameState.activeLaserBeams.filter(b => b.alpha > 0);
}

export function drawShield(ctx, dt) {
    if (gameState.shieldLevel === 0) return;
    gameState.shieldPulseTime += 0.05 * dt;
    const pulse = Math.sin(gameState.shieldPulseTime) * 6;
    const r = gameState.shieldRadius + pulse;
    const alpha = gameState.shieldBounceTimer > 0 ? 0.3 : 0.8;
    ctx.beginPath();
    ctx.arc(gameState.center.x, gameState.center.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,0,255,${alpha})`;
    ctx.lineWidth = 3 + Math.sin(gameState.shieldPulseTime) * 1.5;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff00ff';
    ctx.stroke();
    ctx.shadowBlur = 0;
}

export function drawCryoField(ctx) {
    if (gameState.cryoLevel === 0) return;
    ctx.beginPath();
    ctx.arc(gameState.center.x, gameState.center.y, gameState.cryoRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,180,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,180,255,0.04)';
    ctx.fill();
}

export function applyGravityWell(dt) {
    if (gameState.gravityLevel === 0) return;
    const pull = 0.002 * (gameState.gravityLevel + gameState.vortexLevel * 0.9) * dt;
    const enemies = gameState.enemies;
    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const a = enemies[i];
            const b = enemies[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 250 && dist > 1) {
                const fx = dx / dist * pull;
                const fy = dy / dist * pull;
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            }
        }
    }
}

export function updateNova(delta) {
    if (gameState.novaLevel === 0) return;
    gameState.novaCooldown -= delta;
    if (gameState.novaCooldown > 0) return;
    gameState.novaCooldown = gameState.novaMaxCooldown;
    let hits = 0;
    for (const e of gameState.enemies) {
        const d = Math.hypot(e.x - gameState.center.x, e.y - gameState.center.y);
        if (d < gameState.novaRadius) {
            e.life -= gameState.novaDamage;
            hits++;
            for (let i = 0; i < 5; i++) gameState.particles.push(new Particle(e.x, e.y, '#ff8800'));
        }
    }
    if (gameState.bloodNovaLevel > 0 && hits > 0) {
        const healEvery = Math.max(2, 5 - gameState.bloodNovaLevel);
        const heal = Math.floor(hits / healEvery);
        if (heal > 0) {
            gameState.playerHP = Math.min(gameState.maxHP, gameState.playerHP + heal);
        }
    }
    gameState.novaFlash = 1;
    gameState.shakeTime = 0.15;
    for (let i = 0; i < 30; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#ffaa00'));
}

export function drawNovaFlash(ctx, dt) {
    if (gameState.novaFlash <= 0) return;
    ctx.beginPath();
    ctx.arc(gameState.center.x, gameState.center.y, gameState.novaRadius * (1 - gameState.novaFlash * 0.3), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,150,0,${gameState.novaFlash})`;
    ctx.lineWidth = 4;
    ctx.stroke();
    gameState.novaFlash -= 0.025 * dt;
}

export function updateRegen(delta) {
    if (gameState.regenLevel === 0) return;
    if (gameState.playerHP >= gameState.maxHP) return;
    gameState.regenTimer -= delta;
    if (gameState.regenTimer > 0) return;
    gameState.playerHP++;
    gameState.regenTimer = gameState.regenInterval;
    for (let i = 0; i < 12; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#00ff88'));
}

export function updatePulseArmor(delta) {
    if (gameState.pulseArmorLevel === 0) return;
    gameState.pulseArmorTimer -= delta;
    if (gameState.pulseArmorTimer > 0) return;
    gameState.pulseArmorTimer = gameState.pulseArmorInterval;
    const r = gameState.pulseArmorRadius;
    for (const e of gameState.enemies) {
        const dx = e.x - gameState.center.x;
        const dy = e.y - gameState.center.y;
        const d = Math.hypot(dx, dy);
        if (d <= r + e.size) {
            const nx = dx / (d || 1);
            const ny = dy / (d || 1);
            e.vx += nx * (2 + gameState.pulseArmorLevel * 0.5);
            e.vy += ny * (2 + gameState.pulseArmorLevel * 0.5);
            if (e.takeDamage) e.takeDamage(gameState.pulseArmorDamage);
            else e.life -= gameState.pulseArmorDamage;
        }
    }
    for (let i = 0; i < 20; i++) {
        const a = (Math.PI * 2 / 20) * i;
        gameState.particles.push(new Particle(
            gameState.center.x + Math.cos(a) * r,
            gameState.center.y + Math.sin(a) * r,
            '#66eeff'
        ));
    }
}

export function spawnRiftMine() {
    gameState.mines.push({
        x: gameState.player.x,
        y: gameState.player.y,
        life: 5000 + gameState.riftMineLevel * 1200,
        radius: gameState.mineRadius,
        damage: gameState.mineDamage
    });
}

export function explodeMine(m) {
    for (const e of gameState.enemies) {
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d <= m.radius + e.size) {
            if (e.takeDamage) e.takeDamage(m.damage);
            else e.life -= m.damage;
            const nx = (e.x - m.x) / (d || 1);
            const ny = (e.y - m.y) / (d || 1);
            e.vx += nx * 2.8;
            e.vy += ny * 2.8;
        }
    }
    for (let i = 0; i < 16; i++) gameState.particles.push(new Particle(m.x, m.y, '#aa66ff'));
}

export function updateRiftMines(delta) {
    if (gameState.riftMineLevel > 0) {
        gameState.mineSpawnTimer -= delta;
        if (gameState.mineSpawnTimer <= 0) {
            gameState.mineSpawnTimer = gameState.mineSpawnInterval;
            spawnRiftMine();
        }
    }
    const survivors = [];
    for (const m of gameState.mines) {
        m.life -= delta;
        let detonated = m.life <= 0;
        if (!detonated) {
            for (const e of gameState.enemies) {
                if (Math.hypot(e.x - m.x, e.y - m.y) < m.radius * 0.45 + e.size) {
                    detonated = true;
                    break;
                }
            }
        }
        if (detonated) explodeMine(m);
        else survivors.push(m);
    }
    gameState.mines = survivors;
}

export function drawRiftMines(ctx) {
    for (const m of gameState.mines) {
        const alpha = Math.max(0.25, Math.min(1, m.life / 3500));
        ctx.beginPath();
        ctx.arc(m.x, m.y, 8 + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(170,90,255,${alpha})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius * 0.45, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,120,255,${0.15 + alpha * 0.2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

export function triggerFreezeShatter(x, y) {
    if (gameState.freezeShatterLevel === 0) return;
    const radius = 70 + gameState.freezeShatterLevel * 30;
    const damage = 0.6 + gameState.freezeShatterLevel * 0.4;
    for (const e of gameState.enemies) {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d <= radius + e.size) {
            if (e.takeDamage) e.takeDamage(damage);
            else e.life -= damage;
        }
    }
    for (let i = 0; i < 14; i++) gameState.particles.push(new Particle(x, y, '#66ddff'));
}

export function updateOrbitEchoes(delta) {
    if (gameState.orbitEchoLevel > 0) {
        gameState.orbitEchoSpawnTimer -= delta;
        if (gameState.orbitEchoSpawnTimer <= 0) {
            gameState.orbitEchoSpawnTimer = Math.max(70, 220 - gameState.orbitEchoLevel * 40);
            gameState.orbitBalls.forEach(o => {
                gameState.orbitEchoes.push({
                    x: o.x,
                    y: o.y,
                    life: 600,
                    radius: 16 + gameState.orbitEchoLevel * 2,
                    damage: 0.15 + gameState.orbitEchoLevel * 0.12,
                    hitCooldown: 0
                });
            });
        }
    }
    gameState.orbitEchoes.forEach(echo => {
        echo.life -= delta;
        echo.hitCooldown -= delta;
        if (echo.hitCooldown <= 0) {
            for (const e of gameState.enemies) {
                const d = Math.hypot(e.x - echo.x, e.y - echo.y);
                if (d <= echo.radius + e.size) {
                    if (e.takeDamage) e.takeDamage(echo.damage);
                    else e.life -= echo.damage;
                    echo.hitCooldown = 120;
                    break;
                }
            }
        }
    });
    gameState.orbitEchoes = gameState.orbitEchoes.filter(e => e.life > 0);
}

export function drawOrbitEchoes(ctx) {
    gameState.orbitEchoes.forEach(echo => {
        const alpha = Math.max(0, echo.life / 600) * 0.5;
        ctx.beginPath();
        ctx.arc(echo.x, echo.y, echo.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,255,255,${alpha})`;
        ctx.fill();
    });
}

export function updatePhaseShield(delta) {
    if (gameState.phaseShieldLevel === 0) return;
    if (!gameState.phaseShieldReady) {
        gameState.phaseShieldCooldownTimer -= delta;
        if (gameState.phaseShieldCooldownTimer <= 0) {
            gameState.phaseShieldReady = true;
        }
    }
    if (gameState.centerInvulnTimer > 0) gameState.centerInvulnTimer -= delta;
}

export function drawPhaseShieldVisual(ctx) {
    if (gameState.centerInvulnTimer <= 0) return;
    const alpha = Math.min(0.8, gameState.centerInvulnTimer / 1200);
    ctx.beginPath();
    ctx.arc(gameState.center.x, gameState.center.y, 42, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(120,255,255,${alpha})`;
    ctx.lineWidth = 4;
    ctx.stroke();
}

export function updateShieldCollision(e) {
    if (gameState.shieldLevel === 0) return;
    if (gameState.shieldBounceTimer > 0) return;
    const dx = e.x - gameState.center.x;
    const dy = e.y - gameState.center.y;
    const dist = Math.hypot(dx, dy);
    if (dist < gameState.shieldRadius + e.size) {
        const nx = dx / dist;
        const ny = dy / dist;
        e.vx += nx * gameState.shieldBounce;
        e.vy += ny * gameState.shieldBounce;
        if (e.takeDamage) e.takeDamage(gameState.shieldDamage);
        else e.life -= gameState.shieldDamage;
        gameState.points++;
        playCollisionTone(Math.hypot(e.vx, e.vy));
        gameState.shieldBounceTimer = gameState.shieldBounceCooldown;
        for (let i = 0; i < 6; i++) gameState.particles.push(new Particle(e.x, e.y, '#ff00ff'));
    }
}

export function checkCollisions() {
    for (const e of gameState.enemies) {
        const allBalls = [gameState.player, ...gameState.orbitBalls];
        if (gameState.player2) allBalls.push(gameState.player2);

        for (const b of allBalls) {
            const dx = e.x - b.x;
            const dy = e.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < e.size + b.size) {
                if (e.phases && !e.visible) continue;
                gameState.shakeTime = 0.1;
                const nx = dx / dist;
                const ny = dy / dist;
                e.vx += nx * 3;
                e.vy += ny * 3;
                playCollisionTone(Math.hypot(e.vx, e.vy));
                const orbDmg = b.damage || 1;
                const hit = e.takeDamage ? e.takeDamage(orbDmg) : (e.life -= orbDmg, true);
                if (hit) {
                    gameState.points += (e.pts || 1);
                    gameState.killStreak++;
                    if (gameState.killStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.killStreak;
                }
                for (let i = 0; i < 10; i++) gameState.particles.push(new Particle(e.x, e.y, e.color));
            }
        }

        for (let i = 0; i < gameState.enemies.length; i++) {
            for (let j = i + 1; j < gameState.enemies.length; j++) {
                const a = gameState.enemies[i];
                const b = gameState.enemies[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist < a.size + b.size) {
                    if (a.isBoss || b.isBoss) continue;
                    playCollisionTone(Math.hypot(a.vx + b.vx, a.vy + b.vy) * 0.5);
                    for (let k = 0; k < 20; k++) gameState.particles.push(new Particle(a.x, a.y, '#ff4444'));
                    gameState.enemies.splice(j, 1);
                    gameState.enemies.splice(i, 1);
                    gameState.points++;
                    gameState.enemiesKilledThisWave++;
                    gameState.killStreak++;
                    if (gameState.killStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.killStreak;
                    i--;
                    break;
                }
            }
        }

        if (Math.hypot(e.x - gameState.center.x, e.y - gameState.center.y) < 20) {
            if (gameState.centerInvulnTimer > 0) {
                e.life = 0;
                continue;
            }
            if (gameState.phaseShieldLevel > 0 && gameState.phaseShieldReady && gameState.playerHP <= 1) {
                gameState.phaseShieldReady = false;
                gameState.centerInvulnTimer = 900 + gameState.phaseShieldLevel * 250;
                gameState.phaseShieldCooldownTimer = Math.max(9000, 24000 - gameState.phaseShieldLevel * 4500);
                gameState.playerHP = 1;
                e.life = 0;
                for (let i = 0; i < 24; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#77ffff'));
                continue;
            }
            gameState.playerHP--;
            gameState.shakeTime = 0.25;
            gameState.killStreak = 0;
            const overlay = document.getElementById('damageOverlay');
            if (overlay) {
                overlay.style.opacity = '1';
                setTimeout(() => overlay.style.opacity = '0', 200);
            }
            e.life = 0;
            for (let i = 0; i < 20; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#ff0000'));
            if (gameState.playerHP <= 0) {
                gameState.gameOver = true;
                gameState.isPaused = true;
                gameState.savedPoints = gameState.points;
                gameState.restartAfterMenu = true;
                refs.orb.style.animation = 'orbDeathPulse 0.3s infinite alternate';
                setTimeout(() => {
                    refs.orb.style.animation = '';
                    refs.glass.style.display = 'flex';
                    refs.glass.classList.add('open');
                }, 1200);
            }
        }
    }
}

export function cleanupEnemies() {
    const newEnemies = [];
    for (const e of gameState.enemies) {
        if (e.life > 0) { newEnemies.push(e); continue; }
        const diedInCryoZone = gameState.cryoLevel > 0 && Math.hypot(e.x - gameState.center.x, e.y - gameState.center.y) < gameState.cryoRadius;
        if (e.isBoss && e.generation !== undefined && e.generation < e.maxGeneration) {
            const splitCount = 2 + e.generation;
            for (let i = 0; i < splitCount; i++) {
                const angle = (Math.PI * 2 / splitCount) * i;
                const child = new BossEnemy(e.x + Math.cos(angle) * 10, e.y + Math.sin(angle) * 10, e.size * 0.6, e.generation + 1);
                child.vx = Math.cos(angle) * 3;
                child.vy = Math.sin(angle) * 3;
                newEnemies.push(child);
            }
            for (let i = 0; i < 20; i++) gameState.particles.push(new Particle(e.x, e.y, '#ff00ff'));
            gameState.enemiesKilledThisWave++;
            continue;
        }
        if (e.splits) {
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                const child = new Enemy(enemyTypes.fast);
                child.x = e.x + Math.cos(angle) * 10;
                child.y = e.y + Math.sin(angle) * 10;
                child.vx = Math.cos(angle) * 2;
                child.vy = Math.sin(angle) * 2;
                child.size = 6;
                child.life = 1;
                child.splits = false;
                newEnemies.push(child);
            }
            for (let i = 0; i < 10; i++) gameState.particles.push(new Particle(e.x, e.y, '#ff4488'));
        }
        if (e.explodes) {
            for (let i = 0; i < 3; i++) {
                const angle = (Math.PI * 2 / 3) * i;
                const child = new Enemy(enemyTypes.wisp);
                child.x = e.x + Math.cos(angle) * 8;
                child.y = e.y + Math.sin(angle) * 8;
                child.vx = Math.cos(angle) * 2.2;
                child.vy = Math.sin(angle) * 2.2;
                newEnemies.push(child);
            }
            for (let i = 0; i < 12; i++) gameState.particles.push(new Particle(e.x, e.y, '#ffaa33'));
        }
        if (!e.isBoss) {
            gameState.enemiesKilledThisWave++;
            gameState.killStreak++;
            if (gameState.killStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.killStreak;
        }
    }
    gameState.enemies = newEnemies;
}

export function rebuildFromUpgrades() {
    gameState.orbitBalls = [];
    gameState.player = new PlayerBall();

    const orbitLevel = prestigeUpgrades.find(u => u.name === 'Orbit').level;
    const radiusLevel = prestigeUpgrades.find(u => u.name === 'Radius').level;
    const speedLevel = prestigeUpgrades.find(u => u.name === 'Speed').level;
    const orbitControlLevel = prestigeUpgrades.find(u => u.name === 'OrbitControl').level;
    const extraOrbitLevel = prestigeUpgrades.find(u => u.name === 'ExtraOrbit').level;
    const dualLevel = upgrades.find(u => u.name === 'Dual').level;
    const dUp = upgrades.find(u => u.name === 'Damage').level;
    gameState.points = gameState.points;

    const totalBalls = 1 + orbitLevel + extraOrbitLevel;
    for (let i = 0; i < totalBalls; i++) {
        const o = new OrbitBall(Math.random() * Math.PI * 2);
        o.angularSpeed += speedLevel * 0.015;
        o.damage = 0.25 + dUp * 0.25 + speedLevel * 0.125;
        gameState.orbitBalls.push(o);
    }

    gameState.player.orbitRadius = 150 + radiusLevel * 25;
    gameState.player2 = dualLevel > 0 ? new PlayerBall() : null;
    gameState.orbitControlActive = orbitControlLevel > 0;
    gameState.extraOrbitCount = extraOrbitLevel;

    const laserLevel = upgrades.find(u => u.name === 'Laser').level;
    gameState.laserDamage = 0.25 + laserLevel * 0.25;
    gameState.laserFireDelay = Math.max(2000, 5000 - laserLevel * 400);

    const shieldUp = upgrades.find(u => u.name === 'Shield').level;
    gameState.shieldLevel = shieldUp;
    gameState.shieldRadius = 60;
    gameState.shieldBounce = 4 + shieldUp * 1.5;
    gameState.shieldDamage = shieldUp * 0.5;
    gameState.shieldBounceCooldown = shieldUp > 0 ? (16 - shieldUp) * 1000 : 20000;
    gameState.shieldBounceTimer = 0;

    const magnetUp = upgrades.find(u => u.name === 'Magnet').level;
    gameState.magnetLevel = magnetUp;
    gameState.magnetStrength = 0.04 + magnetUp * 0.02;

    const pUp = upgrades.find(u => u.name === 'Pierce').level;
    gameState.pierceLevel = pUp;

    const cUp = upgrades.find(u => u.name === 'Cryo').level;
    gameState.cryoLevel = cUp;
    gameState.cryoRadius = cUp > 0 ? 60 + cUp * 60 : 0;
    gameState.cryoSlow = cUp > 0 ? 0.99 - cUp * 0.005 : 1;

    gameState.gravityLevel = upgrades.find(u => u.name === 'Gravity').level;
    gameState.multiLevel = upgrades.find(u => u.name === 'Multi').level;

    const nUp = upgrades.find(u => u.name === 'Nova').level;
    gameState.novaLevel = nUp;
    gameState.novaMaxCooldown = nUp > 0 ? Math.max(3000, 8000 - nUp * 1500) : 8000;
    gameState.novaRadius = 150 + nUp * 40;
    gameState.novaDamage = 1 + nUp * 0.5;
    gameState.novaCooldown = 0;

    const rUp = upgrades.find(u => u.name === 'Regen').level;
    gameState.regenLevel = rUp;
    gameState.regenInterval = rUp > 0 ? Math.max(6000, 15000 - rUp * 3000) : 15000;
    gameState.regenTimer = 0;

    const oUp = upgrades.find(u => u.name === 'Overcharge').level;
    gameState.overchargeLevel = oUp;
    gameState.laserDamage += oUp * 0.3;
    gameState.laserFireDelay = Math.max(1200, gameState.laserFireDelay - oUp * 220);

    const fUp = upgrades.find(u => u.name === 'Fortress').level;
    gameState.fortressLevel = fUp;
    gameState.maxHP = difficultyPresets[gameState.difficultyMode].hp + fUp;
    gameState.playerHP = Math.min(gameState.playerHP || gameState.maxHP, gameState.maxHP);

    gameState.vortexLevel = upgrades.find(u => u.name === 'Vortex').level;
    gameState.chainLevel = upgrades.find(u => u.name === 'Chain').level;
    gameState.pierceRange = 200 + gameState.chainLevel * 70;

    gameState.hyperLevel = upgrades.find(u => u.name === 'Hyper').level;
    gameState.orbitDamageBoost = gameState.hyperLevel * 0.2;
    gameState.orbitBalls.forEach(o => {
        o.damage += gameState.orbitDamageBoost;
        o.angularSpeed += gameState.hyperLevel * 0.006;
    });

    const sUp = upgrades.find(u => u.name === 'Starfire').level;
    gameState.starfireLevel = sUp;
    gameState.novaRadius += sUp * 25;
    gameState.novaDamage += sUp * 0.7;

    const paUp = upgrades.find(u => u.name === 'PulseArmor').level;
    gameState.pulseArmorLevel = paUp;
    gameState.pulseArmorInterval = Math.max(2200, 7000 - paUp * 900);
    gameState.pulseArmorRadius = 90 + paUp * 25;
    gameState.pulseArmorDamage = paUp * 0.55;
    gameState.pulseArmorTimer = gameState.pulseArmorInterval;

    const rmUp = upgrades.find(u => u.name === 'RiftMine').level;
    gameState.riftMineLevel = rmUp;
    gameState.mineSpawnInterval = Math.max(2600, 9000 - rmUp * 1100);
    gameState.mineRadius = 70 + rmUp * 18;
    gameState.mineDamage = 0.8 + rmUp * 0.65;
    gameState.mineSpawnTimer = gameState.mineSpawnInterval;

    gameState.bloodNovaLevel = upgrades.find(u => u.name === 'BloodNova').level;
    gameState.freezeShatterLevel = upgrades.find(u => u.name === 'FreezeShatter').level;
    gameState.orbitEchoLevel = upgrades.find(u => u.name === 'OrbitEcho').level;
    gameState.orbitEchoSpawnTimer = Math.max(70, 220 - gameState.orbitEchoLevel * 40);

    gameState.phaseShieldLevel = upgrades.find(u => u.name === 'PhaseShield').level;
    gameState.phaseShieldReady = gameState.phaseShieldLevel > 0;
    gameState.phaseShieldCooldownTimer = 0;
    gameState.centerInvulnTimer = 0;

    const lfUp = upgrades.find(u => u.name === 'LifeForce');
    gameState.lifeForceLevel = lfUp ? lfUp.level : 0;

    gameState.mines = [];
    gameState.orbitEchoes = [];
}
