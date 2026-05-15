import { gameState, refs } from './state.js';
import { difficultyPresets, enemyTypes, palettes, upgrades, prestigeUpgrades, PRESTIGE_ENEMY_STAT_BONUS, PRESTIGE_SPAWN_BONUS, ENEMY_MAX_SPEED } from './config.js';
import { PlayerBall, OrbitBall, Enemy, BossEnemy, startEnemySpawn, stopEnemySpawn, updateLaserSystem, drawLaserBeams, rebuildFromUpgrades, applyGravityWell } from './entities.js';
import { Particle, updateParticles, drawParticles, spawnUpgradeParticles } from './particles.js';
import { initAudio, ensureAudio, playCollisionTone } from './audio.js';
import { isUpgradeAvailable, canBuyUpgrade, canBuyPrestigeUpgrade, getUpgradeCost, applyUpgrade, applyPrestigeUpgrade, updateBars, updatePrestigeBars, updatePrestigeResetButton, doPrestigeReset, updateHPDisplay, updateWaveProgress } from './upgrades.js';
import { hexToRgb } from './utils.js';

let lastFrameTime = 0;
let lineCanvas = null;
let prestigeLineCanvas = null;
let upgradeStarContainer = null;
let damageOverlay = null;

function setCanvasSize() {
    refs.canvas.width = innerWidth;
    refs.canvas.height = innerHeight;
    gameState.center = { x: refs.canvas.width / 2, y: refs.canvas.height / 2 };
    drawConnectionLines();
    drawPrestigeConnectionLines();
}

function screenShake(dt) {
    if (gameState.shakeTime > 0) {
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        refs.ctx.translate(dx, dy);
        gameState.shakeTime -= dt / 60;
        if (gameState.shakeTime < 0) gameState.shakeTime = 0;
    }
}

function updateTreeTransform() {
    refs.content.style.transform = `translate(${gameState.offsetX}px, ${gameState.offsetY}px) scale(${gameState.scale})`;
    drawConnectionLines();
}

function initRefs() {
    refs.canvas = document.getElementById('gameCanvas');
    refs.ctx = refs.canvas.getContext('2d');
    refs.infoDiv = document.getElementById('info');
    refs.glass = document.getElementById('upgradeGlass');
    refs.orb = document.getElementById('upgradeOrb');
    refs.closeGlass = document.getElementById('closeGlass');
    refs.prestigeGlass = document.getElementById('prestigeGlass');
    refs.prestigeOrbEl = document.getElementById('prestigeOrb');
    refs.prestigeResetBtn = document.getElementById('prestigeResetBtn');
    refs.speedBtn = document.getElementById('speedBtn');
    refs.paletteBtn = document.getElementById('paletteBtn');
    refs.pOrbit = document.getElementById('pOrbit');
    refs.pSpeed = document.getElementById('pSpeed');
    refs.pRadius = document.getElementById('pRadius');
    refs.zoomLevelEl = document.getElementById('zoomLevel');
    refs.difficultyMenu = document.getElementById('difficultyMenu');
    refs.difficultyButtons = [...document.querySelectorAll('.diffBtn')];
    refs.customCols = document.getElementById('customCols');
    refs.customRows = document.getElementById('customRows');
    refs.upgradeNodes = [...document.querySelectorAll('.upgradeNode')];
    refs.prestigeNodes = [...document.querySelectorAll('.prestigeNode')];
    refs.waveProgress = document.getElementById('waveProgress');
    lineCanvas = document.getElementById('lineCanvas');
    prestigeLineCanvas = document.getElementById('prestigeLineCanvas');
    upgradeStarContainer = document.getElementById('upgradeStarContainer');
    damageOverlay = document.getElementById('damageOverlay');
    refs.viewport = document.getElementById('treeViewport');
    refs.content = document.getElementById('treeContent');

    refs.upgradeNodes.forEach(node => {
        node.dataset.name = node.querySelector('.uName').textContent.trim();
    });
    refs.prestigeNodes.forEach(node => {
        node.dataset.name = node.querySelector('.uName').textContent.trim();
    });
}

function bindUI() {
    document.getElementById('backBtn').onclick = () => {
        window.location.href = 'index.html';
    };

    refs.viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.upgradeNode')) return;
        gameState.isDraggingTree = true;
        gameState.dragMoved = false;
        gameState.lastX = e.clientX;
        gameState.lastY = e.clientY;
    });

    refs.difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            refs.difficultyMenu.style.display = 'none';
            startGame(mode);
        });
    });

    window.addEventListener('mousemove', (e) => {
        if (!gameState.isDraggingTree) return;
        const dx = e.clientX - gameState.lastX;
        const dy = e.clientY - gameState.lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) gameState.dragMoved = true;
        gameState.offsetX += dx;
        gameState.offsetY += dy;
        gameState.lastX = e.clientX;
        gameState.lastY = e.clientY;
        updateTreeTransform();
    });

    window.addEventListener('mouseup', () => {
        gameState.isDraggingTree = false;
    });

    refs.viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        gameState.scale += e.deltaY < 0 ? zoomSpeed : -zoomSpeed;
        gameState.scale = Math.max(0.5, Math.min(2, gameState.scale));
        updateTreeTransform();
    }, { passive: false });

    refs.upgradeNodes.forEach(node => {
        node.addEventListener('click', () => {
            applyUpgrade(node.dataset.name);
            drawConnectionLines();
            updateBars();
        });
    });

    refs.prestigeNodes.forEach(node => {
        node.addEventListener('click', () => {
            applyPrestigeUpgrade(node.dataset.name);
            drawPrestigeConnectionLines();
            updatePrestigeBars();
        });
    });

    refs.orb.onclick = openUpgradeMenu;
    refs.closeGlass.onclick = closeUpgradeMenu;
    refs.prestigeOrbEl.onclick = openPrestigeMenu;
    document.getElementById('closePrestige').onclick = closePrestigeMenu;
    refs.prestigeResetBtn.onclick = doPrestigeReset;

    refs.speedBtn.onclick = () => {
        if (gameState.gameSpeed === 1) gameState.gameSpeed = 2;
        else if (gameState.gameSpeed === 2) gameState.gameSpeed = 3;
        else gameState.gameSpeed = 1;
        refs.speedBtn.textContent = `${gameState.gameSpeed}x`;
        startEnemySpawn();
    };

    refs.paletteBtn.onclick = () => {
        const nextIndex = (gameState.unlockedPalettes.indexOf(gameState.currentPalette) + 1) % gameState.unlockedPalettes.length;
        gameState.currentPalette = gameState.unlockedPalettes[nextIndex];
        const palette = palettes[gameState.currentPalette];
        refs.paletteBtn.textContent = palette.name[0];
    };

    refs.canvas.addEventListener('mousemove', (e) => {
        gameState.mouse.x = e.clientX;
        gameState.mouse.y = e.clientY;
    });

    refs.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        gameState.touchActive = true;
        const t = e.touches[0];
        gameState.mouse.x = t.clientX;
        gameState.mouse.y = t.clientY;
    }, { passive: false });

    refs.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!gameState.touchActive) return;
        const t = e.touches[0];
        gameState.mouse.x = t.clientX;
        gameState.mouse.y = t.clientY;
    }, { passive: false });

    refs.canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0) gameState.touchActive = false;
    }, { passive: false });

    window.addEventListener('resize', setCanvasSize);
    window.addEventListener('click', ensureAudio);
    window.addEventListener('touchstart', ensureAudio, { once: false });
}

