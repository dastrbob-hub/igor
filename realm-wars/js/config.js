export const TILE_SIZE = 64;
export const MAP_WIDTH = 18;
export const MAP_HEIGHT = 12;

export const FACTIONS = {
  PLAYER: 'player',
  ENEMY: 'enemy',
};

export const TERRAIN = {
  GRASS: 'grass',
  WATER: 'water',
  FOREST: 'forest',
  MOUNTAIN: 'mountain',
};

export const RESOURCE_NODES = {
  GOLD: 'gold',
  FOOD: 'food',
};

export const TERRAIN_COST = {
  [TERRAIN.GRASS]: 1,
  [TERRAIN.WATER]: 99,
  [TERRAIN.FOREST]: 2,
  [TERRAIN.MOUNTAIN]: 3,
};

export const STARTING_RESOURCES = { gold: 120, food: 80 };

export const HARVEST_YIELD = {
  [RESOURCE_NODES.GOLD]: 18,
  [RESOURCE_NODES.FOOD]: 14,
};

export const GRASS_VARIANTS = 3;

export const SPRITE_PATHS = {
  terrain: {
    [TERRAIN.GRASS]: [
      'assets/sprites/terrain_grass_1.svg',
      'assets/sprites/terrain_grass_2.svg',
      'assets/sprites/terrain_grass_3.svg',
    ],
    [TERRAIN.WATER]: 'assets/sprites/terrain_water.svg',
    [TERRAIN.FOREST]: 'assets/sprites/terrain_forest.svg',
    [TERRAIN.MOUNTAIN]: 'assets/sprites/terrain_mountain.svg',
  },
  resources: {
    [RESOURCE_NODES.GOLD]: 'assets/sprites/resource_gold.svg',
    [RESOURCE_NODES.FOOD]: 'assets/sprites/resource_food.svg',
  },
  buildings: {
    town_hall: { player: 'assets/sprites/building_town_hall_blue.svg', enemy: 'assets/sprites/building_town_hall_red.svg' },
    barracks: { player: 'assets/sprites/building_barracks_blue.svg', enemy: 'assets/sprites/building_barracks_red.svg' },
    farm: { player: 'assets/sprites/building_farm_blue.svg', enemy: 'assets/sprites/building_farm_red.svg' },
    mine: { player: 'assets/sprites/building_mine_blue.svg', enemy: 'assets/sprites/building_mine_red.svg' },
  },
  units: {
    warrior: { player: 'assets/sprites/unit_warrior_blue.svg', enemy: 'assets/sprites/unit_warrior_red.svg' },
    archer: { player: 'assets/sprites/unit_archer_blue.svg', enemy: 'assets/sprites/unit_archer_red.svg' },
    scout: { player: 'assets/sprites/unit_scout_blue.svg', enemy: 'assets/sprites/unit_scout_red.svg' },
    worker: { player: 'assets/sprites/unit_worker_blue.svg', enemy: 'assets/sprites/unit_worker_red.svg' },
  },
};

export const PLAYER_BASE = { x: 2, y: MAP_HEIGHT - 3 };
export const ENEMY_BASE = { x: MAP_WIDTH - 3, y: 2 };