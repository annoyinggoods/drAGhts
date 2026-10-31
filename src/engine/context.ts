import { GameState, MoveContext, Player } from "./types.js";

export function moveContextFor(state: GameState, player: Player): MoveContext {
  return {
    rules: state.rules,
    frenzyTurn: isFrenzyTurnFor(state, player),
    buffedPieceIds: state.empowerment.activeBuffs.map((buff) => buff.pieceId),
  };
}

function isFrenzyTurnFor(state: GameState, player: Player): boolean {
  if (!state.rules.killFrenzy) {
    return false;
  }
  if (player !== state.turn) {
    return false;
  }
  return state.frenzyTurn;
}