function openUpgradeMenu() {
    gameState.isPaused = true;
    refs.glass.style.display = 'flex';
    requestAnimationFrame(drawConnectionLines);
    updateBars();
    requestAnimationFrame(() => refs.glass.classList.add('open'));
}

function closeUpgradeMenu() {
    refs.glass.classList.remove('open');
    setTimeout(() => {
        refs.glass.style.display = 'none';
        if (gameState.restartAfterMenu) {
            gameState.restartAfterMenu = false;
            restartAfterDeath();
        } else {
            gameState.isPaused = false;
            ensureAudio();
        }
    }, 300);
}

function openPrestigeMenu() {
    gameState.isPaused = true;
    refs.prestigeGlass.style.display = 'flex';
    requestAnimationFrame(() => {
        refs.prestigeGlass.classList.add('open');
        drawPrestigeConnectionLines();
    });
    updatePrestigeBars();
    updatePrestigeResetButton();
}

function closePrestigeMenu() {
    refs.prestigeGlass.classList.remove('open');
    setTimeout(() => {
        refs.prestigeGlass.style.display = 'none';
        gameState.isPaused = false;
    }, 300);
}

function drawConnectionLines() {
    if (!lineCanvas || !upgradeStarContainer) return;
    lineCanvas.width = Math.max(1, Math.floor(upgradeStarContainer.clientWidth));
    lineCanvas.height = Math.max(1, Math.floor(upgradeStarContainer.clientHeight));
    const lctx = lineCanvas.getContext('2d');
    lctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

    const starRect = upgradeStarContainer.getBoundingClientRect();
    const scale = Math.max(gameState.scale, 0.0001);

    function centerOf(node) {
        const r = node.getBoundingClientRect();
        return {
            x: (r.left - starRect.left + r.width / 2) / scale,
            y: (r.top - starRect.top + r.height / 2) / scale
        };
    }

    const pairs = [
        ['Damage', 'Laser'], ['Damage', 'Shield'], ['Damage', 'Magnet'],
        ['Laser', 'Pierce'], ['Laser', 'Dual'], ['Magnet', 'Gravity'],
        ['Pierce', 'Multi'], ['Dual', 'Multi'], ['Laser', 'Nova'], ['Shield', 'Nova'],
        ['Shield', 'Cryo'], ['Cryo', 'Regen'], ['Nova', 'Regen'], ['Laser', 'Overcharge'],
        ['Shield', 'Fortress'], ['Gravity', 'Vortex'], ['Pierce', 'Chain'], ['Dual', 'Hyper'],
        ['Nova', 'Starfire'], ['Vortex', 'Starfire'], ['Chain', 'Starfire'], ['Fortress', 'PulseArmor'],
        ['Vortex', 'RiftMine'], ['Hyper', 'RiftMine'], ['Starfire', 'BloodNova'], ['Regen', 'BloodNova'],
        ['Cryo', 'FreezeShatter'], ['Vortex', 'FreezeShatter'], ['Hyper', 'OrbitEcho'], ['Overcharge', 'OrbitEcho'],
        ['Fortress', 'PhaseShield'], ['Regen', 'PhaseShield']
    ];

    pairs.forEach(([aName, bName]) => {
        const A = refs.upgradeNodes.find(n => n.dataset.name === aName);
        const B = refs.upgradeNodes.find(n => n.dataset.name === bName);
        if (!A || !B || A.style.display === 'none' || B.style.display === 'none') return;
        const a = centerOf(A);
        const b = centerOf(B);
        const unlocked = upgrades.find(u => u.name === aName)?.level > 0 && upgrades.find(u => u.name === bName)?.level > 0;
        lctx.strokeStyle = unlocked ? '#ff00ff' : '#553355';
        lctx.lineWidth = 4;
        lctx.beginPath();
        lctx.moveTo(a.x, a.y);
        lctx.lineTo(b.x, b.y);
        lctx.stroke();
    });
}

