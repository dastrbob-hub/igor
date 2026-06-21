export const UNIT_TYPES = {
  warrior: {
    name: 'Warrior',
    hp: 50,
    attack: 14,
    defense: 5,
    moveRange: 3,
    attackRange: 1,
    cost: { gold: 50, food: 30 },
    canHarvest: false,
  },
  archer: {
    name: 'Archer',
    hp: 32,
    attack: 12,
    defense: 2,
    moveRange: 2,
    attackRange: 3,
    cost: { gold: 45, food: 25 },
    canHarvest: false,
  },
  scout: {
    name: 'Scout',
    hp: 26,
    attack: 8,
    defense: 2,
    moveRange: 5,
    attackRange: 1,
    cost: { gold: 35, food: 15 },
    canHarvest: false,
  },
  worker: {
    name: 'Worker',
    hp: 22,
    attack: 3,
    defense: 1,
    moveRange: 4,
    attackRange: 1,
    cost: { gold: 25, food: 10 },
    canHarvest: true,
  },
};

let nextUnitId = 1;

export function createUnit(type, faction, x, y) {
  const template = UNIT_TYPES[type];
  return {
    id: nextUnitId++,
    type,
    faction,
    x,
    y,
    hp: template.hp,
    maxHp: template.hp,
    attack: template.attack,
    defense: template.defense,
    moveRange: template.moveRange,
    attackRange: template.attackRange,
    canHarvest: template.canHarvest,
    hasMoved: false,
    hasAttacked: false,
    hasHarvested: false,
  };
}

export function resetUnitIds() {
  nextUnitId = 1;
}

export function resetUnitTurn(unit) {
  unit.hasMoved = false;
  unit.hasAttacked = false;
  unit.hasHarvested = false;
}

export function getDamage(attacker, defender) {
  const raw = attacker.attack - defender.defense;
  return Math.max(1, raw + Math.floor(Math.random() * 5) - 2);
}

export function getBuildingDamage(attacker) {
  return Math.max(3, attacker.attack + Math.floor(Math.random() * 4));
}