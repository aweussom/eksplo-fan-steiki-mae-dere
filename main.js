import { PIECE_SET, weightedPick } from "./pieces.js";
import { loadProfile, saveProfile, maybeUpdateHighScore } from "./profile.js";

const BOARD_SIZE = 10;
const PILE_SIZE  = 4;

const state = {
  board:       Array.from({length:BOARD_SIZE}, () => Array(BOARD_SIZE).fill(null)),
  discardPile: Array.from({length:PILE_SIZE},  () => Array(PILE_SIZE).fill(null)),
  score: 0,
  next: [],
  dragging:    null,   // { idx, cells, color, isBomb, bombType }
  ghost:       null,
  shadow:      null,   // board overlay preview
  pileShadow:  null,   // discard pile overlay preview
  falling:     false,  // true while Tetris gravity animation is running
  tetrisMode:  false,
  profile: loadProfile()
};

const boardEl       = document.getElementById("board");
const trayEl        = document.getElementById("tray");
const discardEl     = document.getElementById("discard-pile");   // grid — used for position math
const discardAreaEl = document.getElementById("discard-area");   // wrapper — used for hit detection
const scoreEl       = document.getElementById("score");
const playerEl    = document.getElementById("player");
const highScoreEl = document.getElementById("highscore");
const newBtn        = document.getElementById("newgame");
const tetrisModeEl  = document.getElementById("tetris-mode");
const FALL_TICK_MS  = 780;

function cellSizePx() {
  const firstCell = boardEl.querySelector(".cell");
  const size = firstCell ? firstCell.getBoundingClientRect().width : 36;
  const gap  = parseFloat(getComputedStyle(boardEl).gap) || 0;
  return { size, gap };
}

function pileCellSizePx() {
  const firstCell = discardEl.querySelector(".dcell");
  const size = firstCell ? firstCell.getBoundingClientRect().width : 28;
  const gap  = parseFloat(getComputedStyle(discardEl).gap) || 0;
  return { size, gap };
}

/* -------------------- Drawing -------------------- */

function drawBoard() {
  boardEl.innerHTML = "";
  if (_pCanvas) boardEl.appendChild(_pCanvas);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const color = state.board[r][c];
      const isNew = _justPlaced && _justPlaced.has(r + "," + c);
      const cell  = document.createElement("div");
      cell.className = "cell" + (color ? " filled" : "") + (isNew ? " cell-pop" : "");
      if (color) {
        cell.style.setProperty("--color", color);
        const delay = -(6.08 - (r + c) * 0.08).toFixed(3);
        cell.style.setProperty("--wipe-delay", delay + "s");
      }
      boardEl.appendChild(cell);
    }
  }
}

function drawDiscardPile() {
  discardEl.innerHTML = "";
  for (let r = 0; r < PILE_SIZE; r++) {
    for (let c = 0; c < PILE_SIZE; c++) {
      const color = state.discardPile[r][c];
      const cell  = document.createElement("div");
      cell.className = "dcell" + (color ? " filled" : "");
      if (color) cell.style.setProperty("--color", color);
      discardEl.appendChild(cell);
    }
  }
}

function drawTray() {
  trayEl.innerHTML = "";
  state.next.forEach((p, i) => {
    const wrap = document.createElement("div");
    let cls = "piece";
    if (p && p.isBomb) cls += p.bombType === "super" ? " super-bomb" : " bomb";
    wrap.className = cls;
    wrap.style.setProperty("--color", p ? p.color : "#ccc");

    wrap.addEventListener("pointerdown", (ev) => {
      if (!state.next[i]) return;
      ev.preventDefault();
      startDrag(i, ev.clientX, ev.clientY);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    });

    const occ = new Set(p ? p.cells.map(rc => rc.join(",")) : []);
    for (let rr = 0; rr < 4; rr++) {
      for (let cc = 0; cc < 4; cc++) {
        const m = document.createElement("div");
        m.className = "pmini" + (occ.has(rr + "," + cc) ? " on" : "");
        if (occ.has(rr + "," + cc)) m.style.setProperty("--color", p.color);
        wrap.appendChild(m);
      }
    }
    trayEl.appendChild(wrap);
  });
}