function drawPrestigeConnectionLines() {
    if (!prestigeLineCanvas) return;
    const container = document.getElementById('prestigeTreeContainer');
    prestigeLineCanvas.width = Math.max(1, Math.floor(container.clientWidth));
    prestigeLineCanvas.height = Math.max(1, Math.floor(container.clientHeight));
    const lctx = prestigeLineCanvas.getContext('2d');
    lctx.clearRect(0, 0, prestigeLineCanvas.width, prestigeLineCanvas.height);

    const containerRect = container.getBoundingClientRect();
    function centerOf(node) {
        const r = node.getBoundingClientRect();
        return { x: r.left - containerRect.left + r.width / 2, y: r.top - containerRect.top + r.height / 2 };
    }

    const pairs = [[refs.pOrbit, refs.pSpeed], [refs.pOrbit, refs.pRadius]];
    pairs.forEach(([A, B]) => {
        if (!A || !B) return;
        const a = centerOf(A);
        const b = centerOf(B);
        const unlocked = prestigeUpgrades.find(u => u.name === A.querySelector('.uName').textContent)?.level > 0 && prestigeUpgrades.find(u => u.name === B.querySelector('.uName').textContent)?.level > 0;
        lctx.strokeStyle = unlocked ? '#00ffff' : '#224455';
        lctx.lineWidth = 4;
        lctx.beginPath();
        lctx.moveTo(a.x, a.y);
        lctx.lineTo(b.x, b.y);
        lctx.stroke();
    });
}

function checkPaletteUnlocks() {
    palettes.forEach((palette, index) => {
        if (!gameState.unlockedPalettes.includes(index) && gameState.wave >= palette.unlockWave) {
            gameState.unlockedPalettes.push(index);
        }
    });
}

export function startGame(mode = null) {
    if (mode) {
        gameState.difficultyMode = mode;
        const preset = difficultyPresets[mode] || difficultyPresets.normal;
        gameState.diffSpawnMul = preset.spawnMul;
        gameState.diffSpeedMul = preset.speedMul;
        gameState.maxHP = preset.hp;
    }
    setCanvasSize();
    gameState.spawnCount = 0;
    gameState.points = 0;
    gameState.gameOver = false;
    gameState.wave = 1;
    gameState.bossLevel = 0;
    gameState.enemiesToNextBoss = 30;
    gameState.difficultyRamp = 0;
    gameState.inBossFight = false;
    gameState.enemiesKilledThisWave = 0;
    gameState.waveTransitionTimer = 0;
    gameState.killStreak = 0;
    gameState.maxKillStreak = 0;
    gameState.backgroundEvolution = 0;
    gameState.transitionState = 'playing';
    gameState.bossIntroTimer = 0;
    gameState.lastKillStreakMilestone = 0;
    gameState.unlockedPalettes = [0];
    gameState.enemies = [];
    gameState.particles = [];
    rebuildFromUpgrades();
    gameState.playerHP = gameState.maxHP;
    refs.infoDiv.textContent = `Wave 1 | Points: 0 | Prestige ${gameState.prestigeCount}`;
    updateHPDisplay();
    refs.paletteBtn.textContent = palettes[gameState.currentPalette].name[0];
    gameState.isPaused = false;
    lastFrameTime = 0;
    startEnemySpawn();
    animate();
}

function restartAfterDeath() {
    gameState.gameOver = false;
    gameState.isPaused = false;
    gameState.enemies = [];
    gameState.particles = [];
    gameState.player = new PlayerBall();
    gameState.orbitBalls = [new OrbitBall(0)];
    gameState.spawnCount = 0;
    gameState.wave = 1;
    gameState.bossLevel = 0;
    gameState.enemiesToNextBoss = 30;
    gameState.difficultyRamp = 0;
    gameState.inBossFight = false;
    gameState.points = Math.floor(gameState.savedPoints * 0.7) + 5;
    refs.infoDiv.textContent = `Wave 1 | Points: ${gameState.points}`;
    gameState.lastFrameTime = 0;
    gameState.laserCooldown = 0;
    gameState.novaCooldown = 0;
    gameState.novaFlash = 0;
    gameState.regenTimer = 0;
    gameState.pulseArmorTimer = gameState.pulseArmorInterval;
    gameState.mineSpawnTimer = gameState.mineSpawnInterval;
    gameState.mines = [];
    gameState.orbitEchoes = [];
    gameState.centerInvulnTimer = 0;
    gameState.phaseShieldReady = gameState.phaseShieldLevel > 0;
    gameState.phaseShieldCooldownTimer = 0;
    updateHPDisplay();
    gameState.enemiesKilledThisWave = 0;
    startEnemySpawn();
    ensureAudio();
    animate();
}

function updateShieldCollision(enemy) {
    if (gameState.shieldLevel === 0 || gameState.shieldBounceTimer > 0) return;
    const dx = enemy.x - gameState.center.x;
    const dy = enemy.y - gameState.center.y;
    const dist = Math.hypot(dx, dy);
    if (dist < gameState.shieldRadius + enemy.size) {
        const nx = dx / dist;
        const ny = dy / dist;
        enemy.vx += nx * gameState.shieldBounce;
        enemy.vy += ny * gameState.shieldBounce;
        if (enemy.takeDamage) enemy.takeDamage(gameState.shieldDamage);
        else enemy.life -= gameState.shieldDamage;
        gameState.points++;
        playCollisionTone(Math.hypot(enemy.vx, enemy.vy));
        gameState.shieldBounceTimer = gameState.shieldBounceCooldown;
        for (let i = 0; i < 6; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, '#ff00ff'));
    }
}

function spawnRiftMine() {
    gameState.mines.push({
        x: gameState.player.x,
        y: gameState.player.y,
        life: 5000 + gameState.riftMineLevel * 1200,
        radius: gameState.mineRadius,
        damage: gameState.mineDamage
    });
}

function explodeMine(mine) {
    for (const enemy of gameState.enemies) {
        const d = Math.hypot(enemy.x - mine.x, enemy.y - mine.y);
        if (d <= mine.radius + enemy.size) {
            if (enemy.takeDamage) enemy.takeDamage(mine.damage);
            else enemy.life -= mine.damage;
            const nx = (enemy.x - mine.x) / (d || 1);
            const ny = (enemy.y - mine.y) / (d || 1);
            enemy.vx += nx * 2.8;
            enemy.vy += ny * 2.8;
        }
    }
    for (let i = 0; i < 16; i++) gameState.particles.push(new Particle(mine.x, mine.y, '#aa66ff'));
}

