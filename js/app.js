import { State, applyAction, getLegalActions } from './logic.js';
import { DIFFICULTIES } from './mcts.js';
import { drawPiece } from './pieceView.js';
import { theme } from './theme.js';

// ---------------------------------------------------------------- layout
const BOARD_FRAME = 10;
const BOARD_CELL = 88;
const BOARD_GAP = 4;
const BOARD_PIX = BOARD_FRAME * 2 + BOARD_CELL * 4;

const POOL_FRAME = 8;
const POOL_CELL = 48;
const POOL_GAP = 4;
const POOL_PIX = POOL_FRAME * 2 + POOL_CELL * 4;

const HAND_PIX = 96;

// ---------------------------------------------------------------- DOM refs
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const modeToggle = document.getElementById('mode-toggle');
const firstToggle = document.getElementById('first-toggle');
const computerOptions = document.getElementById('computer-options');
const difficultySelect = document.getElementById('difficulty-select');
const startBtn = document.getElementById('start-btn');

const statusBadge = document.getElementById('status-badge');
const infoBtn = document.getElementById('info-btn');
const boardCanvas = document.getElementById('board-canvas');
const handCanvas = document.getElementById('hand-canvas');
const poolCanvas = document.getElementById('pool-canvas');
const thinkLabel = document.getElementById('think-label');
const newGameBtn = document.getElementById('new-game-btn');

const legendDialog = document.getElementById('legend-dialog');
const legendCanvas = document.getElementById('legend-canvas');
const legendCloseBtn = document.getElementById('legend-close-btn');

boardCanvas.width = BOARD_PIX;
boardCanvas.height = BOARD_PIX;
handCanvas.width = HAND_PIX;
handCanvas.height = HAND_PIX;
poolCanvas.width = POOL_PIX;
poolCanvas.height = POOL_PIX;

// ---------------------------------------------------------------- canvas helper
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---------------------------------------------------------------- app state
let state = null;
let vsComputer = true;
let humanPlayer = 0;
let computerPlayer = 1;
let thinking = false;
let mode = 'two_players';
let firstChoice = 'human';

const worker = new Worker('js/worker.js', { type: 'module' });
let pendingResolve = null;
worker.onmessage = (event) => {
  if (pendingResolve) {
    const resolve = pendingResolve;
    pendingResolve = null;
    resolve(event.data.action);
  }
};

// ---------------------------------------------------------------- setup screen
function setupSegmented(container, onChange) {
  container.querySelectorAll('.segment').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.segment').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.value);
    });
  });
}

setupSegmented(modeToggle, (value) => {
  mode = value;
  computerOptions.classList.toggle('disabled', mode !== 'computer');
});

setupSegmented(firstToggle, (value) => {
  firstChoice = value;
});

startBtn.addEventListener('click', startGame);
newGameBtn.addEventListener('click', backToMenu);
infoBtn.addEventListener('click', () => legendDialog.showModal());
legendCloseBtn.addEventListener('click', () => legendDialog.close());

function startGame() {
  vsComputer = mode === 'computer';
  if (vsComputer) {
    humanPlayer = firstChoice === 'human' ? 0 : 1;
    computerPlayer = 1 - humanPlayer;
  }
  state = State.newGame();
  setupScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  render();
  maybeTriggerComputer();
}

function backToMenu() {
  if (legendDialog.open) legendDialog.close();
  gameScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
}

// ---------------------------------------------------------------- drawing
function playerName(p) {
  if (vsComputer) return p === humanPlayer ? 'Vous' : "L'ordinateur";
  return `Joueur ${p + 1}`;
}

function render() {
  drawBoard();
  drawHand();
  drawPool();
  updateStatus();
}

function drawBoard() {
  const ctx = boardCanvas.getContext('2d');
  ctx.clearRect(0, 0, BOARD_PIX, BOARD_PIX);
  roundRectPath(ctx, 0, 0, BOARD_PIX, BOARD_PIX, 18);
  ctx.fillStyle = theme.border;
  ctx.fill();

  const hiliteCells = new Set(state.winningLine || []);
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(i / 4);
    const col = i % 4;
    const x0 = BOARD_FRAME + col * BOARD_CELL + BOARD_GAP / 2;
    const y0 = BOARD_FRAME + r * BOARD_CELL + BOARD_GAP / 2;
    const w = BOARD_CELL - BOARD_GAP;
    const h = BOARD_CELL - BOARD_GAP;
    const fill = hiliteCells.has(i) ? theme.boardHilite : theme.boardCell;
    roundRectPath(ctx, x0, y0, w, h, 10);
    ctx.fillStyle = fill;
    ctx.fill();

    const piece = state.board[i];
    if (piece !== null) {
      drawPiece(ctx, x0 + w / 2, y0 + h / 2, piece, BOARD_CELL, { bgColor: fill, theme });
    }
  }
}

function drawHand() {
  const ctx = handCanvas.getContext('2d');
  ctx.clearRect(0, 0, HAND_PIX, HAND_PIX);
  if (state.pieceInHand !== null) {
    drawPiece(ctx, HAND_PIX / 2, HAND_PIX / 2, state.pieceInHand, BOARD_CELL, {
      scale: 1.15,
      bgColor: theme.bgPanel,
      theme,
    });
  }
}