/* -------------------- Placement helpers -------------------- */

function canPlace(cells, r, c) {
  for (const [dr, dc] of cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) return false;
    if (state.board[rr][cc]) return false;
  }
  return true;
}

function canPlaceInPile(cells, r, c) {
  for (const [dr, dc] of cells) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= PILE_SIZE || cc < 0 || cc >= PILE_SIZE) return false;
    if (state.discardPile[rr][cc]) return false;
  }
  return true;
}

/* -------------------- Board placement + scoring -------------------- */

function place(cells, color, r, c) {
  cells.forEach(([dr, dc]) => { state.board[r + dr][c + dc] = color; });

  // Pre-compute cells that will be line-cleared (excluded from cell-pop)
  const willClear = new Set();
  for (let row = 0; row < BOARD_SIZE; row++) {
    if (state.board[row].every(x => x))
      for (let cc = 0; cc < BOARD_SIZE; cc++) willClear.add(row + "," + cc);
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    let ok = true;
    for (let rr = 0; rr < BOARD_SIZE; rr++) if (!state.board[rr][col]) { ok = false; break; }
    if (ok) for (let rr = 0; rr < BOARD_SIZE; rr++) willClear.add(rr + "," + col);
  }
  _justPlaced = new Set(
    cells.map(([dr, dc]) => (r + dr) + "," + (c + dc)).filter(k => !willClear.has(k))
  );

  const { total: cleared, rowCount, colCount, clearedRows } = clearFullWithExplosion();
  const points = cells.length + 10 * cleared;
  state.score += points;
  if (cleared > 0) floatScore(points);
  updateHud();

  // Spawn bonus piece based on what was cleared
  if (rowCount >= 1 && colCount >= 1) {
    spawnBomb("super");
  } else if (rowCount >= 2 || colCount >= 2) {
    spawnBomb("regular");
  }

  return { rowCount, colCount, clearedRows };
}

/* -------------------- Bomb logic -------------------- */

function spawnBomb(type) {
  const emptyIdx = state.next.findIndex(p => !p);
  if (emptyIdx === -1) return;
  const picked = weightedPick(PIECE_SET);
  state.next[emptyIdx] = {
    name:     picked.name + (type === "super" ? "-superbomb" : "-bomb"),
    color:    type === "super" ? "#e040fb" : "#ff6d00",
    cells:    picked.cells.map(([r, c]) => [r, c]),
    isBomb:   true,
    bombType: type
  };
  drawTray();
}

function triggerBombBlast(placedCells, r, c, bombType) {
  const blast = new Set();

  if (bombType === "super") {
    // Full row + full column through every placed cell
    for (const [dr, dc] of placedCells) {
      const br = r + dr, bc = c + dc;
      for (let i = 0; i < BOARD_SIZE; i++) {
        blast.add(br + "," + i);
        blast.add(i + "," + bc);
      }
    }
  } else {
    // 1 cell beyond each placed cell in all 8 directions
    for (const [dr, dc] of placedCells) {
      const br = r + dr, bc = c + dc;
      for (let nr = br - 1; nr <= br + 1; nr++) {
        for (let nc = bc - 1; nc <= bc + 1; nc++) {
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE)
            blast.add(nr + "," + nc);
        }
      }
    }
  }

  // Bomb cells always self-destruct
  for (const [dr, dc] of placedCells) blast.add((r + dr) + "," + (c + dc));

  const cellsArr = [];
  for (const key of blast) {
    const [nr, nc] = key.split(",").map(Number);
    const color = state.board[nr][nc];
    if (color) {
      cellsArr.push({ r: nr, c: nc, color });
      state.board[nr][nc] = null;
    }
  }
  if (!cellsArr.length) return;

  state.score += cellsArr.length;
  updateHud();
  drawBoard();
  explodeParticles(cellsArr, cellsArr.length > 8 ? 4 : 2);
}

