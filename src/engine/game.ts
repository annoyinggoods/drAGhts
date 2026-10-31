import {
  Board,
  GameEvent,
  GameState,
  Move,
  MoveResult,
  Piece,
  Player,
  RulesConfig,
  Square,
} from "./types.js";
import {
  cloneBoard,
  clonePiece,
  initialBoard,
  pieceAt,
  placePiece,
  clearSquare,
  sameSquare,
  wipeoutWinner,
} from "./board.js";
import { baseRules } from "./rules.js";
import { captureMovesFor } from "./captures.js";
import { movesForPlayer } from "./legalmoves.js";
import { endByWipeout, endOfTurn, startTurn } from "./turn.js";
export { endByWipeout, endByBlockage, endByTwentyRounds } from "./turn.js";
import { moveContextFor } from "./context.js";
import { cloneFrenzy, emptyFrenzy } from "./frenzy.js";
import { emptyRoundTurns, emptyScores, onePieceCondition, scoreRemoval } from "./scoring.js";

export type { GameState, MoveResult } from "./types.js";

export function createGame(rules: RulesConfig = baseRules()): GameState {
  return createGameFromBoard(initialBoard(), rules, "white");
}

export function createGameFromBoard(board: Board, rules: RulesConfig, turn: Player): GameState {
  const state: GameState = {
    board: cloneBoard(board),
    turn,
    rules: { ...rules },
    status: "inProgress",
    winner: null,
    endReason: null,
    result: null,
    scores: emptyScores(),
    kills: emptyScores(),
    turnKills: 0,
    captureAvailable: false,
    pendingChain: null,
    pendingPunishment: null,
    empowerment: { frenzyOpenPlayers: [], activeBuffs: [] },
    frenzy: emptyFrenzy(),
    frenzyTurn: false,
    moverStartedAsPawn: false,
    moveCounter: 0,
    lastMoveOrder: {},
    endgameRounds: 0,
    endgameCounting: onePieceCondition(board),
    roundHadKill: false,
    roundTurns: emptyRoundTurns(),
  };
  return startTurn(state);
}

export function legalMoves(state: GameState): Move[] {
  if (state.status === "ended") {
    return [];
  }
  if (state.pendingPunishment !== null) {
    return [];
  }
  if (state.pendingChain !== null) {
    return chainMoves(state);
  }
  return movesForPlayer(state, state.turn);
}

export function hasLegalMove(state: GameState): boolean {
  return legalMoves(state).length > 0;
}

export function applyMove(state: GameState, move: Move): MoveResult {
  if (state.status === "ended") {
    throw new Error("the game has already ended");
  }
  const chosen = findLegalMove(state, move);
  if (chosen === null) {
    throw new Error("the move is not legal in this position");
  }
  const board = cloneBoard(state.board);
  const piece = pieceAt(board, chosen.from);
  if (piece === null) {
    throw new Error("there is no piece on the origin square");
  }
  const events: GameEvent[] = [];
  const carried: GameState = { ...state, board };
  const scored = removeVictims(carried, piece, chosen, events);
  clearSquare(board, chosen.from);
  const moved = placeMovedPiece(board, piece, chosen.to);
  const promoted = promoteIfReachedFarRow(moved, chosen.to);
  if (promoted !== null) {
    placePiece(board, chosen.to, promoted);
    events.push({
      type: "promote",
      player: promoted.player,
      pieceId: promoted.id,
      square: { ...chosen.to },
    });
  }
  const placed = pieceAt(board, chosen.to);
  if (placed === null) {
    throw new Error("the moving piece is not on the board");
  }
  const startedTurn = state.pendingChain === null;
  const advanced = recordMove(
    { ...scored, moverStartedAsPawn: startedTurn ? piece.kind === "pawn" : scored.moverStartedAsPawn },
    piece.id,
    chosen.kills.length,
  );
  const landing: TurnLanding = {
    piece: placed,
    square: chosen.to,
    killed: chosen.kills.length > 0,
  };
  return finishTurn(advanced, piece.player, landing, events);
}

export function endTurn(state: GameState): MoveResult {
  if (state.status === "ended") {
    throw new Error("the game has already ended");
  }
  if (state.pendingPunishment !== null) {
    throw new Error("the punishment has to be resolved before the turn can end");
  }
  if (state.pendingChain === null) {
    throw new Error("there is no chain to end");
  }
  const events: GameEvent[] = [];
  const moverPieceId = state.pendingChain.pieceId;
  return endOfTurn({ ...state, pendingChain: null }, state.turn, moverPieceId, events);
}