function updateRiftMines(delta) {
    if (gameState.riftMineLevel > 0) {
        gameState.mineSpawnTimer -= delta;
        if (gameState.mineSpawnTimer <= 0) {
            gameState.mineSpawnTimer = gameState.mineSpawnInterval;
            spawnRiftMine();
        }
    }
    const survivors = [];
    for (const mine of gameState.mines) {
        mine.life -= delta;
        let detonated = mine.life <= 0;
        if (!detonated) {
            for (const enemy of gameState.enemies) {
                if (Math.hypot(enemy.x - mine.x, enemy.y - mine.y) < mine.radius * 0.45 + enemy.size) {
                    detonated = true;
                    break;
                }
            }
        }
        if (detonated) explodeMine(mine);
        else survivors.push(mine);
    }
    gameState.mines = survivors;
}

function drawRiftMines() {
    for (const mine of gameState.mines) {
        const alpha = Math.max(0.25, Math.min(1, mine.life / 3500));
        refs.ctx.beginPath();
        refs.ctx.arc(mine.x, mine.y, 8 + Math.sin(Date.now() * 0.01) * 2, 0, Math.PI * 2);
        refs.ctx.fillStyle = `rgba(170,90,255,${alpha})`;
        refs.ctx.fill();
        refs.ctx.beginPath();
        refs.ctx.arc(mine.x, mine.y, mine.radius * 0.45, 0, Math.PI * 2);
        refs.ctx.strokeStyle = `rgba(180,120,255,${0.15 + alpha * 0.2})`;
        refs.ctx.lineWidth = 2;
        refs.ctx.stroke();
    }
}

function triggerFreezeShatter(x, y) {
    if (gameState.freezeShatterLevel === 0) return;
    const radius = 70 + gameState.freezeShatterLevel * 30;
    const damage = 0.6 + gameState.freezeShatterLevel * 0.4;
    for (const enemy of gameState.enemies) {
        const d = Math.hypot(enemy.x - x, enemy.y - y);
        if (d <= radius + enemy.size) {
            if (enemy.takeDamage) enemy.takeDamage(damage);
            else enemy.life -= damage;
        }
    }
    for (let i = 0; i < 14; i++) gameState.particles.push(new Particle(x, y, '#66ddff'));
}

function updateOrbitEchoes(delta) {
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
            for (const enemy of gameState.enemies) {
                const d = Math.hypot(enemy.x - echo.x, enemy.y - echo.y);
                if (d <= echo.radius + enemy.size) {
                    if (enemy.takeDamage) enemy.takeDamage(echo.damage);
                    else enemy.life -= echo.damage;
                    echo.hitCooldown = 120;
                    break;
                }
            }
        }
    });
    gameState.orbitEchoes = gameState.orbitEchoes.filter(e => e.life > 0);
}

function drawOrbitEchoes() {
    gameState.orbitEchoes.forEach(echo => {
        const alpha = Math.max(0, echo.life / 600) * 0.5;
        refs.ctx.beginPath();
        refs.ctx.arc(echo.x, echo.y, echo.radius, 0, Math.PI * 2);
        refs.ctx.fillStyle = `rgba(120,255,255,${alpha})`;
        refs.ctx.fill();
    });
}

function updatePhaseShield(delta) {
    if (gameState.phaseShieldLevel === 0) return;
    if (!gameState.phaseShieldReady) {
        gameState.phaseShieldCooldownTimer -= delta;
        if (gameState.phaseShieldCooldownTimer <= 0) {
            gameState.phaseShieldReady = true;
            gameState.phaseShieldCooldownTimer = 0;
        }
    }
    if (gameState.centerInvulnTimer > 0) gameState.centerInvulnTimer -= delta;
}

function drawPhaseShieldVisual() {
    if (gameState.centerInvulnTimer <= 0) return;
    const alpha = Math.min(0.8, gameState.centerInvulnTimer / 1200);
    refs.ctx.beginPath();
    refs.ctx.arc(gameState.center.x, gameState.center.y, 42, 0, Math.PI * 2);
    refs.ctx.strokeStyle = `rgba(120,255,255,${alpha})`;
    refs.ctx.lineWidth = 4;
    refs.ctx.stroke();
}

function drawShield(dt) {
    if (gameState.shieldLevel === 0) return;
    gameState.shieldPulseTime += 0.05 * dt;
    const pulse = Math.sin(gameState.shieldPulseTime) * 6;
    const r = gameState.shieldRadius + pulse;
    const alpha = gameState.shieldBounceTimer > 0 ? 0.3 : 0.8;
    refs.ctx.beginPath();
    refs.ctx.arc(gameState.center.x, gameState.center.y, r, 0, Math.PI * 2);
    refs.ctx.strokeStyle = `rgba(255,0,255,${alpha})`;
    refs.ctx.lineWidth = 3 + Math.sin(gameState.shieldPulseTime) * 1.5;
    refs.ctx.shadowBlur = 25;
    refs.ctx.shadowColor = '#ff00ff';
    refs.ctx.stroke();
    refs.ctx.shadowBlur = 0;
}

function drawCryoField() {
    if (gameState.cryoLevel === 0) return;
    refs.ctx.beginPath();
    refs.ctx.arc(gameState.center.x, gameState.center.y, gameState.cryoRadius, 0, Math.PI * 2);
    refs.ctx.strokeStyle = 'rgba(0,180,255,0.25)';
    refs.ctx.lineWidth = 2;
    refs.ctx.stroke();
    refs.ctx.fillStyle = 'rgba(0,180,255,0.04)';
    refs.ctx.fill();
}

