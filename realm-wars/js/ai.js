import { FACTIONS, RESOURCE_NODES } from './config.js';
import {
  selectUnit,
  setActionMode,
  moveUnit,
  attackTarget,
  endTurn,
  manhattanDistance,
  computeReachableTiles,
  computeAttackableTiles,
  computeBuildableTiles,
  buildStructure,
  recruitUnit,
  harvestResource,
  hasBarracks,
  getFactionBuildings,
  getTownHall,
  getMilitaryCount,
  getUnitAt,
  ACTION_MODES,
} from './game.js';
import { BUILDING_TYPES } from './buildings.js';
import { UNIT_TYPES } from './units.js';
import { canAfford } from './economy.js';
import { getTile } from './map.js';

export async function runEnemyTurn(state, onUpdate) {
  if (state.currentFaction !== FACTIONS.ENEMY || state.gameOver) return;

  await runEconomyPhase(state, onUpdate);
  if (state.gameOver) return;

  await runMilitaryPhase(state, onUpdate);

  endTurn(state);
  onUpdate();
}

async function runEconomyPhase(state, onUpdate) {
  const faction = FACTIONS.ENEMY;
  const resources = state.resources[faction];

  if (!hasBarracks(state, faction)) {
    const spot = findBestBuildSpot(state, faction, 'barracks');
    if (spot && canAfford(resources, BUILDING_TYPES.barracks.cost)) {
      buildStructure(state, faction, 'barracks', spot.x, spot.y);
      onUpdate();
      await delay(350);
    }
  }

  const farms = getFactionBuildings(state, faction, 'farm').length;
  const mines = getFactionBuildings(state, faction, 'mine').length;
  const workers = state.units.filter((u) => u.faction === faction && u.type === 'worker' && u.hp > 0).length;

  if (farms < 2) {
    const spot = findBestBuildSpot(state, faction, 'farm');
    if (spot && canAfford(resources, BUILDING_TYPES.farm.cost)) {
      buildStructure(state, faction, 'farm', spot.x, spot.y);
      onUpdate();
      await delay(350);
    }
  }

  if (mines < 2) {
    const spot = findBestBuildSpot(state, faction, 'mine');
    if (spot && canAfford(resources, BUILDING_TYPES.mine.cost)) {
      buildStructure(state, faction, 'mine', spot.x, spot.y);
      onUpdate();
      await delay(350);
    }
  }

  const playerMilitary = getMilitaryCount(state, FACTIONS.PLAYER);
  const enemyMilitary = getMilitaryCount(state, faction);
  const targetArmySize = Math.max(3, playerMilitary + 1);

  if (hasBarracks(state, faction)) {
    const recruitOrder = pickRecruitOrder(enemyMilitary, playerMilitary);
    for (const type of recruitOrder) {
      if (getMilitaryCount(state, faction) >= targetArmySize) break;
      if (canAfford(state.resources[faction], UNIT_TYPES[type].cost)) {
        if (recruitUnit(state, faction, type)) {
          onUpdate();
          await delay(300);
        }
      }
    }
  }

  if (workers < 2 && canAfford(resources, UNIT_TYPES.worker.cost) && hasBarracks(state, faction)) {
    recruitUnit(state, faction, 'worker');
    onUpdate();
    await delay(250);
  }

  const workerUnits = state.units.filter(
    (u) => u.faction === faction && u.type === 'worker' && u.hp > 0
  );

  for (const worker of workerUnits) {
    if (worker.hasHarvested) continue;

    const currentTile = getTile(state.map, worker.x, worker.y);
    if (!currentTile?.resource) {
      const resourceTile = findNearestResource(state, worker.x, worker.y, faction);
      if (resourceTile && !worker.hasMoved) {
        selectUnit(state, worker.id);
        const reachable = computeReachableTiles(state, worker);
        const step = reachable.find((t) => t.x === resourceTile.x && t.y === resourceTile.y)
          ?? reachable.sort((a, b) => {
            const da = manhattanDistance(a.x, a.y, resourceTile.x, resourceTile.y);
            const db = manhattanDistance(b.x, b.y, resourceTile.x, resourceTile.y);
            return da - db;
          })[0];

        if (step) {
          setActionMode(state, ACTION_MODES.MOVE);
          moveUnit(state, step.x, step.y);
          onUpdate();
          await delay(250);
        }
      }
    }

    selectUnit(state, worker.id);
    const tile = getTile(state.map, worker.x, worker.y);
    if (tile?.resource) {
      harvestResource(state);
      onUpdate();
      await delay(300);
    }
  }

  state.selectedUnitId = null;
  state.actionMode = ACTION_MODES.NONE;
  onUpdate();
}

