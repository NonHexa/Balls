import { gameState, refs } from './state.js';
import { upgrades, prestigeUpgrades, difficultyPresets } from './config.js';
import { rebuildFromUpgrades, startEnemySpawn, PlayerBall, OrbitBall } from './entities.js';
import { spawnUpgradeParticles } from './particles.js';

export function isUpgradeAvailable(u) {
    if (u.postPrestige && !gameState.postPrestigeUnlocked) return false;
    
    const minPrestigeForUpgrade = {
        'Overcharge': 0,
        'Fortress': 0,
        'Vortex': 1,
        'Chain': 1,
        'Hyper': 1,
        'Starfire': 2,
        'PulseArmor': 2,
        'RiftMine': 2,
        'BloodNova': 3,
        'FreezeShatter': 3,
        'OrbitEcho': 3,
        'PhaseShield': 4
    };
    
    const minPrestige = minPrestigeForUpgrade[u.name] || 0;
    return gameState.prestigeCount >= minPrestige;
}

export function canBuyUpgrade(u) {
    if (!isUpgradeAvailable(u)) return false;
    return u.requires.every(req => {
        const up = upgrades.find(x => x.name === req.name) || prestigeUpgrades.find(x => x.name === req.name);
        return up && up.level >= req.level;
    });
}

export function canBuyPrestigeUpgrade(u) {
    return u.requires.every(req => {
        const up = prestigeUpgrades.find(x => x.name === req.name);
        return up && up.level >= req.level;
    });
}

export function getUpgradeCost(u) {
    return Math.floor(u.cost * (1 + u.level * 0.5));
}

export function canPrestigeNow() {
    const available = upgrades.filter(isUpgradeAvailable);
    return available.length > 0 && available.every(u => u.level >= u.max);
}

export function updatePrestigeResetButton() {
    const ready = canPrestigeNow();
    refs.prestigeResetBtn.disabled = !ready;
    refs.prestigeResetBtn.textContent = ready
        ? `Ascend Reset (Prestige ${gameState.prestigeCount + 1})`
        : 'Ascend Reset (Max all available upgrades first)';
}

export function doPrestigeReset() {
    if (!canPrestigeNow()) return;
    gameState.prestigeCount++;
    gameState.postPrestigeUnlocked = true;
    upgrades.forEach(u => { u.level = 0; });

    gameState.spawnCount = 0;
    gameState.wave = 1;
    gameState.bossLevel = 0;
    gameState.enemiesToNextBoss = 30;
    gameState.enemiesKilledThisWave = 0;
    gameState.difficultyRamp = 0;
    gameState.inBossFight = false;
    gameState.points = 0;
    gameState.gameOver = false;
    gameState.isPaused = false;
    gameState.enemies = [];
    gameState.particles = [];
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

    rebuildFromUpgrades();
    gameState.playerHP = gameState.maxHP;

     refs.prestigeGlass.classList.remove('open');
     refs.prestigeGlass.style.display = 'none';
     refs.infoDiv.textContent = `Wave ${gameState.wave} | Points: ${gameState.points} | Prestige ${gameState.prestigeCount}`;
     updateBars();
     gameState.isPaused = true;
     refs.glass.style.display = 'flex';
     requestAnimationFrame(() => refs.glass.classList.add('open'));
     startEnemySpawn();
     if (gameState.audioStarted) gameState.audioCtx.resume();
}

export function updatePrestigeBars() {
    document.querySelectorAll('.prestigeNode').forEach(node => {
        const name = node.querySelector('.uName').textContent;
        const u = prestigeUpgrades.find(x => x.name === name);
        if (!u) return;
        if (!canBuyPrestigeUpgrade(u)) {
            node.style.opacity = 0.3;
            node.style.filter = 'grayscale(1)';
        } else {
            node.style.opacity = 1;
            node.style.filter = 'none';
        }
        node.querySelector('.progressBar div').style.width = (u.level / u.max) * 100 + '%';
        let costEl = node.querySelector('.uCost');
        if (!costEl) {
            costEl = document.createElement('div');
            costEl.className = 'uCost';
            node.querySelector('.progressBar').before(costEl);
        }
        costEl.textContent = u.level >= u.max ? 'MAX' : `Cost: ${u.cost + u.level} ★`;
        let reqEl = node.querySelector('.uReq');
        if (!reqEl) {
            reqEl = document.createElement('div');
            reqEl.className = 'uReq';
            costEl.after(reqEl);
        }
        reqEl.textContent = (!canBuyPrestigeUpgrade(u) && u.requires.length > 0)
            ? 'Needs: ' + u.requires.map(r => `${r.name} Lv${r.level}`).join(', ')
            : '';
    });
}