function triggerPileBomb(cells, r, c, bombType) {
  const blast = new Set();
  if (bombType === "super") {
    for (let rr = 0; rr < PILE_SIZE; rr++)
      for (let cc = 0; cc < PILE_SIZE; cc++) blast.add(rr + "," + cc);
  } else {
    for (const [dr, dc] of cells) {
      const br = r + dr, bc = c + dc;
      for (let nr = br - 1; nr <= br + 1; nr++) {
        for (let nc = bc - 1; nc <= bc + 1; nc++) {
          if (nr >= 0 && nr < PILE_SIZE && nc >= 0 && nc < PILE_SIZE)
            blast.add(nr + "," + nc);
        }
      }
    }
  }
  for (const key of blast) {
    const [nr, nc] = key.split(",").map(Number);
    state.discardPile[nr][nc] = null;
  }
}

/* -------------------- Line clearing -------------------- */

function clearFullWithExplosion() {
  const rows = [], cols = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (state.board[r].every(x => x)) rows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let ok = true;
    for (let r = 0; r < BOARD_SIZE; r++) if (!state.board[r][c]) { ok = false; break; }
    if (ok) cols.push(c);
  }
  if (!rows.length && !cols.length) return { total: 0, rowCount: 0, colCount: 0, clearedRows: [] };

  const toClear = new Map();
  for (const r of rows)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const color = state.board[r][c];
      if (color) toClear.set(r + "," + c, { r, c, color });
    }
  for (const c of cols)
    for (let r = 0; r < BOARD_SIZE; r++) {
      const color = state.board[r][c];
      if (color) toClear.set(r + "," + c, { r, c, color });
    }

  for (const { r, c } of toClear.values()) state.board[r][c] = null;
  drawBoard();
  explodeParticles(Array.from(toClear.values()), rows.length + cols.length);

  return { total: rows.length + cols.length, rowCount: rows.length, colCount: cols.length, clearedRows: rows };
}

/* -------------------- Canvas particle system -------------------- */

let _pCanvas = null;
let _pCtx    = null;
const _pList = [];
let _rafId   = null;
let _justPlaced = null;

// Tetris fall pause/resume handles
let _fallTick    = null;   // the tick fn to call when resuming
let _fallTimeout = null;   // current setTimeout id (null when paused)

function _ensureCanvas() {
  if (_pCanvas && _pCanvas.parentNode === boardEl) return;
  _pCanvas = document.createElement("canvas");
  _pCanvas.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;z-index:20;";
  boardEl.appendChild(_pCanvas);
  _pCtx = _pCanvas.getContext("2d");
}

function explodeParticles(cells, comboSize) {
  if (!cells.length) return;
  const { size, gap } = cellSizePx();
  _ensureCanvas();
  _pCanvas.width  = boardEl.offsetWidth;
  _pCanvas.height = boardEl.offsetHeight;

  if ((comboSize || 0) >= 3) {
    boardEl.classList.add("board-shake");
    setTimeout(() => boardEl.classList.remove("board-shake"), 500);
  }

  const PER_CELL = 12;
  for (const { r, c, color } of cells) {
    const cx = c * (size + gap) + size / 2;
    const cy = r * (size + gap) + size / 2;
    for (let i = 0; i < 5; i++) {
      _pList.push({
        x: cx + (Math.random() - 0.5) * size * 0.6,
        y: cy + (Math.random() - 0.5) * size * 0.6,
        vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
        life: 10 + Math.random() * 8, maxLife: 16,
        color: "white", flash: true
      });
    }
    for (let i = 0; i < PER_CELL; i++) {
      _pList.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 13,
        vy: (Math.random() - 0.9) * 13,
        life: 65 + Math.random() * 30, maxLife: 90,
        color
      });
    }
  }
  if (!_rafId) _rafId = requestAnimationFrame(_tickParticles);
}

