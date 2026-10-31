import { Board, EndReason, GameState, Piece, Player, RoundTurns, ScoreEvent, ScorePair, Standing } from "./types.js";
import { countPieces } from "./board.js";

export const points = {
  pawnKill: 1,
  kingKill: 2,
  frenzyOpenBonus: 2,
  queenBuffBonus: 3,
  wipeoutWin: 10,
  blockageWin: 10,
} as const;

export const ENDGAME_ROUNDS = 20;

export interface ScoreOutcome {
  state: GameState;
  event: ScoreEvent;
}

export function emptyScores(): ScorePair {
  return { white: 0, purple: 0 };
}

export function emptyRoundTurns(): RoundTurns {
  return { white: false, purple: false };
}

export function onePieceCondition(board: Board): boolean {
  return countPieces(board, "white") === 1 || countPieces(board, "purple") === 1;
}

export function scoreRemoval(state: GameState, scorer: Player, victim: Piece): ScoreOutcome {
  const earned = victimPoints(state, victim);
  const scores = raiseScore(state.scores, scorer, earned);
  const kills = raiseScore(state.kills, scorer, 1);
  const updated: GameState = {
    ...state,
    scores,
    kills,
    endgameRounds: 0,
    roundHadKill: true,
    endgameCounting: onePieceCondition(state.board),
  };
  return { state: updated, event: { type: "score", player: scorer, delta: earned, scores } };
}

export function scoreFlatBonus(state: GameState, scorer: Player, amount: number): ScoreOutcome {
  const scores = raiseScore(state.scores, scorer, amount);
  const updated: GameState = { ...state, scores };
  return { state: updated, event: { type: "score", player: scorer, delta: amount, scores } };
}

export function standingOf(scores: ScorePair): Standing {
  if (scores.white > scores.purple) {
    return "white";
  }
  if (scores.purple > scores.white) {
    return "purple";
  }
  return "tie";
}

export function withFinalResult(state: GameState, reason: EndReason, winner: Player | null): GameState {
  const standing: Standing = winner === null ? "tie" : winner;
  const result = {
    winner: standing,
    reason,
    scores: { ...state.scores },
    kills: { ...state.kills },
  };
  return { ...state, result };
}

function victimPoints(state: GameState, victim: Piece): number {
  let earned = victim.kind === "king" ? points.kingKill : points.pawnKill;
  if (carriesQueenBuff(state, victim)) {
    earned += points.queenBuffBonus;
  } else if (diesInOpenFrenzy(state, victim)) {
    earned += points.frenzyOpenBonus;
  }
  return earned;
}

function carriesQueenBuff(state: GameState, victim: Piece): boolean {
  return state.empowerment.activeBuffs.some((buff) => buff.pieceId === victim.id);
}

function diesInOpenFrenzy(state: GameState, victim: Piece): boolean {
  return victim.kind === "pawn" && state.empowerment.frenzyOpenPlayers.includes(victim.player);
}

function raiseScore(pair: ScorePair, player: Player, amount: number): ScorePair {
  if (player === "white") {
    return { ...pair, white: pair.white + amount };
  }
  return { ...pair, purple: pair.purple + amount };
}
