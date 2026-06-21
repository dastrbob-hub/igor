import { FACTIONS } from './config.js';
import { ACTION_MODES, getSelectedUnit } from './game.js';
import { BUILDING_TYPES } from './buildings.js';
import { UNIT_TYPES } from './units.js';
import { canAfford } from './economy.js';

export function initUI(elements, callbacks) {
  elements.endTurnBtn.addEventListener('click', callbacks.onEndTurn);
  elements.moveBtn.addEventListener('click', () => callbacks.onSetMode(ACTION_MODES.MOVE));
  elements.attackBtn.addEventListener('click', () => callbacks.onSetMode(ACTION_MODES.ATTACK));
  elements.harvestBtn.addEventListener('click', callbacks.onHarvest);
  elements.restartBtn.addEventListener('click', callbacks.onRestart);

  for (const btn of elements.buildBtns) {
    btn.addEventListener('click', () => callbacks.onBuild(btn.dataset.building));
  }

  for (const btn of elements.recruitBtns) {
    btn.addEventListener('click', () => callbacks.onRecruit(btn.dataset.unit));
  }
}

export function updateUI(state, elements) {
  const playerRes = state.resources[FACTIONS.PLAYER];
  const playerIncome = state.income[FACTIONS.PLAYER];
  const isPlayerTurn = state.currentFaction === FACTIONS.PLAYER;

  elements.goldCount.textContent = playerRes.gold;
  elements.foodCount.textContent = playerRes.food;
  elements.incomeGold.textContent = `+${playerIncome.gold}`;
  elements.incomeFood.textContent = `+${playerIncome.food}`;

  elements.turnInfo.textContent = isPlayerTurn ? 'Your turn' : 'Enemy turn...';
  elements.turnInfo.classList.toggle('turn-info--enemy', !isPlayerTurn);
  elements.endTurnBtn.disabled = !isPlayerTurn || state.gameOver;

  const unit = getSelectedUnit(state);
  if (unit) {
    const type = UNIT_TYPES[unit.type];
    elements.unitInfo.className = 'unit-info';
    elements.unitInfo.innerHTML = `
      <div class="unit-info__name">${type.name}</div>
      <div class="unit-info__stat"><span>HP</span><span>${unit.hp} / ${unit.maxHp}</span></div>
      <div class="unit-info__stat"><span>Attack</span><span>${unit.attack}</span></div>
      <div class="unit-info__stat"><span>Defense</span><span>${unit.defense}</span></div>
      <div class="unit-info__stat"><span>Move</span><span>${unit.moveRange}</span></div>
      <div class="unit-info__stat"><span>Range</span><span>${unit.attackRange}</span></div>
      <div class="unit-info__hp-bar">
        <div class="unit-info__hp-fill" style="width: ${(unit.hp / unit.maxHp) * 100}%"></div>
      </div>
    `;

    elements.moveBtn.disabled = !isPlayerTurn || unit.hasMoved || state.gameOver;
    elements.attackBtn.disabled = !isPlayerTurn || unit.hasAttacked || state.gameOver;
    elements.harvestBtn.disabled = !isPlayerTurn || !unit.canHarvest || unit.hasHarvested || state.gameOver;

    elements.moveBtn.classList.toggle('btn--active', state.actionMode === ACTION_MODES.MOVE);
    elements.attackBtn.classList.toggle('btn--active', state.actionMode === ACTION_MODES.ATTACK);
    elements.harvestBtn.classList.toggle('btn--active', state.actionMode === ACTION_MODES.HARVEST);
  } else {
    elements.unitInfo.className = 'unit-info unit-info--empty';
    elements.unitInfo.innerHTML = '<p>Click a unit to inspect</p>';
    elements.moveBtn.disabled = true;
    elements.attackBtn.disabled = true;
    elements.harvestBtn.disabled = true;
    elements.moveBtn.classList.remove('btn--active');
    elements.attackBtn.classList.remove('btn--active');
    elements.harvestBtn.classList.remove('btn--active');
  }

  for (const btn of elements.buildBtns) {
    const type = btn.dataset.building;
    const template = BUILDING_TYPES[type];
    const affordable = canAfford(playerRes, template.cost);
    btn.disabled = !isPlayerTurn || !affordable || state.gameOver;
    btn.textContent = `${template.name} (${template.cost.gold}g ${template.cost.food}f)`;
    btn.classList.toggle('btn--active', state.actionMode === ACTION_MODES.BUILD && state.selectedBuildingType === type);
  }

  const hasBarracks = state.buildings.some(
    (b) => b.faction === FACTIONS.PLAYER && b.type === 'barracks' && b.hp > 0
  );

  for (const btn of elements.recruitBtns) {
    const type = btn.dataset.unit;
    const template = UNIT_TYPES[type];
    const affordable = canAfford(playerRes, template.cost);
    btn.disabled = !isPlayerTurn || !hasBarracks || !affordable || state.gameOver;
    btn.textContent = `${template.name} (${template.cost.gold}g ${template.cost.food}f)`;
  }

  elements.gameLog.innerHTML = state.log
    .slice(0, 25)
    .map((entry) => `<li>${entry}</li>`)
    .join('');

  if (state.gameOver) {
    elements.overlay.classList.remove('overlay--hidden');
    if (state.winner === FACTIONS.PLAYER) {
      elements.overlayTitle.textContent = 'Victory!';
      elements.overlayMessage.textContent = 'Enemy Town Hall destroyed. The realm is yours!';
    } else {
      elements.overlayTitle.textContent = 'Defeat';
      elements.overlayMessage.textContent = 'Your Town Hall fell. Build faster next time!';
    }
  } else {
    elements.overlay.classList.add('overlay--hidden');
  }
}