function _tickParticles() {
  _pCtx.clearRect(0, 0, _pCanvas.width, _pCanvas.height);
  for (let i = _pList.length - 1; i >= 0; i--) {
    const p = _pList[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += p.flash ? 0 : 0.3;
    p.life--;
    if (p.life <= 0) { _pList.splice(i, 1); continue; }
    const alpha = p.life / p.maxLife;
    const s = p.flash ? (20 * alpha) : (4 + alpha * 7);
    _pCtx.globalAlpha = alpha;
    _pCtx.fillStyle   = p.color;
    _pCtx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  _pCtx.globalAlpha = 1;
  _rafId = _pList.length ? requestAnimationFrame(_tickParticles) : null;
}

/* -------------------- Tetris gravity -------------------- */

// Move every non-frozen cell that has empty space directly below it down one row.
// frozenSet — positions (r+","+c) of cells that were below the cleared line;
//   they act as permanent anchors and never move.
// Returns true if anything moved (animation should continue).
function applyGravityStep(frozenSet) {
  let moved = false;
  // Scan bottom-up so each cell falls exactly 1 row per tick, independently
  for (let r = BOARD_SIZE - 2; r >= 0; r--) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!state.board[r][c]) continue;
      if (frozenSet.has(r + ',' + c)) continue;   // anchor — never moves
      if (state.board[r + 1][c]) continue;          // something solid below
      state.board[r + 1][c] = state.board[r][c];
      state.board[r][c] = null;
      moved = true;
    }
  }
  return moved;
}

// Animate gravity ticks until the board is fully settled, then call callback.
// clearedRows — array of row indices that were just cleared; cells in rows
//   BELOW the lowest cleared row are frozen (they stay put); cells above fall
//   freely through any empty space until they land on a frozen cell or the floor.
// If tetrisMode is off, calls callback immediately.
function animateFall(clearedRows, callback) {
  if (!state.tetrisMode || !clearedRows.length) { callback(); return; }

  // Cells below the lowest cleared row are anchors — they don't participate.
  const lowestCleared = Math.max(...clearedRows);
  const frozenSet = new Set();
  for (let r = lowestCleared + 1; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c]) frozenSet.add(r + ',' + c);
    }
  }

  state.falling = true;
  function tick() {
    _fallTimeout = null;
    const moved = applyGravityStep(frozenSet);
    drawBoard();
    if (moved) {
      _fallTick    = tick;
      _fallTimeout = setTimeout(tick, FALL_TICK_MS);
    } else {
      state.falling = false;
      _fallTick = _fallTimeout = null;
      callback();
    }
  }
  _fallTick    = tick;
  _fallTimeout = setTimeout(tick, FALL_TICK_MS);
}

function pauseFall() {
  if (_fallTimeout !== null) {
    clearTimeout(_fallTimeout);
    _fallTimeout = null;
    // _fallTick is preserved so resumeFall() can restart the same tick
    boardEl.classList.add("fall-paused");
  }
}

function resumeFall() {
  boardEl.classList.remove("fall-paused");
  if (_fallTick && state.falling && _fallTimeout === null) {
    _fallTimeout = setTimeout(_fallTick, FALL_TICK_MS);
  }
}

/* -------------------- Game-over check -------------------- */

function anyMovesLeft() {
  for (const p of state.next) {
    if (!p) continue;
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (canPlace(p.cells, r, c)) return true;
    // Discard pile counts as a valid move if piece fits somewhere
    for (let r = 0; r < PILE_SIZE; r++)
      for (let c = 0; c < PILE_SIZE; c++)
        if (canPlaceInPile(p.cells, r, c)) return true;
  }
  return false;
}

/* -------------------- HUD -------------------- */

function ensureNickname() {
  if (state.profile.name) return;
  if (typeof prompt !== "function") {
    state.profile.name = "Player";
    updateHud();
    return;
  }
  let name = (prompt("Enter a nickname to track your high score:", "") || "").trim();
  state.profile.name = name || "Player";
  saveProfile(state.profile);
  updateHud();
}

function updateHud() {
  if (playerEl)    playerEl.textContent    = "Player: " + (state.profile.name || "—");
  if (scoreEl)     scoreEl.textContent     = "Score: " + state.score;
  if (highScoreEl) highScoreEl.textContent = "High Score: " + (state.profile.highScore || 0);
}

function recordHighScoreIfBetter() {
  return maybeUpdateHighScore(state.profile, state.score);
}

