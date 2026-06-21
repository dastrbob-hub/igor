import {
  FACTIONS,
  TERRAIN_COST,
  TERRAIN,
  STARTING_RESOURCES,
  PLAYER_BASE,
  ENEMY_BASE,
  RESOURCE_NODES,
} from './config.js';
import { generateMap, getTile, isWalkableTerrain } from './map.js';
import {
  createUnit,
  resetUnitIds,
  resetUnitTurn,
  getDamage,
  getBuildingDamage,
  UNIT_TYPES,
} from './units.js';
import {
  createBuilding,
  resetBuildingIds,
  BUILDING_TYPES,
  hasAdjacentTerrain,
} from './buildings.js';
import { calculateFactionIncome, canAfford, spendResources, getHarvestAmount } from './economy.js';

export const ACTION_MODES = {
  NONE: 'none',
  MOVE: 'move',
  ATTACK: 'attack',
  BUILD: 'build',
  HARVEST: 'harvest',
};

export function createGameState() {
  resetUnitIds();
  resetBuildingIds();
  const map = generateMap(Date.now() % 10000);

  const buildings = [
    createBuilding('town_hall', FACTIONS.PLAYER, PLAYER_BASE.x, PLAYER_BASE.y),
    createBuilding('town_hall', FACTIONS.ENEMY, ENEMY_BASE.x, ENEMY_BASE.y),
  ];

  const units = [
    createUnit('warrior', FACTIONS.PLAYER, PLAYER_BASE.x + 1, PLAYER_BASE.y),
    createUnit('archer', FACTIONS.PLAYER, PLAYER_BASE.x, PLAYER_BASE.y + 1),
    createUnit('worker', FACTIONS.PLAYER, PLAYER_BASE.x + 1, PLAYER_BASE.y + 1),
    createUnit('warrior', FACTIONS.ENEMY, ENEMY_BASE.x - 1, ENEMY_BASE.y),
    createUnit('archer', FACTIONS.ENEMY, ENEMY_BASE.x, ENEMY_BASE.y + 1),
    createUnit('worker', FACTIONS.ENEMY, ENEMY_BASE.x - 1, ENEMY_BASE.y + 1),
  ];

  return {
    map,
    units,
    buildings,
    currentFaction: FACTIONS.PLAYER,
    selectedUnitId: null,
    selectedBuildingType: null,
    actionMode: ACTION_MODES.NONE,
    resources: {
      [FACTIONS.PLAYER]: { ...STARTING_RESOURCES },
      [FACTIONS.ENEMY]: { ...STARTING_RESOURCES },
    },
    income: {
      [FACTIONS.PLAYER]: calculateFactionIncome({ buildings, map }, FACTIONS.PLAYER),
      [FACTIONS.ENEMY]: calculateFactionIncome({ buildings, map }, FACTIONS.ENEMY),
    },
    reachableTiles: [],
    attackableTiles: [],
    buildableTiles: [],
    gameOver: false,
    winner: null,
    log: [
      'Build farms and mines near resource nodes for bonus income.',
      'Workers can harvest gold and food from resource tiles.',
      'Destroy the enemy Town Hall to win!',
    ],
  };
}

export function getUnitAt(state, x, y) {
  return state.units.find((u) => u.x === x && y === y && u.hp > 0) ?? null;
}

export function getBuildingAt(state, x, y) {
  return state.buildings.find((b) => b.x === x && y === y && b.hp > 0) ?? null;
}

export function getSelectedUnit(state) {
  if (!state.selectedUnitId) return null;
  return state.units.find((u) => u.id === state.selectedUnitId) ?? null;
}

export function getFactionBuildings(state, faction, type = null) {
  return state.buildings.filter(
    (b) => b.faction === faction && b.hp > 0 && (!type || b.type === type)
  );
}

export function hasBarracks(state, faction) {
  return getFactionBuildings(state, faction, 'barracks').length > 0;
}

export function getOccupiedPositions(state, excludeUnitId = null) {
  const set = new Set();
  for (const unit of state.units) {
    if (unit.hp > 0 && unit.id !== excludeUnitId) {
      set.add(`${unit.x},${unit.y}`);
    }
  }
  for (const building of state.buildings) {
    if (building.hp > 0) set.add(`${building.x},${building.y}`);
  }
  return set;
}

export function manhattanDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function getTownHall(state, faction) {
  return getFactionBuildings(state, faction, 'town_hall')[0] ?? null;
}

