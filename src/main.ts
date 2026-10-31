import { BoardUI } from "./ui/board.js";
import {
  applyMove,
  createGame,
  deserializeState,
  endTurn,
  legalMoves,
  GameState,
} from "./engine/game.js";
import { chooseMove } from "./engine/ai/computer.js";
import { applyPunishment, pickVictim } from "./engine/punishment.js";
import { baseRules } from "./engine/rules.js";
import { StartScreen } from "./ui/start-screen.js";
import { HUD } from "./ui/hud.js";
import { EndScreen } from "./ui/end-screen.js";
import { Dashboard } from "./ui/dashboard.js";
import { appendDashboard } from "./ui/localStorage.js";
import {
  getSoundPlayer,
  playSound,
  startFrenzyLoop,
  stopFrenzyLoopSound,
} from "./ui/sounds.js";
import { GameEvent, MoveResult, Player, RulesConfig } from "./engine/types.js";

interface Containers {
  startContainer: HTMLElement;
  hudContainer: HTMLElement;
  gameArea: HTMLElement;
  boardEl: HTMLElement;
  endContainer: HTMLElement;
  dashContainer: HTMLElement;
}

interface BoardSeed {
  state: GameState;
  computerColour: Player | null;
  aggression: number;
  depth: number;
}

interface Session {
  startContainer: HTMLElement;
  hudContainer: HTMLElement;
  gameArea: HTMLElement;
  boardEl: HTMLElement;
  endContainer: HTMLElement;
  dashContainer: HTMLElement;
  boardUI: BoardUI | null;
  hudUI: HUD | null;
  endScreenUI: EndScreen;
  dashboardUI: Dashboard;
  startScreenUI: StartScreen;
  isComputerGame: boolean;
  computerColour: Player | null;
  aggression: number;
  depth: number;
  rules: RulesConfig;
  gameId: number;
  recordedFor: number;
  prevState: GameState | null;
  computerThinking: boolean;
}

function main(): void {
  const els = readContainers();
  if (els === null) {
    return;
  }
  const session = buildSession(els);
  armGestureUnlock();
  wireEndTurn(session);
  const seed = readSeed(els.boardEl);
  if (seed !== null) {
    startGame(session, seed.state, seed.computerColour !== null, seed.computerColour, seed.aggression, seed.depth, null);
  } else {
    showStartScreen(session);
  }
}

function readContainers(): Containers | null {
  const startContainer = document.getElementById("start-screen-container");
  const hudContainer = document.getElementById("hud-container");
  const gameArea = document.getElementById("game-area");
  const boardEl = document.getElementById("board");
  const endContainer = document.getElementById("end-screen-container");
  const dashContainer = document.getElementById("dashboard-container");
  if (!startContainer || !hudContainer || !gameArea || !boardEl || !endContainer || !dashContainer) {
    return null;
  }
  return { startContainer, hudContainer, gameArea, boardEl, endContainer, dashContainer };
}

function buildSession(els: Containers): Session {
  let session!: Session;
  const endScreenUI = new EndScreen(els.endContainer, {
    onPlayAgain: () => startGameFromConfig(session),
    onChangeRules: () => showStartScreen(session),
  });
  const dashboardUI = new Dashboard(els.dashContainer, {
    onClose: () => {
      els.dashContainer.style.display = "none";
      showStartScreen(session);
    },
  });
  const startScreenUI = new StartScreen(els.startContainer, {
    onStart: (state, computerGame, aggression, depth) => {
      const colour: Player | null = computerGame ? (Math.random() < 0.5 ? "white" : "purple") : null;
      startGame(session, state, computerGame, colour, aggression, depth, coinMessageFor(state.turn));
    },
    onDashboard: () => {
      dashboardUI.show();
      els.startContainer.style.display = "none";
    },
    currentRules: baseRules(),
  });
  session = {
    startContainer: els.startContainer,
    hudContainer: els.hudContainer,
    gameArea: els.gameArea,
    boardEl: els.boardEl,
    endContainer: els.endContainer,
    dashContainer: els.dashContainer,
    boardUI: null,
    hudUI: null,
    endScreenUI,
    dashboardUI,
    startScreenUI,
    isComputerGame: false,
    computerColour: null,
    aggression: 3,
    depth: 4,
    rules: baseRules(),
    gameId: 0,
    recordedFor: -1,
    prevState: null,
    computerThinking: false,
  };
  return session;
}

