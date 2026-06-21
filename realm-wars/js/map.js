import { MAP_WIDTH, MAP_HEIGHT, TERRAIN, RESOURCE_NODES, PLAYER_BASE, ENEMY_BASE, GRASS_VARIANTS } from './config.js';

const TERRAIN_WEIGHTS = [
  { type: TERRAIN.GRASS, weight: 48 },
  { type: TERRAIN.FOREST, weight: 24 },
  { type: TERRAIN.MOUNTAIN, weight: 13 },
  { type: TERRAIN.WATER, weight: 15 },
];

function pickTerrain(rng) {
  const total = TERRAIN_WEIGHTS.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng() * total;
  for (const entry of TERRAIN_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return TERRAIN.GRASS;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function clearArea(tiles, cx, cy, radius, rng) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT) {
        tiles[y][x].terrain = TERRAIN.GRASS;
        tiles[y][x].resource = null;
        tiles[y][x].variant = Math.floor(rng() * GRASS_VARIANTS);
      }
    }
  }
}

function placeResourceNodes(tiles, rng) {
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = tiles[y][x];
      if (tile.terrain === TERRAIN.MOUNTAIN && rng() < 0.45) {
        tile.resource = RESOURCE_NODES.GOLD;
      } else if (tile.terrain === TERRAIN.FOREST && rng() < 0.38) {
        tile.resource = RESOURCE_NODES.FOOD;
      }
    }
  }
}

export function generateMap(seed = 42) {
  const rng = seededRandom(seed);
  const tiles = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const terrain = pickTerrain(rng);
      row.push({
        terrain,
        resource: null,
        variant: terrain === TERRAIN.GRASS ? Math.floor(rng() * GRASS_VARIANTS) : 0,
        x,
        y,
      });
    }
    tiles.push(row);
  }

  placeResourceNodes(tiles, rng);
  clearArea(tiles, PLAYER_BASE.x, PLAYER_BASE.y, 2, rng);
  clearArea(tiles, ENEMY_BASE.x, ENEMY_BASE.y, 2, rng);

  return tiles;
}

export function getTile(map, x, y) {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
  return map[y][x];
}

export function isWalkableTerrain(map, x, y) {
  const tile = getTile(map, x, y);
  if (!tile) return false;
  return tile.terrain !== TERRAIN.WATER && tile.terrain !== TERRAIN.MOUNTAIN;
}