export function computeReachableTiles(state, unit) {
  const occupied = getOccupiedPositions(state, unit.id);
  const visited = new Map();
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  visited.set(`${unit.x},${unit.y}`, 0);
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const [dx, dy] of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      const tile = getTile(state.map, nx, ny);
      if (!tile) continue;

      const terrainCost = TERRAIN_COST[tile.terrain] ?? 1;
      const newCost = current.cost + terrainCost;
      if (newCost > unit.moveRange) continue;

      const blocked = occupied.has(key);
      if (blocked && !(nx === unit.x && ny === unit.y)) continue;

      if (!visited.has(key) || newCost < visited.get(key)) {
        visited.set(key, newCost);
        if (!blocked) queue.push({ x: nx, y: ny, cost: newCost });
      }
    }
  }

  const reachable = [];
  for (const [key] of visited) {
    const [x, y] = key.split(',').map(Number);
    if (x !== unit.x || y !== unit.y) {
      if (!occupied.has(key)) reachable.push({ x, y });
    }
  }
  return reachable;
}

export function computeAttackableTiles(state, unit) {
  const targets = [];

  for (const enemy of state.units) {
    if (enemy.faction !== unit.faction && enemy.hp > 0) {
      const dist = manhattanDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist <= unit.attackRange) {
        targets.push({ x: enemy.x, y: enemy.y, kind: 'unit', id: enemy.id });
      }
    }
  }

  for (const building of state.buildings) {
    if (building.faction !== unit.faction && building.hp > 0) {
      const dist = manhattanDistance(unit.x, unit.y, building.x, building.y);
      if (dist <= unit.attackRange) {
        targets.push({ x: building.x, y: building.y, kind: 'building', id: building.id });
      }
    }
  }

  return targets;
}