async function runMilitaryPhase(state, onUpdate) {
  const faction = FACTIONS.ENEMY;
  const playerHall = getTownHall(state, FACTIONS.PLAYER);

  const militaryUnits = state.units
    .filter((u) => u.faction === faction && u.hp > 0 && u.type !== 'worker')
    .sort((a, b) => {
      const score = (u) => UNIT_TYPES[u.type].attack + UNIT_TYPES[u.type].attackRange;
      return score(b) - score(a);
    });

  for (const unit of militaryUnits) {
    if (state.gameOver) break;

    selectUnit(state, unit.id);
    onUpdate();

    const attackTargets = computeAttackableTiles(state, unit);

    if (attackTargets.length > 0 && !unit.hasAttacked) {
      const target = pickBestTarget(state, attackTargets, playerHall);
      setActionMode(state, ACTION_MODES.ATTACK);
      attackTarget(state, target.x, target.y);
      onUpdate();
      await delay(400);
      continue;
    }

    if (!unit.hasMoved) {
      const moveTarget = findBestMilitaryMove(state, unit, playerHall);
      if (moveTarget) {
        setActionMode(state, ACTION_MODES.MOVE);
        moveUnit(state, moveTarget.x, moveTarget.y);
        onUpdate();
        await delay(300);

        const newTargets = computeAttackableTiles(state, unit);
        if (newTargets.length > 0 && !unit.hasAttacked) {
          const target = pickBestTarget(state, newTargets, playerHall);
          attackTarget(state, target.x, target.y);
          onUpdate();
          await delay(400);
        }
      }
    }

    state.selectedUnitId = null;
    state.actionMode = ACTION_MODES.NONE;
    onUpdate();
    await delay(150);
  }
}

function findBestBuildSpot(state, faction, buildingType) {
  const spots = computeBuildableTiles(state, faction, buildingType);
  if (spots.length === 0) return null;

  const hall = getTownHall(state, faction);
  const template = BUILDING_TYPES[buildingType];

  return spots.sort((a, b) => scoreBuildSpot(state, b, template) - scoreBuildSpot(state, a, template))[0];
}

function scoreBuildSpot(state, spot, template) {
  let score = 0;
  const tile = getTile(state.map, spot.x, spot.y);

  if (template.bonusNearResource && tile) {
    const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
    for (const [dx, dy] of dirs) {
      const adj = getTile(state.map, spot.x + dx, spot.y + dy);
      if (adj?.resource === template.bonusNearResource.resource) score += 20;
    }
  }

  const playerHall = getTownHall(state, FACTIONS.PLAYER);
  if (playerHall) {
    score -= manhattanDistance(spot.x, spot.y, playerHall.x, playerHall.y) * 0.5;
  }

  return score;
}

function findNearestResource(state, x, y, faction) {
  const hall = getTownHall(state, faction);
  let best = null;
  let bestDist = Infinity;

  for (const row of state.map) {
    for (const tile of row) {
      if (!tile.resource) continue;
      const dist = manhattanDistance(x, y, tile.x, tile.y);
      const hallDist = hall ? manhattanDistance(tile.x, tile.y, hall.x, hall.y) : 0;
      const score = dist + hallDist * 0.3;
      if (score < bestDist) {
        bestDist = score;
        best = tile;
      }
    }
  }
  return best;
}

function pickRecruitOrder(enemyMilitary, playerMilitary) {
  if (enemyMilitary < playerMilitary) {
    return ['warrior', 'archer', 'scout', 'worker'];
  }
  return ['archer', 'warrior', 'scout', 'worker'];
}

function pickBestTarget(state, targets, playerHall) {
  let best = targets[0];
  let bestScore = -Infinity;

  for (const t of targets) {
    let score = 0;
    if (t.kind === 'building') {
      const building = state.buildings.find((b) => b.id === t.id);
      if (building?.type === 'town_hall') score += 100;
      else if (building?.type === 'barracks') score += 40;
      else score += 20;
      score += (building?.maxHp ?? 0) - (building?.hp ?? 0);
    } else {
      const unit = getUnitAt(state, t.x, t.y);
      if (unit) {
        score += UNIT_TYPES[unit.type].attack * 2;
        score += (unit.maxHp - unit.hp);
        if (unit.type === 'archer') score += 15;
      }
    }

    if (playerHall) {
      score += 8 - manhattanDistance(t.x, t.y, playerHall.x, playerHall.y);
    }

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function findBestMilitaryMove(state, unit, playerHall) {
  const reachable = computeReachableTiles(state, unit);
  if (reachable.length === 0) return null;

  const playerUnits = state.units.filter((u) => u.faction === FACTIONS.PLAYER && u.hp > 0);
  const playerBuildings = state.buildings.filter(
    (b) => b.faction === FACTIONS.PLAYER && b.hp > 0
  );

  let bestTile = null;
  let bestScore = -Infinity;

  for (const tile of reachable) {
    let score = 0;

    if (playerHall) {
      const hallDist = manhattanDistance(tile.x, tile.y, playerHall.x, playerHall.y);
      score += (20 - hallDist) * 2;
    }

    for (const enemy of playerUnits) {
      const dist = manhattanDistance(tile.x, tile.y, enemy.x, enemy.y);
      if (dist <= unit.attackRange) score += 25;
      score += (12 - dist) * 0.8;
    }

    for (const building of playerBuildings) {
      const dist = manhattanDistance(tile.x, tile.y, building.x, building.y);
      if (dist <= unit.attackRange) {
        score += building.type === 'town_hall' ? 50 : 20;
      }
    }

    if (UNIT_TYPES[unit.type].attackRange >= 2) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestTile = tile;
    }
  }

  return bestTile;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}