export function cloneState(state: GameState): GameState {
  return copyStateFields(state);
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(text: string): GameState {
  return copyStateFields(JSON.parse(text) as GameState);
}

function copyStateFields(state: GameState): GameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    rules: { ...state.rules },
    pendingChain: clonePendingChain(state.pendingChain),
    pendingPunishment: clonePendingPunishment(state.pendingPunishment),
    empowerment: {
      frenzyOpenPlayers: [...state.empowerment.frenzyOpenPlayers],
      activeBuffs: state.empowerment.activeBuffs.map((buff) => ({ ...buff })),
    },
    frenzy: cloneFrenzy(state.frenzy),
    lastMoveOrder: { ...state.lastMoveOrder },
    scores: { ...state.scores },
    kills: { ...state.kills },
    result: cloneResult(state.result),
    roundTurns: { ...state.roundTurns },
  };
}

function cloneResult(result: GameState["result"]): GameState["result"] {
  if (result === null) {
    return null;
  }
  return { ...result, scores: { ...result.scores }, kills: { ...result.kills } };
}

function findLegalMove(state: GameState, move: Move): Move | null {
  for (const candidate of legalMoves(state)) {
    if (sameSquare(candidate.from, move.from) && sameSquare(candidate.to, move.to)) {
      return candidate;
    }
  }
  return null;
}

function chainMoves(state: GameState): Move[] {
  const chain = state.pendingChain;
  if (chain === null) {
    return [];
  }
  const piece = pieceAt(state.board, chain.square);
  if (piece === null || piece.id !== chain.pieceId) {
    return [];
  }
  return captureMovesFor(state.board, chain.square, piece, moveContextFor(state, state.turn));
}

function removeVictims(state: GameState, piece: Piece, move: Move, events: GameEvent[]): GameState {
  let current = state;
  for (const victimSquare of move.kills) {
    const victim = pieceAt(current.board, victimSquare);
    if (victim === null) {
      throw new Error("there is nothing to capture on the victim square");
    }
    clearSquare(current.board, victimSquare);
    events.push({
      type: "kill",
      player: piece.player,
      victim: clonePiece(victim),
      victimSquare: { ...victimSquare },
      byPieceId: piece.id,
    });
    const outcome = scoreRemoval(current, piece.player, victim);
    events.push(outcome.event);
    current = outcome.state;
  }
  return current;
}

function placeMovedPiece(board: Board, piece: Piece, to: Square): Piece {
  const moved = clonePiece(piece);
  placePiece(board, to, moved);
  return moved;
}

function promoteIfReachedFarRow(piece: Piece, to: Square): Piece | null {
  if (piece.kind !== "pawn") {
    return null;
  }
  if (piece.player === "white" && to.row === 0) {
    return { ...piece, kind: "king" };
  }
  if (piece.player === "purple" && to.row === 7) {
    return { ...piece, kind: "king" };
  }
  return null;
}

function recordMove(state: GameState, pieceId: number, kills: number): GameState {
  const order = state.moveCounter + 1;
  return {
    ...state,
    turnKills: state.turnKills + kills,
    moveCounter: order,
    lastMoveOrder: { ...state.lastMoveOrder, [String(pieceId)]: order },
  };
}

interface TurnLanding {
  piece: Piece;
  square: Square;
  killed: boolean;
}

function finishTurn(
  state: GameState,
  mover: Player,
  landing: TurnLanding,
  events: GameEvent[],
): MoveResult {
  if (wipeoutWinner(state.board) !== null) {
    return endByWipeout(state, events);
  }
  if (landing.killed && state.rules.killLink && chainAvailable(state, landing.square)) {
    const chain = { pieceId: landing.piece.id, square: { ...landing.square } };
    return { state: { ...state, pendingChain: chain }, events };
  }
  return endOfTurn({ ...state, pendingChain: null }, mover, landing.piece.id, events);
}

function chainAvailable(state: GameState, landing: Square): boolean {
  const piece = pieceAt(state.board, landing);
  if (piece === null) {
    return false;
  }
  return captureMovesFor(state.board, landing, piece, moveContextFor(state, state.turn)).length > 0;
}

function clonePendingChain(chain: GameState["pendingChain"]): GameState["pendingChain"] {
  if (chain === null) {
    return null;
  }
  return { pieceId: chain.pieceId, square: { ...chain.square } };
}

function clonePendingPunishment(
  pending: GameState["pendingPunishment"],
): GameState["pendingPunishment"] {
  if (pending === null) {
    return null;
  }
  return { victimPlayer: pending.victimPlayer };
}
