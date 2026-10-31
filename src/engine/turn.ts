import { GameEvent, GameState, MoveResult, Player, RoundTurns } from "./types.js";
import { opponentOf, wipeoutWinner } from "./board.js";
import { captureAvailableFor } from "./captures.js";
import { moveContextFor } from "./context.js";
import { closeFrenzyTurn, consumeArmedFrenzy, settleFrenzyStreak } from "./frenzy.js";
import { expireQueenBuffs, resolveKillBonuses } from "./bonuses.js";
import { hasAnyMove } from "./legalmoves.js";
import {
  ENDGAME_ROUNDS,
  emptyRoundTurns,
  onePieceCondition,
  points,
  scoreFlatBonus,
  standingOf,
  withFinalResult,
} from "./scoring.js";

export function startTurn(state: GameState): GameState {
  const consumed = consumeArmedFrenzy(state);
  const started: GameState = {
    ...consumed,
    turnKills: 0,
    pendingChain: null,
    moverStartedAsPawn: false,
    captureAvailable: false,
  };
  return {
    ...started,
    captureAvailable: captureAvailableFor(started.board, started.turn, moveContextFor(started, started.turn)),
  };
}

export function punishmentFires(state: GameState): boolean {
  if (!state.rules.missKillPunishment) {
    return false;
  }
  if (state.turnKills > 0) {
    return false;
  }
  return state.captureAvailable === true;
}

export function endOfTurn(
  state: GameState,
  mover: Player,
  moverPieceId: number | null,
  events: GameEvent[],
): MoveResult {
  if (punishmentFires(state)) {
    return suspendForPunishment(state, mover, events);
  }
  const streak = settleFrenzyStreak(state, mover);
  const bonus = resolveKillBonuses(streak.state, mover, moverPieceId);
  const expired: GameState = {
    ...bonus.state,
    empowerment: expireQueenBuffs(bonus.state.empowerment, mover, bonus.state.moveCounter),
  };
  const nextPlayer = bonus.bonus === "extraTurn" ? mover : opponentOf(mover);
  const closed = closeFrenzyTurn(expired, mover);
  const advanced = advanceRounds(closed, mover);
  return checkGameEnd(advanced, nextPlayer, events);
}

function suspendForPunishment(state: GameState, mover: Player, events: GameEvent[]): MoveResult {
  const pending: GameState = {
    ...state,
    turn: opponentOf(mover),
    captureAvailable: null,
    pendingPunishment: { victimPlayer: mover },
  };
  return { state: pending, events };
}

function markTurn(turns: RoundTurns, mover: Player): RoundTurns {
  if (mover === "white") {
    return { ...turns, white: true };
  }
  return { ...turns, purple: true };
}

function advanceRounds(state: GameState, mover: Player): GameState {
  const roundTurns = markTurn(state.roundTurns, mover);
  if (!roundTurns.white || !roundTurns.purple) {
    return { ...state, roundTurns };
  }
  const counting = onePieceCondition(state.board);
  const rounds = state.roundHadKill || !counting ? 0 : state.endgameRounds + 1;
  return {
    ...state,
    endgameRounds: rounds,
    roundHadKill: false,
    roundTurns: emptyRoundTurns(),
  };
}

export function endByWipeout(state: GameState, events: GameEvent[]): MoveResult {
  const winner = wipeoutWinner(state.board);
  if (winner === null) {
    throw new Error("a wipeout ending needs a side without pieces");
  }
  const scored = scoreFlatBonus(state, winner, points.wipeoutWin);
  events.push(scored.event);
  const loser = opponentOf(winner);
  events.push({ type: "gameEnd", reason: "wipeout", winner, loser, standing: winner });
  const concluded = withFinalResult(
    { ...scored.state, status: "ended", winner, endReason: "wipeout", pendingChain: null },
    "wipeout",
    winner,
  );
  return { state: concluded, events };
}

export function endByBlockage(state: GameState, events: GameEvent[]): MoveResult {
  const loser = state.turn;
  const winner = opponentOf(loser);
  const scored = scoreFlatBonus(state, winner, points.blockageWin);
  events.push(scored.event);
  events.push({ type: "gameEnd", reason: "blockage", winner, loser, standing: winner });
  const concluded = withFinalResult(
    { ...scored.state, status: "ended", winner, endReason: "blockage" },
    "blockage",
    winner,
  );
  return { state: concluded, events };
}

export function endByTwentyRounds(state: GameState, events: GameEvent[]): MoveResult {
  const standing = standingOf(state.scores);
  const winner = standing === "tie" ? null : standing;
  const loser = winner === null ? null : opponentOf(winner);
  events.push({ type: "gameEnd", reason: "twenty-rounds", winner, loser, standing });
  const concluded = withFinalResult(
    { ...state, status: "ended", winner, endReason: "twenty-rounds" },
    "twenty-rounds",
    winner,
  );
  return { state: concluded, events };
}

function checkGameEnd(state: GameState, nextPlayer: Player, events: GameEvent[]): MoveResult {
  if (wipeoutWinner(state.board) !== null) {
    return endByWipeout(state, events);
  }
  const next = startTurn({ ...state, turn: nextPlayer });
  if (!hasAnyMove(next, next.turn)) {
    return endByBlockage(next, events);
  }
  if (next.endgameRounds >= ENDGAME_ROUNDS) {
    return endByTwentyRounds(next, events);
  }
  return { state: next, events };
}
