import { Board, Move, MoveContext, Piece, Player, RulesConfig, Square } from "./types.js";
import { DIAGONALS, diagonalSteps, forwardStep, inBounds, pieceAt, squaresWithPieces, walkRay } from "./board.js";
import { kingModeFor } from "./kingmode.js";
import { uniqueMoves } from "./moveset.js";

export interface Jump {
  from: Square;
  victim: Square;
  landing: Square;
}

export function captureMovesFor(board: Board, from: Square, piece: Piece, context: MoveContext): Move[] {
  if (context.buffedPieceIds.includes(piece.id)) {
    return flyingKingCaptures(board, from, piece);
  }
  if (piece.kind === "pawn") {
    return pawnCaptures(board, from, piece, context);
  }
  if (kingModeFor(context.rules) === "flying") {
    const jumps = flyingKingCaptures(board, from, piece);
    if (!context.rules.forcedFullSlide) {
      return jumps;
    }
    return [...jumps, ...kingReplacementCaptures(board, from, piece)];
  }
  return englishKingCaptures(board, from, piece);
}

export function pawnCaptures(board: Board, from: Square, piece: Piece, context: MoveContext): Move[] {
  if (context.frenzyTurn) {
    const hops = frenzyPawnCaptures(board, from, piece);
    if (!context.rules.forcedFullSlide) {
      return hops;
    }
    return uniqueMoves([...hops, ...replacementCaptures(board, from, piece)]);
  }
  if (context.rules.forcedFullSlide) {
    return replacementCaptures(board, from, piece);
  }
  return oneStepCaptures(board, from, piece, diagonalSteps(pawnCaptureDirections(piece, context.rules)));
}

export function pawnCaptureDirections(piece: Piece, rules: RulesConfig): number[] {
  if (rules.beatAnyDirection) {
    return [-1, 1];
  }
  return [forwardStep(piece.player)];
}

export function captureAvailableFor(board: Board, player: Player, context: MoveContext): boolean {
  for (const square of squaresWithPieces(board, player)) {
    const piece = pieceAt(board, square);
    if (piece === null) {
      continue;
    }
    if (captureMovesFor(board, square, piece, context).length > 0) {
      return true;
    }
  }
  return false;
}

export function frenzyPawnCaptures(board: Board, from: Square, piece: Piece): Move[] {
  return oneStepCaptures(board, from, piece, DIAGONALS);
}

export function replacementCaptures(board: Board, from: Square, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const [rowStep, columnStep] of diagonalSteps([forwardStep(piece.player)])) {
    const walk = walkRay(board, from, rowStep, columnStep);
    if (walk.blocker === null) {
      continue;
    }
    const blocker = pieceAt(board, walk.blocker);
    if (blocker === null || blocker.player === piece.player) {
      continue;
    }
    moves.push(captureMove({ from: { ...from }, victim: { ...walk.blocker }, landing: { ...walk.blocker } }));
  }
  return moves;
}

export function kingReplacementCaptures(board: Board, from: Square, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const [rowStep, columnStep] of DIAGONALS) {
    const walk = walkRay(board, from, rowStep, columnStep);
    if (walk.blocker === null) {
      continue;
    }
    const blocker = pieceAt(board, walk.blocker);
    if (blocker === null || blocker.player === piece.player) {
      continue;
    }
    moves.push(captureMove({ from: { ...from }, victim: { ...walk.blocker }, landing: { ...walk.blocker } }));
  }
  return moves;
}

export function englishKingCaptures(board: Board, from: Square, piece: Piece): Move[] {
  return oneStepCaptures(board, from, piece, DIAGONALS);
}

export function flyingKingCaptures(board: Board, from: Square, piece: Piece): Move[] {
  const moves: Move[] = [];
  for (const [rowStep, columnStep] of DIAGONALS) {
    const walk = walkRay(board, from, rowStep, columnStep);
    if (walk.blocker === null) {
      continue;
    }
    const jump: Jump = {
      from: { ...from },
      victim: { ...walk.blocker },
      landing: { row: walk.blocker.row + rowStep, column: walk.blocker.column + columnStep },
    };
    const capture = jumpCapture(board, piece, jump);
    if (capture !== null) {
      moves.push(capture);
    }
  }
  return moves;
}

export function jumpCapture(board: Board, piece: Piece, jump: Jump): Move | null {
  if (!inBounds(jump.victim.row, jump.victim.column)) {
    return null;
  }
  const victimPiece = pieceAt(board, jump.victim);
  if (victimPiece === null || victimPiece.player === piece.player) {
    return null;
  }
  if (!inBounds(jump.landing.row, jump.landing.column)) {
    return null;
  }
  if (pieceAt(board, jump.landing) !== null) {
    return null;
  }
  return captureMove(jump);
}

export function captureMove(jump: Jump): Move {
  return {
    from: { ...jump.from },
    to: { ...jump.landing },
    kind: "capture",
    kills: [{ ...jump.victim }],
  };
}

function oneStepCaptures(
  board: Board,
  from: Square,
  piece: Piece,
  steps: ReadonlyArray<readonly [number, number]>,
): Move[] {
  const moves: Move[] = [];
  for (const [rowStep, columnStep] of steps) {
    const jump: Jump = {
      from: { ...from },
      victim: { row: from.row + rowStep, column: from.column + columnStep },
      landing: { row: from.row + rowStep * 2, column: from.column + columnStep * 2 },
    };
    const capture = jumpCapture(board, piece, jump);
    if (capture !== null) {
      moves.push(capture);
    }
  }
  return moves;
}