export function applyPrestigeUpgrade(name) {
    const u = prestigeUpgrades.find(x => x.name === name);
    if (!u || !canBuyPrestigeUpgrade(u)) return;
    const cost = u.cost + u.level;
    if (gameState.prestigeStars >= cost && u.level < u.max) {
        gameState.prestigeStars -= cost;
        refs.prestigeOrbEl.textContent = gameState.prestigeStars;
        u.level++;
        if (name === 'Orbit') {
            const speedLvl = prestigeUpgrades.find(x => x.name === 'Speed').level;
            const o = new OrbitBall(Math.random() * Math.PI * 2);
            o.angularSpeed += speedLvl * 0.015;
            o.damage = 0.25 + upgrades.find(u => u.name === 'Damage').level * 0.25 + speedLvl * 0.125;
            gameState.orbitBalls.push(o);
        }
        if (name === 'Radius') gameState.player.orbitRadius += 25;
        if (name === 'Speed') {
            gameState.orbitBalls.forEach(o => {
                o.angularSpeed += 0.015;
                o.damage = 0.25 + upgrades.find(u => u.name === 'Damage').level * 0.25 + u.level * 0.125;
            });
        }
        const node = document.querySelector(`.prestigeNode[data-name="${name}"]`);
        if (node) {
            node.classList.add('unlocked');
            setTimeout(() => node.classList.remove('unlocked'), 400);
        }
        updatePrestigeBars();
        updatePrestigeResetButton();
    }
}

export function updateBars() {
    let allMaxed = true;
    document.querySelectorAll('.upgradeNode').forEach(node => {
        const name = node.querySelector('.uName').textContent;
        const u = upgrades.find(x => x.name === name);
        if (!u) return;
        if (!isUpgradeAvailable(u)) {
            node.style.display = 'none';
            return;
        }
        if (u.level < u.max) allMaxed = false;
        if (!canBuyUpgrade(u) && u.level === 0) {
            node.style.display = 'none';
            return;
        }
        node.style.display = '';
        node.style.opacity = 1;
        node.style.filter = 'none';
        node.querySelector('.progressBar div').style.width = (u.level / u.max) * 100 + '%';
        let costEl = node.querySelector('.uCost');
        if (!costEl) {
            costEl = document.createElement('div');
            costEl.className = 'uCost';
            node.querySelector('.progressBar').before(costEl);
        }
        costEl.textContent = u.level >= u.max ? 'MAX' : `Cost: ${getUpgradeCost(u)}`;
        let reqEl = node.querySelector('.uReq');
        if (!reqEl) {
            reqEl = document.createElement('div');
            reqEl.className = 'uReq';
            costEl.after(reqEl);
        }
        reqEl.textContent = (!canBuyUpgrade(u) && u.requires.length > 0)
            ? 'Needs: ' + u.requires.map(r => `${r.name} Lv${r.level}`).join(', ')
            : '';
    });
    refs.prestigeOrbEl.style.display = allMaxed ? 'block' : 'none';
}

export function updateHPDisplay() {
    const hpBar = refs.hpBar;
    if (!hpBar) return;
    hpBar.innerHTML = '';
    for (let i = 0; i < gameState.maxHP; i++) {
        const heart = document.createElement('div');
        heart.className = 'hpHeart';
        heart.textContent = '♥';
        if (i >= gameState.playerHP) {
            heart.classList.add('empty');
        }
        hpBar.appendChild(heart);
    }
}

export function updateWaveProgress() {
    const waveProgress = refs.waveProgress;
    if (!waveProgress) return;
    const progress = gameState.enemiesToNextBoss > 0 
        ? (gameState.enemiesKilledThisWave / gameState.enemiesToNextBoss) * 100 
        : 100;
    waveProgress.style.width = Math.min(100, progress) + '%';
}

