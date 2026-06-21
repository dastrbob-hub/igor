import { TERRAIN, RESOURCE_NODES } from './config.js';

let nextBuildingId = 1;

export const BUILDING_TYPES = {
  town_hall: {
    name: 'Town Hall',
    hp: 300,
    cost: { gold: 0, food: 0 },
    income: { gold: 10, food: 10 },
    validTerrain: [TERRAIN.GRASS],
    isCore: true,
  },
  barracks: {
    name: 'Barracks',
    hp: 140,
    cost: { gold: 90, food: 50 },
    income: { gold: 0, food: 0 },
    validTerrain: [TERRAIN.GRASS, TERRAIN.FOREST],
    maxDistanceFromHall: 4,
    unlocksRecruitment: true,
  },
  farm: {
    name: 'Farm',
    hp: 90,
    cost: { gold: 70, food: 40 },
    income: { gold: 0, food: 14 },
    bonusNearResource: { resource: RESOURCE_NODES.FOOD, income: { gold: 0, food: 10 } },
    validTerrain: [TERRAIN.GRASS],
    maxDistanceFromHall: 5,
  },
  mine: {
    name: 'Mine',
    hp: 110,
    cost: { gold: 80, food: 45 },
    income: { gold: 16, food: 0 },
    bonusNearResource: { resource: RESOURCE_NODES.GOLD, income: { gold: 12, food: 0 } },
    validTerrain: [TERRAIN.GRASS, TERRAIN.FOREST],
    requiresAdjacentTerrain: [TERRAIN.MOUNTAIN],
    maxDistanceFromHall: 6,
  },
};

export function createBuilding(type, faction, x, y) {
  const template = BUILDING_TYPES[type];
  return {
    id: nextBuildingId++,
    type,
    faction,
    x,
    y,
    hp: template.hp,
    maxHp: template.hp,
  };
}

export function resetBuildingIds() {
  nextBuildingId = 1;
}

export function getBuildingIncome(building, map, getTileFn) {
  const template = BUILDING_TYPES[building.type];
  let gold = template.income?.gold ?? 0;
  let food = template.income?.food ?? 0;

  if (template.bonusNearResource) {
    const { resource, income } = template.bonusNearResource;
    if (hasAdjacentResource(map, building.x, building.y, resource, getTileFn)) {
      gold += income.gold ?? 0;
      food += income.food ?? 0;
    }
  }

  return { gold, food };
}

function hasAdjacentResource(map, x, y, resource, getTileFn) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, 1]];
  for (const [dx, dy] of dirs) {
    const tile = getTileFn(map, x + dx, y + dy);
    if (tile?.resource === resource) return true;
  }
  return false;
}

export function hasAdjacentTerrain(map, x, y, terrains, getTileFn) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const tile = getTileFn(map, x + dx, y + dy);
    if (tile && terrains.includes(tile.terrain)) return true;
  }
  return false;
}