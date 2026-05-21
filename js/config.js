export const PRESTIGE_ENEMY_STAT_BONUS = 0.15;
export const PRESTIGE_SPAWN_BONUS = 0.10;
export const ENEMY_MAX_SPEED = 20;

export const difficultyPresets = {
    bethan: { hp: 5, spawnMul: 1.6, speedMul: 0.6, label: 'Bethan' },
    normal: { hp: 3, spawnMul: 1.0, speedMul: 1.0, label: 'Normal People' },
    curtis: { hp: 1, spawnMul: 0.5, speedMul: 1.5, label: 'Curtis' }
};

export const enemyTypes = {
    fast:     { typeName: 'fast',     color: '#ff0000', size: 8,  gravity: 0.20, life: 1, speedMultiplier: 1.8, pts: 1 },
    medium:   { typeName: 'medium',   color: '#ff8800', size: 14, gravity: 0.10, life: 2, speedMultiplier: 0.8, pts: 1 },
    slow:     { typeName: 'slow',     color: '#8800ff', size: 20, gravity: 0.05, life: 6, speedMultiplier: 0.4, pts: 2 },
    zigzag:   { typeName: 'zigzag',   color: '#00ff88', size: 10, gravity: 0.12, life: 2, speedMultiplier: 1.2, pts: 2, zigzags: true },
    shielded: { typeName: 'shielded', color: '#ffff00', size: 16, gravity: 0.08, life: 3, speedMultiplier: 0.6, pts: 3, hasShield: true },
    splitter: { typeName: 'splitter', color: '#ff4488', size: 18, gravity: 0.07, life: 2, speedMultiplier: 0.7, pts: 2, splits: true },
    ghost:    { typeName: 'ghost',    color: '#8888ff', size: 12, gravity: 0.10, life: 1, speedMultiplier: 1.0, pts: 3, phases: true },
    hunter:   { typeName: 'hunter',   color: '#ff6677', size: 10, gravity: 0.14, life: 2, speedMultiplier: 1.4, pts: 3, huntsPlayer: true },
    brute:    { typeName: 'brute',    color: '#7a3311', size: 24, gravity: 0.05, life: 12, speedMultiplier: 0.33, pts: 4, armored: true },
    bomber:   { typeName: 'bomber',   color: '#ffa500', size: 15, gravity: 0.09, life: 3, speedMultiplier: 0.75, pts: 3, explodes: true },
    wisp:     { typeName: 'wisp',     color: '#77ddff', size: 9,  gravity: 0.11, life: 1, speedMultiplier: 1.5, pts: 2, jitters: true },
    orbiter:  { typeName: 'orbiter',  color: '#66ffbb', size: 11, gravity: 0.08, life: 3, speedMultiplier: 1.0, pts: 4, orbitsCenter: true }
};

export const palettes = [
    {
        name: "Default",
        background: "#000",
        core: "#fff",
        orbitBall: "#0ff",
        enemyColors: {
            fast: "#ff0000", medium: "#ff8800", slow: "#8800ff", zigzag: "#00ff88",
            shielded: "#ffff00", splitter: "#ff4488", ghost: "#8888ff", hunter: "#ff6677",
            brute: "#7a3311", bomber: "#ffa500", wisp: "#77ddff", orbiter: "#66ffbb"
        },
        bossColors: ["#ff00ff", "#ff2222", "#8800ff", "#00ffaa", "#ffff88"],
        particleColors: ["#ff00ff", "#00ffff", "#ffff00"],
        unlockWave: 1
    },
    {
        name: "Neon",
        background: "#001122",
        core: "#ffffff",
        orbitBall: "#00ffff",
        enemyColors: {
            fast: "#ff0044", medium: "#ffaa00", slow: "#aa00ff", zigzag: "#00ff44",
            shielded: "#ffff44", splitter: "#ff44aa", ghost: "#4444ff", hunter: "#ff4444",
            brute: "#aa4411", bomber: "#ffaa00", wisp: "#44ffff", orbiter: "#44ffaa"
        },
        bossColors: ["#ff00ff", "#ff4444", "#aa00ff", "#00ffaa", "#ffff44"],
        particleColors: ["#ff00ff", "#00ffff", "#ffff44"],
        unlockWave: 5
    },
    {
        name: "Inferno",
        background: "#220000",
        core: "#ffffff",
        orbitBall: "#ff6600",
        enemyColors: {
            fast: "#ff0000", medium: "#ff4400", slow: "#ff8800", zigzag: "#ffaa00",
            shielded: "#ffff00", splitter: "#ff2244", ghost: "#ff6688", hunter: "#ff3344",
            brute: "#aa2200", bomber: "#ff5500", wisp: "#ff9966", orbiter: "#ff7744"
        },
        bossColors: ["#ff0000", "#ff4400", "#ff8800", "#ffff00", "#ffffff"],
        particleColors: ["#ff4400", "#ff8800", "#ffff00"],
        unlockWave: 10
    },
    {
        name: "Frost",
        background: "#001133",
        core: "#ffffff",
        orbitBall: "#66ccff",
        enemyColors: {
            fast: "#0088ff", medium: "#44aaff", slow: "#88ccff", zigzag: "#66ddff",
            shielded: "#aaddff", splitter: "#4499ff", ghost: "#aaccee", hunter: "#3388ff",
            brute: "#225588", bomber: "#77bbff", wisp: "#bbddff", orbiter: "#88ddff"
        },
        bossColors: ["#66ccff", "#44aaff", "#88ccff", "#aaddff", "#ffffff"],
        particleColors: ["#44aaff", "#88ccff", "#aaddff"],
        unlockWave: 15
    },
    {
        name: "Void",
        background: "#000011",
        core: "#ffffff",
        orbitBall: "#aa00ff",
        enemyColors: {
            fast: "#440066", medium: "#660088", slow: "#8800aa", zigzag: "#aa00cc",
            shielded: "#cc00ff", splitter: "#660044", ghost: "#9944aa", hunter: "#773366",
            brute: "#331122", bomber: "#994466", wisp: "#bb66aa", orbiter: "#aa44cc"
        },
        bossColors: ["#aa00ff", "#cc00ff", "#8800aa", "#bb44ff", "#ffffff"],
        particleColors: ["#aa00ff", "#cc00ff", "#bb44ff"],
        unlockWave: 20
    }
];