function armGestureUnlock(): void {
  const unlock = () => getSoundPlayer().unlock();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function wireEndTurn(session: Session): void {
  const btn = document.getElementById("end-turn-btn");
  if (!btn) {
    return;
  }
  btn.addEventListener("click", () => {
    try {
      const ui = session.boardUI;
      if (ui) {
        const result = endTurn(ui.stateData.state);
        ui.applyEngineState(result.state, result.events);
      }
    } catch {
      return;
    }
  });
}

function showGame(session: Session): void {
  session.startContainer.style.display = "none";
  session.hudContainer.style.display = "block";
  session.gameArea.style.display = "block";
  session.endContainer.style.display = "none";
  session.dashContainer.style.display = "none";
}

function showStartScreen(session: Session): void {
  session.startContainer.style.display = "block";
  session.hudContainer.style.display = "none";
  session.gameArea.style.display = "none";
  session.endContainer.style.display = "none";
  session.dashContainer.style.display = "none";
  session.startScreenUI.show();
}

function startGame(
  session: Session,
  state: GameState,
  computerGame: boolean,
  colour: Player | null,
  aggression: number,
  depth: number,
  coin: string | null,
): void {
  session.isComputerGame = computerGame;
  session.computerColour = computerGame ? (colour ?? state.turn) : null;
  session.aggression = aggression;
  session.depth = depth;
  session.rules = { ...state.rules };
  session.gameId += 1;
  session.prevState = state;
  showCoin(coin);
  showGame(session);
  if (session.boardUI === null) {
    const ui = new BoardUI(session.boardEl, state, session.computerColour);
    ui.setStateChangeCallback((next, events) => {
      handleEngineResult(session, { state: next, events }, session.prevState ?? next);
    });
    session.boardUI = ui;
    ui.init();
    const hud = new HUD(session.hudContainer);
    hud.init();
    session.hudUI = hud;
    handleEngineResult(session, { state, events: [] }, state);
    return;
  }
  session.boardUI.setComputerColour(session.computerColour);
  session.boardUI.clearLastMove();
  session.boardUI.applyEngineState(state, []);
}

function startGameFromConfig(session: Session): void {
  const whiteFirst = Math.random() < 0.5;
  const turn: Player = whiteFirst ? "white" : "purple";
  const base = createGame(session.rules);
  const state: GameState = { ...base, turn };
  const colour: Player | null = session.isComputerGame
    ? (Math.random() < 0.5 ? "white" : "purple")
    : null;
  startGame(session, state, session.isComputerGame, colour, session.aggression, session.depth, coinMessageFor(turn));
}

function handleEngineResult(session: Session, result: MoveResult, prev: GameState): void {
  playEventSounds(result.events, prev, result.state);
  session.prevState = result.state;
  updateFrenzy(prev, result.state);
  if (session.hudUI) {
    session.hudUI.update(result.state);
  }
  setEndTurnVisible(result.state.pendingChain !== null);
  if (result.state.status === "ended") {
    handleGameEnd(session, result.state);
  } else {
    wireComputerTurn(session, result.state);
  }
}

function updateFrenzy(prev: GameState, next: GameState): void {
  if (next.status === "ended") {
    stopFrenzyLoopSound();
    return;
  }
  if (next.frenzyTurn && !prev.frenzyTurn) {
    startFrenzyLoop();
  } else if (!next.frenzyTurn && prev.frenzyTurn) {
    stopFrenzyLoopSound();
  }
}

function playEventSounds(events: GameEvent[], prev: GameState, next: GameState): void {
  let kill = false;
  let punish = false;
  let promote = false;
  for (const e of events) {
    if (e.type === "kill") {
      kill = true;
    } else if (e.type === "punish") {
      punish = true;
    } else if (e.type === "promote") {
      promote = true;
    }
  }
  if (kill || punish) {
    playSound("terror-scream");
  }
  if (promote) {
    playSound("promoted-to-king");
  }
  if (next.empowerment.activeBuffs.length > prev.empowerment.activeBuffs.length) {
    playSound("bonus-turn");
  } else if (kill && next.status === "inProgress" && next.turn === prev.turn) {
    playSound("bonus-turn");
  }
}

function handleGameEnd(session: Session, state: GameState): void {
  stopFrenzyLoopSound();
  recordDashboardOnce(session, state);
  if (session.isComputerGame && session.computerColour !== null && state.result !== null) {
    if (state.result.winner === session.computerColour) {
      playSound("lose-against-AI");
    } else if (state.result.winner !== "tie") {
      playSound("win-against-AI");
    }
  }
  session.endScreenUI.show(state);
}

function recordDashboardOnce(session: Session, state: GameState): void {
  if (state.result === null || session.recordedFor === session.gameId) {
    return;
  }
  session.recordedFor = session.gameId;
  appendDashboard({
    date: (new Date().toISOString().split("T")[0] ?? ""),
    rules: rulesLabel(state.rules),
    mode: session.isComputerGame ? "PvAI" : "PvP",
    winner: state.result.winner === "tie" ? "tie" : state.result.winner,
    pScore: state.scores.white,
    p2Score: state.scores.purple,
  });
}

function wireComputerTurn(session: Session, state: GameState): void {
  if (!session.isComputerGame || session.computerColour === null || session.computerThinking) {
    return;
  }
  if (state.status !== "inProgress" || state.turn !== session.computerColour) {
    return;
  }
  if (state.pendingChain !== null && legalMoves(state).length === 0) {
    return;
  }
  session.computerThinking = true;
  const delay = 400 + Math.random() * 600;
  window.setTimeout(() => {
    void runComputerMove(session);
  }, delay);
}

function runComputerMove(session: Session): Promise<void> {
  const step = async (): Promise<void> => {
    for (let hop = 0; hop < 40; hop += 1) {
      const ui = session.boardUI;
      if (ui === null) {
        break;
      }
      const current = ui.stateData.state;
      if (current.status !== "inProgress" || current.turn !== session.computerColour) {
        break;
      }
      const progressed = await computerHop(session, current);
      if (!progressed) {
        break;
      }
    }
  };
  return step().finally(() => {
    session.computerThinking = false;
    const ui = session.boardUI;
    if (ui !== null) {
      wireComputerTurn(session, ui.stateData.state);
    }
  });
}

function computerHop(session: Session, current: GameState): Promise<boolean> {
  const ui = session.boardUI;
  if (ui === null) {
    return Promise.resolve(false);
  }
  if (current.pendingPunishment !== null) {
    const victim = pickVictim(current, Math.random);
    if (victim === null) {
      return Promise.resolve(false);
    }
    try {
      const res = applyPunishment(current, victim.id);
      ui.applyEngineState(res.state, res.events);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }
  return chooseMove(current, { depth: session.depth, aggression: session.aggression, rng: Math.random }).then(
    (move) => {
      try {
        const res = applyMove(current, move);
        ui.setLastMove(move.from, move.to);
        ui.applyEngineState(res.state, res.events);
        return true;
      } catch {
        return false;
      }
    },
    () => false,
  );
}

function showCoin(message: string | null): void {
  const el = document.getElementById("coin-flip-result");
  if (el) {
    el.textContent = message ?? "";
  }
}

function coinMessageFor(turn: Player): string {
  return turn === "white" ? "White plays first" : "Purple plays first";
}

function setEndTurnVisible(visible: boolean): void {
  const wrapper = document.getElementById("end-turn-wrapper");
  if (!wrapper) {
    return;
  }
  if (visible) {
    wrapper.classList.remove("hidden");
  } else {
    wrapper.classList.add("hidden");
  }
}

function rulesLabel(config: RulesConfig): string {
  const nums: number[] = [];
  if (config.beatAnyDirection) {
    nums.push(1);
  }
  if (config.missKillPunishment) {
    nums.push(2);
  }
  if (config.fourDirectionStepping) {
    nums.push(3);
  }
  if (config.forcedFullSlide) {
    nums.push(4);
  }
  if (config.killLink) {
    nums.push(5);
  }
  if (config.extraTurnBonus) {
    nums.push(6);
  }
  if (config.queenBuff) {
    nums.push(7);
  }
  if (config.killFrenzy) {
    nums.push(8);
  }
  return nums.join(",");
}

function readSeed(boardEl: HTMLElement): BoardSeed | null {
  const raw = boardEl.getAttribute("data-draghts");
  if (raw === null || raw === "") {
    return null;
  }
  try {
    return normalizeSeed(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function normalizeSeed(parsed: unknown): BoardSeed | null {
  if (parsed === null || typeof parsed !== "object") {
    return null;
  }
  const root = parsed as Record<string, unknown>;
  const inner = root.state !== null && typeof root.state === "object"
    ? (root.state as Record<string, unknown>)
    : root;
  const state = seedState(inner);
  if (state === null) {
    return null;
  }
  return {
    state,
    computerColour: seedColour(root, inner, state.turn),
    aggression: seedNumber(root.aggression ?? inner.aggression, 3, 1, 5),
    depth: seedNumber(root.depth ?? inner.depth, 4, 1, 8),
  };
}

function seedState(inner: Record<string, unknown>): GameState | null {
  try {
    if (Array.isArray(inner.board)) {
      return deserializeState(JSON.stringify(inner));
    }
    const rules = parseRules(inner.rules);
    const base = createGame(rules);
    const turn: Player = inner.turn === "purple" ? "purple" : "white";
    return { ...base, turn };
  } catch {
    return null;
  }
}

function seedColour(
  root: Record<string, unknown>,
  inner: Record<string, unknown>,
  turn: Player,
): Player | null {
  const raw = root.computerColour ?? inner.computerColour;
  if (raw === "white" || raw === "purple") {
    return raw;
  }
  if (root.computerGame === true || inner.computerGame === true) {
    return turn;
  }
  return null;
}

function seedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseRules(value: unknown): RulesConfig {
  const rules = baseRules();
  if (value === null || typeof value !== "object") {
    return rules;
  }
  const raw = value as Record<string, unknown>;
  const keys: Array<keyof RulesConfig> = [
    "beatAnyDirection",
    "missKillPunishment",
    "fourDirectionStepping",
    "forcedFullSlide",
    "killLink",
    "extraTurnBonus",
    "queenBuff",
    "killFrenzy",
  ];
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "boolean") {
      rules[key] = v;
    }
  }
  return rules;
}

main();