function updateNova(delta) {
    if (gameState.novaLevel === 0) return;
    gameState.novaCooldown -= delta;
    if (gameState.novaCooldown > 0) return;
    gameState.novaCooldown = gameState.novaMaxCooldown;
    let hits = 0;
    for (const enemy of gameState.enemies) {
        const d = Math.hypot(enemy.x - gameState.center.x, enemy.y - gameState.center.y);
        if (d < gameState.novaRadius) {
            enemy.life -= gameState.novaDamage;
            hits++;
            for (let i = 0; i < 5; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, '#ff8800'));
        }
    }
    if (gameState.bloodNovaLevel > 0 && hits > 0) {
        const healEvery = Math.max(2, 5 - gameState.bloodNovaLevel);
        const heal = Math.floor(hits / healEvery);
        if (heal > 0) {
            gameState.playerHP = Math.min(gameState.maxHP, gameState.playerHP + heal);
            updateHPDisplay();
        }
    }
    gameState.novaFlash = 1;
    gameState.shakeTime = 0.15;
    for (let i = 0; i < 30; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#ffaa00'));
}

function drawNovaFlash(dt) {
    if (gameState.novaFlash <= 0) return;
    refs.ctx.beginPath();
    refs.ctx.arc(gameState.center.x, gameState.center.y, gameState.novaRadius * (1 - gameState.novaFlash * 0.3), 0, Math.PI * 2);
    refs.ctx.strokeStyle = `rgba(255,150,0,${gameState.novaFlash})`;
    refs.ctx.lineWidth = 4;
    refs.ctx.stroke();
    gameState.novaFlash -= 0.025 * dt;
}

