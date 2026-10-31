import { GameState, Move } from "../types.js";
import { evaluate } from "./evaluate.js";
import { applyMove, endTurn, legalMoves } from "../game.js";
import { applyPunishment, pickVictim } from "../punishment.js";

export interface AlphaBetaOptions {
  depth: number;
  aggression: number;
  rng: () => number;
}

export async function chooseMove(
  state: GameState,
  options: AlphaBetaOptions
): Promise<Move> {
  checkDepth(options.depth);
  const aggression = clampAggression(options.aggression);
  const moves = legalMoves(state);
  if (moves.length === 0) {
    throw new Error("no available moves");
  }

  let bestMove: Move = moves[0] as Move;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of moves) {
    const result = applyMove(state, move);
    let evaluation: number;
    if (isSameSide(state, result.state)) {
      evaluation = await alphaBetaSearch({
        state: result.state,
        depth: options.depth - 1,
        alpha: Number.NEGATIVE_INFINITY,
        beta: Number.POSITIVE_INFINITY,
        aggression,
        rng: options.rng,
      });
    } else {
      evaluation = -(await alphaBetaSearch({
        state: result.state,
        depth: options.depth - 1,
        alpha: Number.NEGATIVE_INFINITY,
        beta: Number.POSITIVE_INFINITY,
        aggression,
        rng: options.rng,
      }));
    }

    // first win keeps lead; upstream picks last on ties
    if (evaluation > bestScore) {
      bestScore = evaluation;
      bestMove = move;
    }
  }

  return bestMove;
}

async function alphaBetaSearch(params: {
  state: GameState;
  depth: number;
  alpha: number;
  beta: number;
  aggression: number;
  rng: () => number;
}): Promise<number> {
  const { state, depth, alpha, beta, aggression, rng } = params;

  if (state.status === "ended") {
    return evaluate(state, { aggression });
  }

  if (state.pendingPunishment !== null) {
    return punishmentValue(state, aggression, rng);
  }

  if (depth === 0) {
    // no quiet extension; depth limit ends lookahead
    return evaluate(state, { aggression });
  }

  const moves = legalMoves(state);
  if (moves.length === 0) {
    if (state.pendingChain !== null) {
      return chainEndValue(state, aggression);
    }
    return evaluate(state, { aggression });
  }

  let value = Number.NEGATIVE_INFINITY;
  let currentAlpha = alpha;

  for (const move of moves) {
    const result = applyMove(state, move);
    let score: number;
    if (isSameSide(state, result.state)) {
      score = await alphaBetaSearch({
        state: result.state,
        depth: depth - 1,
        alpha: currentAlpha,
        beta,
        aggression,
        rng,
      });
    } else {
      score = -(await alphaBetaSearch({
        state: result.state,
        depth: depth - 1,
        alpha: -beta,
        beta: -currentAlpha,
        aggression,
        rng,
      }));
    }

    // fail-hard cutoff keeps bounds tight
    if (score >= beta) {
      return beta;
    }
    if (score > value) {
      value = score;
    }
    currentAlpha = Math.max(currentAlpha, score);
  }

  return value;
}

function isSameSide(before: GameState, after: GameState): boolean {
  return before.turn === after.turn;
}

function punishmentValue(state: GameState, aggression: number, rng: () => number): number {
  const victim = pickVictim(state, rng);
  if (victim === null) {
    return evaluate(state, { aggression });
  }
  const resolved = applyPunishment(state, victim.id);
  const raw = evaluate(resolved.state, { aggression });
  if (resolved.state.turn === state.turn) {
    return raw;
  }
  return -raw;
}

function chainEndValue(state: GameState, aggression: number): number {
  try {
    const ended = endTurn(state);
    const raw = evaluate(ended.state, { aggression });
    if (ended.state.turn === state.turn) {
      return raw;
    }
    return -raw;
  } catch {
    return evaluate(state, { aggression });
  }
}

function checkDepth(depth: number): void {
  if (depth !== 2 && depth !== 4 && depth !== 6) {
    throw new RangeError("depth must be 2, 4 or 6");
  }
}

function clampAggression(raw: number): number {
  if (raw < 1) {
    return 1;
  }
  if (raw > 5) {
    return 5;
  }
  return raw;
}