function floatScore(points) {
  const el = document.createElement("div");
  el.className = "score-float";
  el.textContent = "+" + points;
  const mainEl = document.querySelector("main");
  const sr = scoreEl.getBoundingClientRect();
  const mr = mainEl.getBoundingClientRect();
  el.style.left = (sr.right - mr.left + 8) + "px";
  el.style.top  = (sr.top   - mr.top)      + "px";
  mainEl.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

/* -------------------- Piece generation -------------------- */

function newThree() {
  state.next = [0, 1, 2].map(() => {
    const picked = weightedPick(PIECE_SET);
    return { name: picked.name, color: picked.color, cells: picked.cells.map(([r, c]) => [r, c]) };
  });
  drawTray();
}

/* -------------------- Drag system -------------------- */

function startDrag(idx, x, y) {
  if (state.falling) pauseFall();
  const p = state.next[idx];
  state.dragging = {
    idx,
    cells:    p.cells,
    color:    p.color,
    isBomb:   p.isBomb   || false,
    bombType: p.bombType || null
  };

  const ghost = document.createElement("div");
  ghost.id = "drag-ghost";
  ghost.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:20px;height:20px;pointer-events:none;background:#0000;`;
  document.body.appendChild(ghost);
  state.ghost = ghost;

  const shadow = document.createElement("div");
  shadow.id = "drag-shadow";
  shadow.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;";
  boardEl.appendChild(shadow);
  state.shadow = shadow;

  const pileShadow = document.createElement("div");
  pileShadow.id = "drag-pile-shadow";
  pileShadow.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;";
  discardEl.appendChild(pileShadow);
  state.pileShadow = pileShadow;

  moveGhost(x, y);
  updateShadow(x, y);
}

function onPointerMove(ev) {
  if (!state.dragging) return;
  ev.preventDefault();
  moveGhost(ev.clientX, ev.clientY);

  const ar = discardAreaEl.getBoundingClientRect();
  const overPile = ev.clientX >= ar.left && ev.clientX <= ar.right &&
                   ev.clientY >= ar.top  && ev.clientY <= ar.bottom;

  if (overPile) {
    if (state.shadow) state.shadow.innerHTML = "";
    updatePileShadow(ev.clientX, ev.clientY);
    discardEl.classList.add("drag-over");
  } else {
    if (state.pileShadow) state.pileShadow.innerHTML = "";
    updateShadow(ev.clientX, ev.clientY);
    discardEl.classList.remove("drag-over");
  }
}

function moveGhost(x, y) {
  if (!state.ghost) return;
  state.ghost.style.left = x + "px";
  state.ghost.style.top  = y + "px";
}

function updateShadow(x, y) {
  if (!state.shadow) return;
  const { size, gap } = cellSizePx();
  const br   = boardEl.getBoundingClientRect();
  const step = size + gap;
  const r    = Math.floor((y - br.top  + gap / 2) / step);
  const c    = Math.floor((x - br.left + gap / 2) / step);
  const { cells, color } = state.dragging;
  const valid = canPlace(cells, r, c);

  state.shadow.innerHTML = "";
  cells.forEach(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) return;
    const chip = document.createElement("div");
    chip.style.cssText = `position:absolute;width:${size}px;height:${size}px;` +
      `left:${cc*(size+gap)}px;top:${rr*(size+gap)}px;` +
      `background:${valid ? color : "red"};opacity:0.4;border-radius:4px;`;
    state.shadow.appendChild(chip);
  });
}

function updatePileShadow(x, y) {
  if (!state.pileShadow) return;
  const { size, gap } = pileCellSizePx();
  const pr   = discardEl.getBoundingClientRect();
  const step = size + gap;
  const r    = Math.floor((y - pr.top  + gap / 2) / step);
  const c    = Math.floor((x - pr.left + gap / 2) / step);
  const { cells, color } = state.dragging;
  const valid = canPlaceInPile(cells, r, c);

  state.pileShadow.innerHTML = "";
  cells.forEach(([dr, dc]) => {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= PILE_SIZE || cc < 0 || cc >= PILE_SIZE) return;
    const chip = document.createElement("div");
    chip.style.cssText = `position:absolute;width:${size}px;height:${size}px;` +
      `left:${cc*(size+gap)}px;top:${rr*(size+gap)}px;` +
      `background:${valid ? color : "red"};opacity:0.4;border-radius:3px;`;
    state.pileShadow.appendChild(chip);
  });
}