function updateRegen(delta) {
    if (gameState.regenLevel === 0 || gameState.playerHP >= gameState.maxHP) return;
    gameState.regenTimer -= delta;
    if (gameState.regenTimer > 0) return;
    gameState.playerHP++;
    gameState.regenTimer = gameState.regenInterval;
    updateHPDisplay();
    for (let i = 0; i < 12; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#00ff88'));
}

function updatePulseArmor(delta) {
    if (gameState.pulseArmorLevel === 0) return;
    gameState.pulseArmorTimer -= delta;
    if (gameState.pulseArmorTimer > 0) return;
    gameState.pulseArmorTimer = gameState.pulseArmorInterval;
    const r = gameState.pulseArmorRadius;
    for (const enemy of gameState.enemies) {
        const dx = enemy.x - gameState.center.x;
        const dy = enemy.y - gameState.center.y;
        const d = Math.hypot(dx, dy);
        if (d <= r + enemy.size) {
            const nx = dx / (d || 1);
            const ny = dy / (d || 1);
            enemy.vx += nx * (2 + gameState.pulseArmorLevel * 0.5);
            enemy.vy += ny * (2 + gameState.pulseArmorLevel * 0.5);
            if (enemy.takeDamage) enemy.takeDamage(gameState.pulseArmorDamage);
            else enemy.life -= gameState.pulseArmorDamage;
        }
    }
    for (let i = 0; i < 20; i++) {
        const a = (Math.PI * 2 / 20) * i;
        gameState.particles.push(new Particle(gameState.center.x + Math.cos(a) * r, gameState.center.y + Math.sin(a) * r, '#66eeff'));
    }
}

function checkWaveProgression() {
    if (gameState.inBossFight || gameState.transitionState !== 'playing') return;
    if (gameState.enemiesKilledThisWave >= gameState.enemiesToNextBoss) startBossFight();
}

function startBossFight() {
    gameState.inBossFight = true;
    gameState.bossLevel++;
    gameState.enemies = [];
    const bossType = ((gameState.bossLevel - 1) % 5) + 1;
    if (bossType === 1) gameState.enemies.push(new BossEnemy());
    else if (bossType === 2) gameState.enemies.push(new (class extends BossEnemy { constructor(){super();this.size=30;this.color=palettes[gameState.currentPalette].bossColors[1];} update(dt){const dx=gameState.center.x-this.x;const dy=gameState.center.y-this.y;const dist=Math.hypot(dx,dy);this.vx+=dx/dist*0.15*dt;this.vy+=dy/dist*0.15*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;}})());
    else if (bossType === 3) gameState.enemies.push(new (class extends BossEnemy { constructor(){super();this.size=60;this.life=10+gameState.bossLevel*3;this.color=palettes[gameState.currentPalette].bossColors[2];}})());
    else if (bossType === 4) gameState.enemies.push(new (class extends BossEnemy { constructor(){super(gameState.center.x+200,gameState.center.y);this.size=35;this.life=12+gameState.bossLevel*2;this.color=palettes[gameState.currentPalette].bossColors[3];this.orbitAngle=0;this.orbitSpeed=0.015;this.orbitDist=250;this.spawnTimer=0;this.maxGeneration=0;} update(dt){this.orbitAngle += this.orbitSpeed * dt; this.x = gameState.center.x + Math.cos(this.orbitAngle) * this.orbitDist; this.y = gameState.center.y + Math.sin(this.orbitAngle) * this.orbitDist; this.vx=0; this.vy=0; this.spawnTimer += dt; if (this.spawnTimer > 180) { this.spawnTimer = 0; gameState.enemies.push(new Enemy(enemyTypes.fast)); } if (this.life < 6) this.orbitSpeed = 0.025; } draw(ctx){ super.draw(ctx); ctx.strokeStyle='rgba(0,255,170,0.15)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(gameState.center.x, gameState.center.y, this.orbitDist, 0, Math.PI*2); ctx.stroke(); }})());
    else gameState.enemies.push(new (class extends BossEnemy { constructor(){super();this.size=50;this.life=18+gameState.bossLevel*3;this.color=palettes[gameState.currentPalette].bossColors[4];this.pulseTimer=0;this.pulseFlash=0;this.maxGeneration=0;} update(dt){const dx=gameState.center.x-this.x;const dy=gameState.center.y-this.y;const dist=Math.hypot(dx,dy); if(dist>200){this.vx+=dx/dist*0.04*dt;this.vy+=dy/dist*0.04*dt;}else{this.vx*=Math.pow(0.95,dt);this.vy*=Math.pow(0.95,dt);} this.x += this.vx * dt; this.y += this.vy * dt; this.pulseTimer += dt; if(this.pulseTimer > 300){this.pulseTimer =0; this.pulseFlash=1; gameState.orbitBalls.forEach(o => { const pdx=o.x-this.x; const pdy=o.y-this.y; const pd=Math.hypot(pdx,pdy)||1; o.angle += (pdx/pd)*0.5; }); gameState.shakeTime = 0.15; for(let i=0;i<20;i++) gameState.particles.push(new Particle(this.x,this.y,'#ff8800'));}} draw(ctx){ if(this.pulseFlash>0){ ctx.beginPath(); ctx.arc(this.x,this.y,200*(1-this.pulseFlash),0,Math.PI*2); ctx.strokeStyle=`rgba(255,136,0,${this.pulseFlash})`; ctx.lineWidth=3; ctx.stroke(); this.pulseFlash -= 0.02; } super.draw(ctx);} })());
    gameState.transitionState = 'bossIntro';
    gameState.bossIntroTimer = gameState.bossIntroDuration;
}

function endBossFight() {
    gameState.inBossFight = false;
    gameState.wave++;
    gameState.enemiesKilledThisWave = 0;
    gameState.enemiesToNextBoss += 12;
    gameState.difficultyRamp = Math.min(1, gameState.difficultyRamp + 0.08);
    gameState.points += 5 + gameState.bossLevel * 3;
    gameState.prestigeStars += 1 + Math.floor(gameState.bossLevel / 2);
    document.getElementById('prestigeStarCount').textContent = gameState.prestigeStars;
    checkPaletteUnlocks();
    gameState.transitionState = 'waveTransition';
    gameState.waveTransitionTimer = gameState.waveTransitionDuration;
    stopEnemySpawn();
}

function checkCollisions() {
    for (const enemy of gameState.enemies) {
        const allBalls = [gameState.player, ...gameState.orbitBalls];
        if (gameState.player2) allBalls.push(gameState.player2);
        for (const ball of allBalls) {
            const dx = enemy.x - ball.x;
            const dy = enemy.y - ball.y;
            const dist = Math.hypot(dx, dy);
            if (dist < enemy.size + ball.size) {
                if (enemy.phases && !enemy.visible) continue;
                gameState.shakeTime = 0.1;
                enemy.vx += (dx / dist) * 3;
                enemy.vy += (dy / dist) * 3;
                playCollisionTone(Math.hypot(enemy.vx, enemy.vy));
                const orbDmg = ball.damage || 1;
                const hit = enemy.takeDamage ? enemy.takeDamage(orbDmg) : ((enemy.life -= orbDmg), true);
                if (hit) {
                    gameState.points += enemy.pts || 1;
                    gameState.killStreak++;
                    gameState.maxKillStreak = Math.max(gameState.maxKillStreak, gameState.killStreak);
                    refs.infoDiv.textContent = `Wave ${gameState.wave} | Points: ${gameState.points}`;
                }
                for (let i = 0; i < 10; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, enemy.color));
            }
        }

        for (let i = 0; i < gameState.enemies.length; i++) {
            for (let j = i + 1; j < gameState.enemies.length; j++) {
                const a = gameState.enemies[i];
                const b = gameState.enemies[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist < a.size + b.size && !a.isBoss && !b.isBoss) {
                    playCollisionTone(Math.hypot(a.vx + b.vx, a.vy + b.vy) * 0.5);
                    for (let k = 0; k < 20; k++) gameState.particles.push(new Particle(a.x, a.y, '#ff4444'));
                    gameState.enemies.splice(j, 1);
                    gameState.enemies.splice(i, 1);
                    gameState.points++;
                    gameState.enemiesKilledThisWave++;
                    gameState.killStreak++;
                    gameState.maxKillStreak = Math.max(gameState.maxKillStreak, gameState.killStreak);
                    i--;
                    break;
                }
            }
        }

        if (Math.hypot(enemy.x - gameState.center.x, enemy.y - gameState.center.y) < 20) {
            if (gameState.centerInvulnTimer > 0) {
                enemy.life = 0;
                continue;
            }
            if (gameState.phaseShieldLevel > 0 && gameState.phaseShieldReady && gameState.playerHP <= 1) {
                gameState.phaseShieldReady = false;
                gameState.centerInvulnTimer = 900 + gameState.phaseShieldLevel * 250;
                gameState.phaseShieldCooldownTimer = Math.max(9000, 24000 - gameState.phaseShieldLevel * 4500);
                gameState.playerHP = 1;
                updateHPDisplay();
                enemy.life = 0;
                for (let i = 0; i < 24; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#77ffff'));
                continue;
            }
            gameState.playerHP--;
            updateHPDisplay();
            gameState.shakeTime = 0.25;
            gameState.killStreak = 0;
            if (damageOverlay) {
                damageOverlay.style.opacity = '1';
                setTimeout(() => { damageOverlay.style.opacity = '0'; }, 200);
            }
            enemy.life = 0;
            for (let i = 0; i < 20; i++) gameState.particles.push(new Particle(gameState.center.x, gameState.center.y, '#ff0000'));
            if (gameState.playerHP <= 0) {
                gameState.gameOver = true;
                gameState.isPaused = true;
                gameState.savedPoints = gameState.points;
                gameState.restartAfterMenu = true;
                refs.orb.style.animation = 'orbDeathPulse 0.3s infinite alternate';
                setTimeout(() => { refs.orb.style.animation = ''; openUpgradeMenu(); }, 1200);
            }
        }
    }
}

function drawWaveTransition() {
    const palette = palettes[gameState.currentPalette];
    refs.ctx.fillStyle = palette.background;
    refs.ctx.fillRect(0, 0, refs.canvas.width, refs.canvas.height);
    const progress = 1 - (gameState.waveTransitionTimer / gameState.waveTransitionDuration);
    const alpha = Math.min(1, progress * 2);
    refs.ctx.save();
    refs.ctx.globalAlpha = alpha;
    refs.ctx.fillStyle = palette.core;
    refs.ctx.font = '48px sans-serif';
    refs.ctx.textAlign = 'center';
    refs.ctx.fillText(`Wave ${gameState.wave} Complete!`, gameState.center.x, gameState.center.y - 50);
    const barWidth = 300;
    refs.ctx.fillStyle = 'rgba(255,255,255,0.2)';
    refs.ctx.fillRect(gameState.center.x - barWidth / 2, gameState.center.y, barWidth, 20);
    refs.ctx.fillStyle = palette.core;
    refs.ctx.fillRect(gameState.center.x - barWidth / 2, gameState.center.y, barWidth * progress, 20);
    refs.ctx.restore();
}

function drawBossIntro() {
    const palette = palettes[gameState.currentPalette];
    refs.ctx.fillStyle = palette.background;
    refs.ctx.fillRect(0, 0, refs.canvas.width, refs.canvas.height);
    const progress = 1 - (gameState.bossIntroTimer / gameState.bossIntroDuration);
    const alpha = Math.min(1, progress * 2);
    refs.ctx.save();
    refs.ctx.globalAlpha = alpha;
    refs.ctx.fillStyle = palette.bossColors[gameState.bossLevel % 5];
    refs.ctx.font = '52px sans-serif';
    refs.ctx.textAlign = 'center';
    refs.ctx.fillText('BOSS INCOMING!', gameState.center.x, gameState.center.y - 50);
    refs.ctx.beginPath();
    refs.ctx.arc(gameState.center.x, gameState.center.y + 50, 40 + Math.sin(Date.now() * 0.01) * 10, 0, Math.PI * 2);
    refs.ctx.fillStyle = palette.bossColors[gameState.bossLevel % 5];
    refs.ctx.shadowBlur = 30;
    refs.ctx.shadowColor = palette.bossColors[gameState.bossLevel % 5];
    refs.ctx.fill();
    refs.ctx.shadowBlur = 0;
    refs.ctx.restore();
}

function animate(now = 0) {
    refs.ctx.save();
    const delta = lastFrameTime ? now - lastFrameTime : 16.67;
    lastFrameTime = now;
    const dt = Math.min(delta / 16.67, 3) * gameState.gameSpeed;
    gameState.difficultyRamp = Math.min(1, gameState.difficultyRamp + 0.00004 * dt);
    gameState.backgroundEvolution = Math.min(100, gameState.wave * 5 + (gameState.enemiesKilledThisWave / gameState.enemiesToNextBoss) * 20);
    if (gameState.isPaused) {
        refs.ctx.restore();
        requestAnimationFrame(animate);
        return;
    }
    if (gameState.transitionState === 'waveTransition') {
        gameState.waveTransitionTimer -= dt;
        if (gameState.waveTransitionTimer <= 0) {
            gameState.transitionState = 'playing';
            startEnemySpawn();
        } else {
            drawWaveTransition();
            refs.ctx.restore();
            requestAnimationFrame(animate);
            return;
        }
    } else if (gameState.transitionState === 'bossIntro') {
        gameState.bossIntroTimer -= dt;
        if (gameState.bossIntroTimer <= 0) gameState.transitionState = 'playing';
        else {
            drawBossIntro();
            refs.ctx.restore();
            requestAnimationFrame(animate);
            return;
        }
    }
    screenShake(dt);
    const palette = palettes[gameState.currentPalette];
    let bgColor = palette.background;
    if (gameState.backgroundEvolution > 0) {
        const evolutionFactor = Math.min(0.3, gameState.backgroundEvolution / 100);
        const rgb = hexToRgb(bgColor);
        if (rgb) {
            const r = Math.floor(rgb.r * (1 - evolutionFactor));
            const g = Math.floor(rgb.g * (1 - evolutionFactor));
            const b = Math.floor(rgb.b * (1 - evolutionFactor));
            bgColor = `rgb(${r}, ${g}, ${b})`;
        }
    }
    refs.ctx.fillStyle = bgColor;
    refs.ctx.fillRect(0, 0, refs.canvas.width, refs.canvas.height);
    if (gameState.backgroundEvolution > 0) {
        const alpha = Math.min(0.3, gameState.backgroundEvolution / 100);
        const gradient = refs.ctx.createRadialGradient(gameState.center.x, gameState.center.y, 0, gameState.center.x, gameState.center.y, Math.max(refs.canvas.width, refs.canvas.height) / 2);
        gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.1})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        refs.ctx.fillStyle = gradient;
        refs.ctx.fillRect(0, 0, refs.canvas.width, refs.canvas.height);
    }
    refs.ctx.beginPath();
    refs.ctx.arc(gameState.center.x, gameState.center.y, 20, 0, Math.PI * 2);
    refs.ctx.fillStyle = palette.core;
    refs.ctx.fill();
    gameState.player.update(gameState.mouse.x, gameState.mouse.y);
    gameState.player.draw(refs.ctx);
    gameState.orbitBalls.forEach((o, i) => {
        o.update(gameState.player.angle, i, gameState.orbitBalls.length, dt);
        o.draw(refs.ctx);
    });
    if (gameState.player2) {
        gameState.player2.angle = gameState.player.angle + Math.PI;
        gameState.player2.x = gameState.center.x + Math.cos(gameState.player2.angle) * gameState.player2.orbitRadius;
        gameState.player2.y = gameState.center.y + Math.sin(gameState.player2.angle) * gameState.player2.orbitRadius;
        gameState.player2.draw(refs.ctx);
    }
    applyGravityWell(dt);
    updatePulseArmor(delta * gameState.gameSpeed);
    updateRiftMines(delta * gameState.gameSpeed);
    updateOrbitEchoes(delta * gameState.gameSpeed);
    updatePhaseShield(delta * gameState.gameSpeed);
    gameState.enemies.forEach(enemy => {
        enemy.update(dt);
        updateShieldCollision(enemy);
        enemy.draw(refs.ctx);
    });
    updateParticles(dt);
    drawParticles(refs.ctx);
    checkCollisions();
    const newEnemies = [];
    gameState.enemies = gameState.enemies.filter(enemy => {
        if (enemy.life > 0) return true;
        const diedInCryoZone = gameState.cryoLevel > 0 && Math.hypot(enemy.x - gameState.center.x, enemy.y - gameState.center.y) < gameState.cryoRadius;
        if (enemy.isBoss && enemy.generation !== undefined && enemy.generation < enemy.maxGeneration) {
            const splitCount = 2 + enemy.generation;
            for (let i = 0; i < splitCount; i++) {
                const angle = (Math.PI * 2 / splitCount) * i;
                const child = new BossEnemy(enemy.x + Math.cos(angle) * 10, enemy.y + Math.sin(angle) * 10, enemy.size * 0.6, enemy.generation + 1);
                child.vx = Math.cos(angle) * 3;
                child.vy = Math.sin(angle) * 3;
                newEnemies.push(child);
            }
            for (let i = 0; i < 20; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, '#ff00ff'));
            gameState.enemiesKilledThisWave++;
            return false;
        }
        if (enemy.splits) {
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                const child = new Enemy(enemyTypes.fast);
                child.x = enemy.x + Math.cos(angle) * 10;
                child.y = enemy.y + Math.sin(angle) * 10;
                child.vx = Math.cos(angle) * 2;
                child.vy = Math.sin(angle) * 2;
                child.size = 6;
                child.life = 1;
                child.splits = false;
                newEnemies.push(child);
            }
            for (let i = 0; i < 10; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, '#ff4488'));
        }
        if (enemy.explodes) {
            for (let i = 0; i < 3; i++) {
                const angle = (Math.PI * 2 / 3) * i;
                const child = new Enemy(enemyTypes.wisp);
                child.x = enemy.x + Math.cos(angle) * 8;
                child.y = enemy.y + Math.sin(angle) * 8;
                child.vx = Math.cos(angle) * 2.2;
                child.vy = Math.sin(angle) * 2.2;
                newEnemies.push(child);
            }
            for (let i = 0; i < 12; i++) gameState.particles.push(new Particle(enemy.x, enemy.y, '#ffaa33'));
        }
        if (!enemy.isBoss && diedInCryoZone) triggerFreezeShatter(enemy.x, enemy.y);
        if (!enemy.isBoss) {
            gameState.enemiesKilledThisWave++;
            gameState.killStreak++;
            gameState.maxKillStreak = Math.max(gameState.maxKillStreak, gameState.killStreak);
        }
        return false;
    });
    gameState.enemies.push(...newEnemies);
    const bossAlive = gameState.enemies.some(enemy => enemy.isBoss);
    if (gameState.inBossFight && !bossAlive) endBossFight();
    updateLaserSystem(delta * gameState.gameSpeed);
    checkWaveProgression();
    updateNova(delta * gameState.gameSpeed);
    updateRegen(delta * gameState.gameSpeed);
    drawLaserBeams(refs.ctx, dt);
    drawRiftMines();
    drawOrbitEchoes();
    if (gameState.shieldBounceTimer > 0) gameState.shieldBounceTimer -= delta * gameState.gameSpeed;
    drawShield(dt);
    drawCryoField();
    drawPhaseShieldVisual();
    drawNovaFlash(delta * gameState.gameSpeed);
    updateWaveProgress();
    refs.infoDiv.textContent = `Wave ${gameState.wave} | Points: ${gameState.points} | Kill Streak: ${gameState.killStreak} | Prestige ${gameState.prestigeCount}`;
    if (gameState.killStreak > 0 && gameState.killStreak % 10 === 0 && gameState.killStreak <= 50 && gameState.killStreak !== gameState.lastKillStreakMilestone) {
        gameState.lastKillStreakMilestone = gameState.killStreak;
        gameState.shakeTime = 0.2;
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 / 20) * i;
            const dist = 100;
            gameState.particles.push(new Particle(gameState.center.x + Math.cos(angle) * dist, gameState.center.y + Math.sin(angle) * dist, palettes[gameState.currentPalette].particleColors[gameState.killStreak % palettes[gameState.currentPalette].particleColors.length]));
        }
    }
    refs.ctx.restore();
    if (!gameState.gameOver) requestAnimationFrame(animate);
}

function initGame() {
    setCanvasSize();
    gameState.currentPalette = 0;
    gameState.unlockedPalettes = [0];
    gameState.difficultyMode = 'normal';
    const preset = difficultyPresets[gameState.difficultyMode];
    gameState.diffSpawnMul = preset.spawnMul;
    gameState.diffSpeedMul = preset.speedMul;
    gameState.maxHP = preset.hp;
    gameState.playerHP = gameState.maxHP;
    gameState.player = new PlayerBall();
    rebuildFromUpgrades();
    gameState.playerHP = gameState.maxHP;
    updateHPDisplay();
    refs.prestigeOrbEl.textContent = gameState.prestigeStars;
    refs.infoDiv.textContent = `Wave ${gameState.wave} | Points: ${gameState.points} | Prestige ${gameState.prestigeCount}`;
    updateBars();
    updatePrestigeBars();
    updatePrestigeResetButton();
    startEnemySpawn();
    animate();
}

function init() {
    initRefs();
    bindUI();
    initAudio();
    initGame();
    window.startGame = startGame;
    window.chooseDifficulty = (mode) => {
        refs.difficultyMenu.style.display = 'none';
        startGame(mode);
    };
}

init();
