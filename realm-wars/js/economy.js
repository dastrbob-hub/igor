import { HARVEST_YIELD } from './config.js';
import { getBuildingIncome } from './buildings.js';
import { getTile } from './map.js';

export function calculateFactionIncome(state, faction) {
  let gold = 0;
  let food = 0;

  for (const building of state.buildings) {
    if (building.faction === faction && building.hp > 0) {
      const income = getBuildingIncome(building, state.map, getTile);
      gold += income.gold;
      food += income.food;
    }
  }

  return { gold, food };
}

export function canAfford(resources, cost) {
  return resources.gold >= cost.gold && resources.food >= cost.food;
}

export function spendResources(resources, cost) {
  resources.gold -= cost.gold;
  resources.food -= cost.food;
}

export function getHarvestAmount(resourceType) {
  return HARVEST_YIELD[resourceType] ?? 0;
}