function onPointerUp(ev) {
  if (!state.dragging) return;
  const wasFalling = state.falling; // true when drag interrupted an in-progress fall

  const { idx, cells, color, isBomb, bombType } = state.dragging;
  discardEl.classList.remove("drag-over");

  // ---- Check drop on discard pile ----
  const ar = discardAreaEl.getBoundingClientRect();
  const overPile = ev.clientX >= ar.left && ev.clientX <= ar.right &&
                   ev.clientY >= ar.top  && ev.clientY <= ar.bottom;

  if (overPile) {
    const { size, gap } = pileCellSizePx();
    const pr   = discardEl.getBoundingClientRect();
    const step = size + gap;
    const r = Math.floor((ev.clientY - pr.top  + gap / 2) / step);
    const c = Math.floor((ev.clientX - pr.left + gap / 2) / step);

    if (canPlaceInPile(cells, r, c)) {
      cells.forEach(([dr, dc]) => { state.discardPile[r + dr][c + dc] = color; });
      if (isBomb) triggerPileBomb(cells, r, c, bombType);
      state.next[idx] = null;
      drawDiscardPile();
      drawTray();
      if (state.next.every(x => !x)) newThree();
      if (!anyMovesLeft()) handleGameOver();
    }
    cleanupDrag();
    return;
  }

  // ---- Normal board placement ----
  const { size, gap } = cellSizePx();
  const br   = boardEl.getBoundingClientRect();
  const step = size + gap;
  const r    = Math.floor((ev.clientY - br.top  + gap / 2) / step);
  const c    = Math.floor((ev.clientX - br.left + gap / 2) / step);

  if (canPlace(cells, r, c)) {
    const { rowCount, clearedRows } = place(cells, color, r, c);
    _justPlaced = null;  // clear before any animation redraws

    const afterSettle = () => {
      if (isBomb) triggerBombBlast(cells, r, c, bombType);
      state.next[idx] = null;
      drawBoard();
      drawTray();
      if (state.next.every(x => !x)) newThree();
      if (!anyMovesLeft()) handleGameOver();
      cleanupDrag();
    };

    if (!wasFalling && state.tetrisMode && rowCount > 0) {
      // No fall was in progress — start one for the new cleared rows
      animateFall(clearedRows, afterSettle);
    } else {
      // Fall was paused (or tetrisMode off / no rows cleared) — finalize now;
      // cleanupDrag inside afterSettle will call resumeFall() to unpause.
      afterSettle();
    }
    return;
  }
  cleanupDrag();
}

function cleanupDrag() {
  [state.ghost, state.shadow, state.pileShadow].forEach(el => {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
  discardEl.classList.remove("drag-over");
  state.ghost = state.shadow = state.pileShadow = state.dragging = null;
  window.removeEventListener("pointermove", onPointerMove);
  resumeFall();  // no-op if no fall was paused
}

/* -------------------- Game lifecycle -------------------- */

function handleGameOver() {
  const newHigh = recordHighScoreIfBetter();
  updateHud();
  let message = "Game over! Score: " + state.score;
  if (newHigh) message += "\nNew high score!";
  alert(message);
  newGame();
}

function newGame() {
  ensureNickname();
  state.board.forEach(row => row.fill(null));
  state.discardPile.forEach(row => row.fill(null));
  state.score = 0;
  updateHud();
  newThree();
  drawBoard();
  drawDiscardPile();
}

newBtn.addEventListener("click", () => {
  const updated = recordHighScoreIfBetter();
  if (updated) updateHud();
  newGame();
});

tetrisModeEl.addEventListener("change", () => {
  state.tetrisMode = tetrisModeEl.checked;
});

newGame();