export function applyUpgrade(name) {
    const u = upgrades.find(x => x.name === name);
    if (!u || !canBuyUpgrade(u)) return;
    const cost = getUpgradeCost(u);
    if (gameState.points >= cost && u.level < u.max) {
        gameState.points -= cost;
        gameState.infoText = `Wave ${gameState.wave} | Points: ${gameState.points}`;
        u.level++;
        if (name === 'Damage') {
            gameState.damageBonus = u.level;
            gameState.orbitBalls.forEach(o => { o.damage = 0.5 + gameState.damageBonus * 0.6; });
        }
        if (name === 'Laser') {
            gameState.laserDamage = 0.75 + u.level * 0.75;
            gameState.laserFireDelay = Math.max(1500, 5000 - u.level * 600);
        }
        if (name === 'Shield') {
            gameState.shieldLevel++;
            gameState.shieldBounce += 2.5;
            gameState.shieldDamage += 1;
            gameState.shieldBounceCooldown = Math.max(4000, (21 - gameState.shieldLevel) * 1000);
            gameState.shieldBounceTimer = 0;
        }
        if (name === 'Dual' && !gameState.player2) gameState.player2 = new PlayerBall();
        if (name === 'Magnet') {
            gameState.magnetLevel++;
            gameState.magnetStrength += 0.02;
        }
        if (name === 'Pierce') gameState.pierceLevel = u.level;
        if (name === 'Cryo') {
            gameState.cryoLevel = u.level;
            gameState.cryoRadius = 50 + u.level * 30;
            gameState.cryoSlow = 0.99;
        }
        if (name === 'Gravity') gameState.gravityLevel = u.level;
        if (name === 'Multi') gameState.multiLevel = u.level;
        if (name === 'Nova') {
            gameState.novaLevel = u.level;
            gameState.novaMaxCooldown = Math.max(3000, 8000 - u.level * 1500);
            gameState.novaRadius = 150 + u.level * 40;
            gameState.novaDamage = 2 + u.level;
        }
        if (name === 'Regen') {
            gameState.regenLevel = u.level;
            gameState.regenInterval = Math.max(6000, 15000 - u.level * 3000);
        }
        if (name === 'Overcharge') {
            gameState.overchargeLevel = u.level;
            gameState.laserDamage += 0.3;
            gameState.laserFireDelay = Math.max(1200, gameState.laserFireDelay - 220);
        }
        if (name === 'Fortress') {
            gameState.fortressLevel = u.level;
            gameState.maxHP = difficultyPresets[gameState.difficultyMode].hp + gameState.fortressLevel;
            gameState.playerHP = gameState.maxHP;
        }
        if (name === 'Vortex') gameState.vortexLevel = u.level;
        if (name === 'Chain') {
            gameState.chainLevel = u.level;
            gameState.pierceRange = 200 + gameState.chainLevel * 70;
        }
        if (name === 'Hyper') {
            gameState.hyperLevel = u.level;
            gameState.orbitDamageBoost = gameState.hyperLevel * 0.2;
            gameState.orbitBalls.forEach(o => {
                o.damage += 0.2;
                o.angularSpeed += 0.006;
            });
        }
        if (name === 'Starfire') {
            gameState.starfireLevel = u.level;
            gameState.novaRadius += 25;
            gameState.novaDamage += 0.7;
        }
        if (name === 'PulseArmor') {
            gameState.pulseArmorLevel = u.level;
            gameState.pulseArmorInterval = Math.max(2200, 7000 - gameState.pulseArmorLevel * 900);
            gameState.pulseArmorRadius = 90 + gameState.pulseArmorLevel * 25;
            gameState.pulseArmorDamage = gameState.pulseArmorLevel * 0.55;
            gameState.pulseArmorTimer = 0;
        }
        if (name === 'RiftMine') {
            gameState.riftMineLevel = u.level;
            gameState.mineSpawnInterval = Math.max(2600, 9000 - gameState.riftMineLevel * 1100);
            gameState.mineRadius = 70 + gameState.riftMineLevel * 18;
            gameState.mineDamage = 0.8 + gameState.riftMineLevel * 0.65;
            gameState.mineSpawnTimer = 0;
        }
        if (name === 'BloodNova') gameState.bloodNovaLevel = u.level;
        if (name === 'FreezeShatter') gameState.freezeShatterLevel = u.level;
        if (name === 'OrbitEcho') {
            gameState.orbitEchoLevel = u.level;
            gameState.orbitEchoSpawnTimer = 0;
        }
        if (name === 'PhaseShield') {
            gameState.phaseShieldLevel = u.level;
            gameState.phaseShieldReady = true;
            gameState.phaseShieldCooldownTimer = 0;
        }
        const node = refs.upgradeNodes.find(n => n.dataset.name === u.name);
        if (node) {
            node.classList.add('unlocked');
            setTimeout(() => node.classList.remove('unlocked'), 400);
            const rect = node.getBoundingClientRect();
            spawnUpgradeParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        updateBars();
    }
}

