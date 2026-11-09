import { Empowerment, GameState, Player, QueenBuff } from "./types.js";

export type KillBonus = "none" | "extraTurn" | "queenBuff";

export interface BonusOutcome {
  state: GameState;
  bonus: KillBonus;
}

export function resolveKillBonuses(state: GameState, mover: Player, moverPieceId: number | null): BonusOutcome {
  if (state.turnKills >= 3 && state.rules.queenBuff) {
    if (moverPieceId === null || !state.moverStartedAsPawn) {
      return { state, bonus: "none" };
    }
    return { state: armQueenBuff(state, mover, moverPieceId), bonus: "queenBuff" };
  }
  if (state.turnKills >= 2 && state.rules.extraTurnBonus) {
    return { state, bonus: "extraTurn" };
  }
  return { state, bonus: "none" };
}

export function expireQueenBuffs(empowerment: Empowerment, mover: Player, moveCounter: number): Empowerment {
  const activeBuffs = empowerment.activeBuffs.filter(
    (buff) => buff.owner !== mover || buff.armedTurn >= moveCounter,
  );
  if (activeBuffs.length === empowerment.activeBuffs.length) {
    return empowerment;
  }
  return { ...empowerment, activeBuffs };
}

function armQueenBuff(state: GameState, owner: Player, pieceId: number): GameState {
  const armedTurn = state.moveCounter;
  const others = state.empowerment.activeBuffs.filter((buff) => buff.pieceId !== pieceId);
  const activeBuffs: QueenBuff[] = [...others, { pieceId, armedTurn, owner, moved: false }];
  return { ...state, empowerment: { ...state.empowerment, activeBuffs } };
}

export function markBuffMoved(state: GameState, pieceId: number): GameState {
  const activeBuffs = state.empowerment.activeBuffs.map((buff) =>
    buff.pieceId === pieceId ? { ...buff, moved: true } : buff,
  );
  return { ...state, empowerment: { ...state.empowerment, activeBuffs } };
}
