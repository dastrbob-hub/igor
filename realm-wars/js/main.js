import { FACTIONS } from './config.js';
import {
  createGameState,
  handleTileClick,
  endTurn,
  setActionMode,
  setBuildingType,
  recruitUnit,
  harvestResource,
  ACTION_MODES,
} from './game.js';
import { loadSprites, resizeCanvas, render, screenToTile } from './renderer.js';
import { initUI, updateUI } from './ui.js';
import { runEnemyTurn } from './ai.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const elements = {
  goldCount: document.getElementById('gold-count'),
  foodCount: document.getElementById('food-count'),
  incomeGold: document.getElementById('income-gold'),
  incomeFood: document.getElementById('income-food'),
  turnInfo: document.getElementById('turn-info'),
  unitInfo: document.getElementById('unit-info'),
  gameLog: document.getElementById('game-log'),
  endTurnBtn: document.getElementById('end-turn-btn'),
  moveBtn: document.getElementById('move-btn'),
  attackBtn: document.getElementById('attack-btn'),
  harvestBtn: document.getElementById('harvest-btn'),
  buildBtns: [...document.querySelectorAll('[data-building]')],
  recruitBtns: [...document.querySelectorAll('[data-unit]')],
  restartBtn: document.getElementById('restart-btn'),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayMessage: document.getElementById('overlay-message'),
};

let state = createGameState();
let aiRunning = false;

function refresh() {
  render(ctx, state);
  updateUI(state, elements);
}

async function init() {
  resizeCanvas(canvas);
  await loadSprites();

  initUI(elements, {
    onEndTurn: handleEndTurn,
    onSetMode: (mode) => {
      if (state.currentFaction !== FACTIONS.PLAYER || state.gameOver) return;
      setActionMode(state, mode);
      refresh();
    },
    onBuild: (buildingType) => {
      if (state.currentFaction !== FACTIONS.PLAYER || state.gameOver) return;
      if (state.actionMode === ACTION_MODES.BUILD && state.selectedBuildingType === buildingType) {
        setActionMode(state, ACTION_MODES.NONE);
        state.selectedBuildingType = null;
        state.buildableTiles = [];
      } else {
        setBuildingType(state, buildingType);
      }
      refresh();
    },
    onRecruit: (unitType) => {
      if (recruitUnit(state, FACTIONS.PLAYER, unitType)) refresh();
    },
    onHarvest: () => {
      if (harvestResource(state)) refresh();
    },
    onRestart: () => {
      state = createGameState();
      aiRunning = false;
      refresh();
    },
  });

  canvas.addEventListener('click', (e) => {
    if (state.currentFaction !== FACTIONS.PLAYER || state.gameOver || aiRunning) return;
    const { x, y } = screenToTile(canvas, e.clientX, e.clientY);
    handleTileClick(state, x, y);
    refresh();
  });

  refresh();
}

async function handleEndTurn() {
  if (state.gameOver || state.currentFaction !== FACTIONS.PLAYER || aiRunning) return;

  endTurn(state);
  refresh();

  if (state.currentFaction === FACTIONS.ENEMY && !state.gameOver) {
    aiRunning = true;
    elements.endTurnBtn.disabled = true;
    await runEnemyTurn(state, refresh);
    aiRunning = false;
  }
}

init().catch((err) => {
  console.error('Failed to initialize game:', err);
  elements.unitInfo.innerHTML = `<p style="color:#ff4a4a">Error: ${err.message}</p>`;
});