export function computeBuildableTiles(state, faction, buildingType) {
  const template = BUILDING_TYPES[buildingType];
  if (!template || template.isCore) return [];

  const hall = getTownHall(state, faction);
  if (!hall) return [];

  const occupied = getOccupiedPositions(state);
  const tiles = [];

  for (let y = 0; y < state.map.length; y++) {
    for (let x = 0; x < state.map[0].length; x++) {
      if (canBuildAt(state, faction, buildingType, x, y, occupied, hall)) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

export function canBuildAt(state, faction, buildingType, x, y, occupied = null, hall = null) {
  const template = BUILDING_TYPES[buildingType];
  if (!template || template.isCore) return false;

  const tile = getTile(state.map, x, y);
  if (!tile || !template.validTerrain.includes(tile.terrain)) return false;

  const occ = occupied ?? getOccupiedPositions(state);
  if (occ.has(`${x},${y}`)) return false;

  const townHall = hall ?? getTownHall(state, faction);
  if (!townHall) return false;
  if (manhattanDistance(x, y, townHall.x, townHall.y) > template.maxDistanceFromHall) return false;

  if (template.requiresAdjacentTerrain) {
    if (!hasAdjacentTerrain(state.map, x, y, template.requiresAdjacentTerrain, getTile)) {
      return false;
    }
  }

  const resources = state.resources[faction];
  if (!canAfford(resources, template.cost)) return false;

  return true;
}

export function selectUnit(state, unitId) {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.faction !== state.currentFaction || unit.hp <= 0) return false;

  state.selectedUnitId = unitId;
  state.selectedBuildingType = null;
  state.actionMode = ACTION_MODES.NONE;
  state.buildableTiles = [];
  state.reachableTiles = unit.hasMoved ? [] : computeReachableTiles(state, unit);
  state.attackableTiles = unit.hasAttacked ? [] : computeAttackableTiles(state, unit);
  return true;
}

export function setActionMode(state, mode) {
  const unit = getSelectedUnit(state);
  state.buildableTiles = [];

  if (mode === ACTION_MODES.BUILD) {
    state.selectedUnitId = null;
    state.actionMode = state.actionMode === ACTION_MODES.BUILD ? ACTION_MODES.NONE : ACTION_MODES.BUILD;
    if (state.actionMode === ACTION_MODES.BUILD && state.selectedBuildingType) {
      state.buildableTiles = computeBuildableTiles(
        state,
        state.currentFaction,
        state.selectedBuildingType
      );
    }
    return;
  }

  if (!unit) return;

  state.actionMode = state.actionMode === mode ? ACTION_MODES.NONE : mode;

  if (state.actionMode === ACTION_MODES.MOVE) {
    state.reachableTiles = unit.hasMoved ? [] : computeReachableTiles(state, unit);
  } else if (state.actionMode === ACTION_MODES.ATTACK) {
    state.attackableTiles = unit.hasAttacked ? [] : computeAttackableTiles(state, unit);
  } else if (state.actionMode === ACTION_MODES.HARVEST) {
    state.reachableTiles = [];
    state.attackableTiles = [];
  }
}

export function setBuildingType(state, buildingType) {
  state.selectedBuildingType = buildingType;
  state.selectedUnitId = null;
  state.actionMode = ACTION_MODES.BUILD;
  state.buildableTiles = computeBuildableTiles(state, state.currentFaction, buildingType);
}

export function moveUnit(state, x, y) {
  const unit = getSelectedUnit(state);
  if (!unit || unit.hasMoved) return false;

  const valid = state.reachableTiles.some((t) => t.x === x && t.y === y);
  if (!valid) return false;

  unit.x = x;
  unit.y = y;
  unit.hasMoved = true;
  state.actionMode = ACTION_MODES.NONE;
  state.reachableTiles = [];
  state.attackableTiles = unit.hasAttacked ? [] : computeAttackableTiles(state, unit);
  state.log.unshift(`${UNIT_TYPES[unit.type].name} moved to (${x}, ${y})`);
  return true;
}

export function attackTarget(state, targetX, targetY) {
  const unit = getSelectedUnit(state);
  if (!unit || unit.hasAttacked) return false;

  const targetUnit = getUnitAt(state, targetX, targetY);
  const targetBuilding = getBuildingAt(state, targetX, targetY);

  if (targetUnit && targetUnit.faction !== unit.faction) {
    const dist = manhattanDistance(unit.x, unit.y, targetUnit.x, targetUnit.y);
    if (dist > unit.attackRange) return false;

    const damage = getDamage(unit, targetUnit);
    targetUnit.hp -= damage;
    unit.hasAttacked = true;
    finalizeAttack(state, unit);

    if (targetUnit.hp <= 0) {
      state.log.unshift(`${UNIT_TYPES[unit.type].name} killed ${UNIT_TYPES[targetUnit.type].name}! (${damage} dmg)`);
    } else {
      state.log.unshift(`${UNIT_TYPES[unit.type].name} hit ${UNIT_TYPES[targetUnit.type].name} for ${damage}`);
    }
    checkVictory(state);
    return true;
  }

  if (targetBuilding && targetBuilding.faction !== unit.faction) {
    const dist = manhattanDistance(unit.x, unit.y, targetBuilding.x, targetBuilding.y);
    if (dist > unit.attackRange) return false;

    const damage = getBuildingDamage(unit);
    targetBuilding.hp -= damage;
    unit.hasAttacked = true;
    finalizeAttack(state, unit);

    const bName = BUILDING_TYPES[targetBuilding.type].name;
    if (targetBuilding.hp <= 0) {
      state.log.unshift(`${UNIT_TYPES[unit.type].name} destroyed ${bName}! (${damage} dmg)`);
      if (targetBuilding.type === 'town_hall') {
        state.gameOver = true;
        state.winner = unit.faction;
        state.log.unshift(
          unit.faction === FACTIONS.PLAYER ? 'Victory! Enemy Town Hall destroyed!' : 'Defeat! Your Town Hall fell!'
        );
      }
    } else {
      state.log.unshift(`${UNIT_TYPES[unit.type].name} hit ${bName} for ${damage}`);
    }
    refreshIncome(state);
    return true;
  }

  return false;
}

function finalizeAttack(state, unit) {
  state.actionMode = ACTION_MODES.NONE;
  state.attackableTiles = [];
}

export function harvestResource(state) {
  const unit = getSelectedUnit(state);
  if (!unit || !unit.canHarvest || unit.hasHarvested) return false;

  const tile = getTile(state.map, unit.x, unit.y);
  if (!tile?.resource) return false;

  const amount = getHarvestAmount(tile.resource);
  const res = state.resources[unit.faction];

  if (tile.resource === RESOURCE_NODES.GOLD) {
    res.gold += amount;
    state.log.unshift(`Worker harvested ${amount} gold`);
  } else {
    res.food += amount;
    state.log.unshift(`Worker harvested ${amount} food`);
  }

  unit.hasHarvested = true;
  state.actionMode = ACTION_MODES.NONE;
  return true;
}

export function buildStructure(state, faction, buildingType, x, y) {
  if (!canBuildAt(state, faction, buildingType, x, y)) return false;

  const template = BUILDING_TYPES[buildingType];
  spendResources(state.resources[faction], template.cost);

  const building = createBuilding(buildingType, faction, x, y);
  state.buildings.push(building);
  state.actionMode = ACTION_MODES.NONE;
  state.buildableTiles = [];
  state.selectedBuildingType = null;
  refreshIncome(state);
  state.log.unshift(`Built ${template.name} at (${x}, ${y})`);
  return true;
}

export function recruitUnit(state, faction, type) {
  const template = UNIT_TYPES[type];
  if (!template) return false;
  if (!hasBarracks(state, faction)) return false;

  const resources = state.resources[faction];
  if (!canAfford(resources, template.cost)) return false;

  const hall = getTownHall(state, faction);
  if (!hall) return false;

  const spawnPositions = getAdjacentFreeTiles(state, hall.x, hall.y);
  if (spawnPositions.length === 0) {
    if (faction === FACTIONS.PLAYER) state.log.unshift('No space near Town Hall to recruit!');
    return false;
  }

  const pos = spawnPositions[0];
  const unit = createUnit(type, faction, pos.x, pos.y);
  state.units.push(unit);
  spendResources(resources, template.cost);
  state.log.unshift(
    `${faction === FACTIONS.PLAYER ? 'Recruited' : 'Enemy recruited'} ${template.name}`
  );
  return true;
}

function getAdjacentFreeTiles(state, x, y) {
  const positions = [];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const occupied = getOccupiedPositions(state);
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (isWalkableTerrain(state.map, nx, ny) && !occupied.has(`${nx},${ny}`)) {
      positions.push({ x: nx, y: ny });
    }
  }
  return positions;
}

function refreshIncome(state) {
  state.income[FACTIONS.PLAYER] = calculateFactionIncome(state, FACTIONS.PLAYER);
  state.income[FACTIONS.ENEMY] = calculateFactionIncome(state, FACTIONS.ENEMY);
}

export function endTurn(state) {
  for (const unit of state.units) {
    if (unit.faction === state.currentFaction) resetUnitTurn(unit);
  }

  state.currentFaction =
    state.currentFaction === FACTIONS.PLAYER ? FACTIONS.ENEMY : FACTIONS.PLAYER;

  const income = calculateFactionIncome(state, state.currentFaction);
  state.resources[state.currentFaction].gold += income.gold;
  state.resources[state.currentFaction].food += income.food;
  state.income[state.currentFaction] = income;

  state.selectedUnitId = null;
  state.selectedBuildingType = null;
  state.actionMode = ACTION_MODES.NONE;
  state.reachableTiles = [];
  state.attackableTiles = [];
  state.buildableTiles = [];

  const factionName = state.currentFaction === FACTIONS.PLAYER ? 'Player' : 'Enemy';
  state.log.unshift(
    `--- ${factionName} turn (+${income.gold}g, +${income.food}f) ---`
  );
}

function checkVictory(state) {
  if (state.gameOver) return;

  const playerHall = getTownHall(state, FACTIONS.PLAYER);
  const enemyHall = getTownHall(state, FACTIONS.ENEMY);

  if (!enemyHall) {
    state.gameOver = true;
    state.winner = FACTIONS.PLAYER;
    state.log.unshift('Victory! Enemy Town Hall destroyed.');
  } else if (!playerHall) {
    state.gameOver = true;
    state.winner = FACTIONS.ENEMY;
    state.log.unshift('Defeat! Your Town Hall was destroyed.');
  }
}

export function handleTileClick(state, x, y) {
  if (state.gameOver) return;

  if (state.actionMode === ACTION_MODES.BUILD && state.selectedBuildingType) {
    if (buildStructure(state, state.currentFaction, state.selectedBuildingType, x, y)) return;
  }

  const clickedUnit = getUnitAt(state, x, y);

  if (state.actionMode === ACTION_MODES.MOVE) {
    if (moveUnit(state, x, y)) return;
  }

  if (state.actionMode === ACTION_MODES.ATTACK) {
    if (attackTarget(state, x, y)) return;
  }

  if (clickedUnit && clickedUnit.faction === state.currentFaction) {
    selectUnit(state, clickedUnit.id);
    return;
  }

  if (clickedUnit && clickedUnit.faction !== state.currentFaction) {
    const unit = getSelectedUnit(state);
    if (unit && !unit.hasAttacked) {
      attackTarget(state, x, y);
    }
    return;
  }

  const clickedBuilding = getBuildingAt(state, x, y);
  if (clickedBuilding && clickedBuilding.faction !== state.currentFaction) {
    const unit = getSelectedUnit(state);
    if (unit && !unit.hasAttacked) {
      attackTarget(state, x, y);
    }
  }
}

export function getMilitaryCount(state, faction) {
  return state.units.filter((u) => u.faction === faction && u.hp > 0 && u.type !== 'worker').length;
}