import { GameState, Player, Square } from "../types.js";

export interface EvaluateOptions {
  aggression: number;
}

const WEIGHT_PAWN = 100;
const WEIGHT_KING = 160;
const WEIGHT_BACK_ROW = 60;
const WEIGHT_TWO_CENTRE = 40;
const WEIGHT_OTHER_CENTRE = 10;
const WEIGHT_QUEEN_BUFF = 80;
const WEIGHT_FRENZY_OPEN = 40;
const WEIGHT_PENDING_FRENZY = 60;

export function evaluate(state: GameState, options: EvaluateOptions): number {
  const player = state.turn;
  const aggression = clampAggression(options.aggression);
  const ownWeight = ownPieceWeight(aggression);
  const captureWeight = aggressionCaptureWeight(aggression);

  if (state.status === "ended") {
    const winner = state.result?.winner ?? null;
    // tie scores neutral; upstream scores tie as loss
    if (winner === null || winner === "tie") {
      return 0;
    }
    return winner === player ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  for (let row = 0; row < state.board.length; row++) {
    const rowData = state.board[row];
    if (!rowData) continue;
    for (let col = 0; col < rowData.length; col++) {
      const cell = rowData[col];
      if (cell === null || cell === undefined) {
        continue;
      }
      const piece = cell;
      const square: Square = { row, column: col };
      let value = pieceValue(state, piece, square);
      if (piece.player === player) {
        value *= ownWeight;
      } else {
        value *= captureWeight;
        value = -value;
      }
      score += value;
    }
  }

  if (state.frenzy[player].armed) {
    score += WEIGHT_PENDING_FRENZY;
  }

  return score;
}

function clampAggression(raw: number): number {
  return Math.max(1, Math.min(5, raw));
}

function ownPieceWeight(aggression: number): number {
  return 1.4 - (aggression - 1) * 0.1;
}

function aggressionCaptureWeight(aggression: number): number {
  return 1.0 + (aggression - 1) * 0.3;
}

function backRowFor(player: Player): number {
  if (player === "white") {
    return 7;
  }
  return 0;
}

function pieceValue(
  state: GameState,
  piece: { player: string; kind: string; id: number },
  square: Square
): number {
  let value = 0;
  if (piece.kind === "king") {
    value += WEIGHT_KING;
  } else {
    value += WEIGHT_PAWN;
  }

  value += pawnOnlyPositional(piece, square);

  const hasBuff = state.empowerment.activeBuffs.some(
    (buff) => buff.pieceId === piece.id
  );
  if (hasBuff) {
    value += WEIGHT_QUEEN_BUFF;
  }

  if (
    piece.kind === "pawn" &&
    state.empowerment.frenzyOpenPlayers.includes(piece.player as Player)
  ) {
    value += WEIGHT_FRENZY_OPEN;
  }

  return value;
}

function pawnOnlyPositional(
  piece: { player: string; kind: string },
  square: Square
): number {
  if (piece.kind !== "pawn") {
    return 0;
  }
  let bonus = 0;
  if (square.row === backRowFor(piece.player as Player)) {
    bonus += WEIGHT_BACK_ROW;
  }
  if (isTwoCentre(square)) {
    bonus += WEIGHT_TWO_CENTRE;
  } else if (isOtherCentre(square)) {
    bonus += WEIGHT_OTHER_CENTRE;
  }
  return bonus;
}

function isTwoCentre(square: Square): boolean {
  return (square.row === 3 && square.column === 4) || (square.row === 4 && square.column === 3);
}

function isOtherCentre(square: Square): boolean {
  if (square.row < 2 || square.row > 5) {
    return false;
  }
  const isDark = (square.row + square.column) % 2 === 1;
  if (!isDark) {
    return false;
  }
  return !isTwoCentre(square);
}