function drawPool() {
  const ctx = poolCanvas.getContext('2d');
  ctx.clearRect(0, 0, POOL_PIX, POOL_PIX);
  roundRectPath(ctx, 0, 0, POOL_PIX, POOL_PIX, 14);
  ctx.fillStyle = theme.border;
  ctx.fill();

  for (let p = 0; p < 16; p++) {
    const r = Math.floor(p / 4);
    const col = p % 4;
    const x0 = POOL_FRAME + col * POOL_CELL + POOL_GAP / 2;
    const y0 = POOL_FRAME + r * POOL_CELL + POOL_GAP / 2;
    const w = POOL_CELL - POOL_GAP;
    const h = POOL_CELL - POOL_GAP;
    const available = state.remaining.has(p);
    const fill = available ? theme.boardCell : theme.poolUnavailable;
    roundRectPath(ctx, x0, y0, w, h, 8);
    ctx.fillStyle = fill;
    ctx.fill();

    if (available) {
      drawPiece(ctx, x0 + w / 2, y0 + h / 2, p, BOARD_CELL, { scale: 0.6, bgColor: fill, theme });
    }
  }
}

function updateStatus() {
  if (state.phase === 'over') {
    if (state.winner === 'draw') {
      statusBadge.textContent = 'Match nul !';
      statusBadge.style.background = theme.neutral;
    } else {
      statusBadge.textContent = `${playerName(state.winner)} gagne !`;
      statusBadge.style.background = theme.success;
    }
    return;
  }
  const actor = playerName(state.currentPlayer);
  if (state.phase === 'select') {
    const other = playerName(1 - state.currentPlayer);
    statusBadge.textContent = `${actor} : choisissez une pièce à donner à ${other}`;
  } else {
    statusBadge.textContent = `${actor} : posez la pièce`;
  }
  statusBadge.style.background = theme.accent;
}

// ---------------------------------------------------------------- input
function isHumanTurn() {
  if (state.phase === 'over' || thinking) return false;
  if (!vsComputer) return true;
  return state.currentPlayer === humanPlayer;
}

function canvasCoords(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

boardCanvas.addEventListener('click', (event) => {
  if (!isHumanTurn() || state.phase !== 'place') return;
  const { x, y } = canvasCoords(boardCanvas, event);
  const col = Math.floor((x - BOARD_FRAME) / BOARD_CELL);
  const row = Math.floor((y - BOARD_FRAME) / BOARD_CELL);
  if (row < 0 || row > 3 || col < 0 || col > 3) return;
  const pos = row * 4 + col;
  if (!getLegalActions(state).includes(pos)) return;
  playAction(pos);
});

poolCanvas.addEventListener('click', (event) => {
  if (!isHumanTurn() || state.phase !== 'select') return;
  const { x, y } = canvasCoords(poolCanvas, event);
  const col = Math.floor((x - POOL_FRAME) / POOL_CELL);
  const row = Math.floor((y - POOL_FRAME) / POOL_CELL);
  if (row < 0 || row > 3 || col < 0 || col > 3) return;
  const piece = row * 4 + col;
  if (!state.remaining.has(piece)) return;
  playAction(piece);
});

// ---------------------------------------------------------------- game flow
function playAction(action) {
  state = applyAction(state, action);
  render();
  if (state.phase !== 'over') maybeTriggerComputer();
}

function maybeTriggerComputer() {
  if (!vsComputer || state.phase === 'over') return;
  if (state.currentPlayer !== computerPlayer) return;

  thinking = true;
  thinkLabel.textContent = "L'ordinateur réfléchit...";
  const settings = DIFFICULTIES[difficultySelect.value];

  pendingResolve = (action) => {
    thinking = false;
    thinkLabel.textContent = '';
    playAction(action);
  };

  worker.postMessage({
    board: state.board,
    remaining: Array.from(state.remaining),
    pieceInHand: state.pieceInHand,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    iterations: settings.iterations,
    timeLimit: settings.timeLimit,
  });
}

// ---------------------------------------------------------------- legend
function drawLegend() {
  const rows = [
    [0b0000, 0b0001, 'Petite', 'Grande'],
    [0b0000, 0b0010, 'Claire', 'Foncée'],
    [0b0000, 0b0100, 'Carrée', 'Ronde'],
    [0b0000, 0b1000, 'Pleine', 'Creuse'],
  ];
  const rowH = 46;
  legendCanvas.width = 220;
  legendCanvas.height = rowH * rows.length;
  const ctx = legendCanvas.getContext('2d');
  ctx.clearRect(0, 0, legendCanvas.width, legendCanvas.height);
  ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';

  rows.forEach(([a, b, labelA, labelB], i) => {
    const y = rowH * i + rowH / 2 - 6;
    drawPiece(ctx, 30, y, a, BOARD_CELL, { scale: 0.5, bgColor: theme.bgPanel, theme });
    ctx.fillStyle = theme.textDark;
    ctx.fillText(labelA, 30, y + 24);
    ctx.fillStyle = theme.textMuted;
    ctx.font = 'italic 11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillText('vs', 85, y + 4);
    ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
    drawPiece(ctx, 140, y, b, BOARD_CELL, { scale: 0.5, bgColor: theme.bgPanel, theme });
    ctx.fillStyle = theme.textDark;
    ctx.fillText(labelB, 140, y + 24);
  });
}

drawLegend();
