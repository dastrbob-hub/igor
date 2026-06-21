import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, SPRITE_PATHS, TERRAIN } from './config.js';
import { ACTION_MODES } from './game.js';

const spriteCache = new Map();

export async function loadSprites() {
  const paths = new Set();

  for (const path of Object.values(SPRITE_PATHS.terrain)) {
    if (Array.isArray(path)) path.forEach((p) => paths.add(p));
    else paths.add(path);
  }
  for (const path of Object.values(SPRITE_PATHS.resources)) paths.add(path);
  for (const sprites of Object.values(SPRITE_PATHS.buildings)) {
    paths.add(sprites.player);
    paths.add(sprites.enemy);
  }
  for (const sprites of Object.values(SPRITE_PATHS.units)) {
    paths.add(sprites.player);
    paths.add(sprites.enemy);
  }

  const loads = [...paths].map((path) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { spriteCache.set(path, img); resolve(); };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${path}`));
    img.src = path;
  }));

  await Promise.all(loads);
}

export function resizeCanvas(canvas) {
  canvas.width = MAP_WIDTH * TILE_SIZE;
  canvas.height = MAP_HEIGHT * TILE_SIZE;
}

export function render(ctx, state) {
  const {
    map, units, buildings, selectedUnitId,
    reachableTiles, attackableTiles, buildableTiles, actionMode,
  } = state;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const tile = map[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      const terrainPath = getTerrainSpritePath(tile);
      const terrainSprite = spriteCache.get(terrainPath);
      if (terrainSprite) {
        ctx.drawImage(terrainSprite, px, py, TILE_SIZE, TILE_SIZE);
      }

      if (tile.resource) {
        const resSprite = spriteCache.get(SPRITE_PATHS.resources[tile.resource]);
        if (resSprite) {
          ctx.drawImage(resSprite, px + 8, py + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        }
      }
    }
  }

  highlightTiles(ctx, buildableTiles, 'rgba(107, 203, 119, 0.35)', 'rgba(107, 203, 119, 0.85)');
  highlightTiles(ctx, reachableTiles, 'rgba(74, 158, 255, 0.35)', 'rgba(74, 158, 255, 0.75)');
  highlightTiles(ctx, attackableTiles, 'rgba(255, 74, 74, 0.35)', 'rgba(255, 74, 74, 0.85)');

  for (const building of buildings) {
    if (building.hp <= 0) continue;

    const spritePath = SPRITE_PATHS.buildings[building.type][building.faction];
    const sprite = spriteCache.get(spritePath);
    const px = building.x * TILE_SIZE;
    const py = building.y * TILE_SIZE;

    if (sprite) {
      ctx.drawImage(sprite, px, py, TILE_SIZE, TILE_SIZE);
    }

    drawHpBar(ctx, px, py, building.hp, building.maxHp, 6);
  }

  for (const unit of units) {
    if (unit.hp <= 0) continue;

    const spritePath = SPRITE_PATHS.units[unit.type][unit.faction];
    const sprite = spriteCache.get(spritePath);
    const px = unit.x * TILE_SIZE;
    const py = unit.y * TILE_SIZE;

    if (sprite) {
      ctx.drawImage(sprite, px + 8, py + 6, TILE_SIZE - 16, TILE_SIZE - 12);
    }

    if (unit.id === selectedUnitId) {
      ctx.strokeStyle = '#f4c542';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }

    if (unit.hasMoved && unit.hasAttacked && unit.hasHarvested) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    } else if (unit.hasMoved && unit.hasAttacked) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }

    drawHpBar(ctx, px, py, unit.hp, unit.maxHp, 5);
  }

  drawModeHint(ctx, actionMode, state.selectedBuildingType);
}

function getTerrainSpritePath(tile) {
  const entry = SPRITE_PATHS.terrain[tile.terrain];
  if (Array.isArray(entry)) {
    return entry[tile.variant % entry.length];
  }
  return entry;
}

function highlightTiles(ctx, tiles, fill, stroke) {
  for (const tile of tiles) {
    const px = tile.x * TILE_SIZE;
    const py = tile.y * TILE_SIZE;
    ctx.fillStyle = fill;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }
}

function drawHpBar(ctx, x, y, hp, maxHp, height) {
  const barWidth = TILE_SIZE - 10;
  const barX = x + 5;
  const barY = y + TILE_SIZE - height - 5;
  const ratio = Math.max(0, hp / maxHp);

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, height + 2);

  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, height);

  const color = ratio > 0.5 ? '#6bcb77' : ratio > 0.25 ? '#f4c542' : '#ff4a4a';
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, barWidth * ratio, height);
}

function drawModeHint(ctx, actionMode, buildingType) {
  const hints = {
    [ACTION_MODES.MOVE]: { text: 'MOVE', color: '#4a9eff' },
    [ACTION_MODES.ATTACK]: { text: 'ATTACK', color: '#ff4a4a' },
    [ACTION_MODES.BUILD]: { text: buildingType ? `BUILD: ${buildingType}` : 'BUILD', color: '#6bcb77' },
    [ACTION_MODES.HARVEST]: { text: 'HARVEST', color: '#f4c542' },
  };

  const hint = hints[actionMode];
  if (!hint) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(6, 6, 200, 28);
  ctx.fillStyle = hint.color;
  ctx.font = 'bold 14px Segoe UI, sans-serif';
  ctx.fillText(hint.text.toUpperCase(), 14, 25);
}