export const upgrades = [
    { name: "Damage",  cost: 5,   level: 0, max: 5, requires: [] },
    { name: "Laser",   cost: 12,  level: 0, max: 5, requires: [{name:"Damage", level:1}] },
    { name: "Shield",  cost: 14,  level: 0, max: 5, requires: [{name:"Damage", level:1}] },
    { name: "Magnet",  cost: 14,  level: 0, max: 5, requires: [{name:"Damage", level:1}] },
    { name: "Pierce",  cost: 18,  level: 0, max: 3, requires: [{name:"Laser", level:2}] },
    { name: "Dual",    cost: 30,  level: 0, max: 1, requires: [{name:"Laser", level:2}] },
    { name: "Gravity", cost: 22,  level: 0, max: 3, requires: [{name:"Magnet", level:3}] },
    { name: "Nova",    cost: 22,  level: 0, max: 3, requires: [{name:"Laser", level:3}, {name:"Shield", level:2}] },
    { name: "Multi",   cost: 35,  level: 0, max: 2, requires: [{name:"Pierce", level:2}, {name:"Dual", level:1}] },
    { name: "Cryo",    cost: 18,  level: 0, max: 3, requires: [{name:"Shield", level:2}] },
    { name: "Regen",   cost: 28,  level: 0, max: 3, requires: [{name:"Cryo", level:1}, {name:"Nova", level:1}] },
    { name: "Overcharge", cost: 34, level: 0, max: 4, requires: [{name:"Laser", level:3}], postPrestige: true },
    { name: "Fortress",   cost: 32, level: 0, max: 3, requires: [{name:"Shield", level:3}], postPrestige: true },
    { name: "Vortex",     cost: 36, level: 0, max: 4, requires: [{name:"Gravity", level:2}], postPrestige: true },
    { name: "Chain",      cost: 35, level: 0, max: 3, requires: [{name:"Pierce", level:2}], postPrestige: true },
    { name: "Hyper",      cost: 40, level: 0, max: 3, requires: [{name:"Dual", level:1}], postPrestige: true },
    { name: "Starfire",   cost: 58, level: 0, max: 2, requires: [{name:"Nova", level:2}, {name:"Vortex", level:2}], postPrestige: true },
    { name: "PulseArmor", cost: 46, level: 0, max: 3, requires: [{name:"Fortress", level:2}], postPrestige: true },
    { name: "RiftMine",   cost: 48, level: 0, max: 3, requires: [{name:"Vortex", level:1}, {name:"Hyper", level:1}], postPrestige: true },
    { name: "BloodNova",  cost: 55, level: 0, max: 3, requires: [{name:"Starfire", level:1}, {name:"Regen", level:2}], postPrestige: true },
    { name: "FreezeShatter", cost: 44, level: 0, max: 3, requires: [{name:"Cryo", level:3}, {name:"Vortex", level:1}], postPrestige: true },
    { name: "OrbitEcho",  cost: 52, level: 0, max: 3, requires: [{name:"Hyper", level:1}, {name:"Overcharge", level:1}], postPrestige: true },
    { name: "PhaseShield", cost: 64, level: 0, max: 2, requires: [{name:"Fortress", level:2}, {name:"Regen", level:2}], postPrestige: true },
    { name: "LifeForce", cost: 50, level: 0, max: 2, requires: [{name:"Fortress", level:2}], postPrestige: true }
];

export const prestigeUpgrades = [
    { name: "Orbit",  cost: 1, level: 0, max: 5, requires: [] },
    { name: "Speed",  cost: 1, level: 0, max: 5, requires: [{name:"Orbit", level:1}] },
    { name: "Radius", cost: 1, level: 0, max: 5, requires: [{name:"Orbit", level:1}] },
    { name: "OrbitControl", cost: 2, level: 0, max: 1, requires: [{name:"Orbit", level:1}] },
    { name: "ExtraOrbit", cost: 2, level: 0, max: 3, requires: [{name:"Orbit", level:2}] }
];
