import { FrenzyState, FrenzyTracker, GameState, Player } from "./types.js";

export function emptyFrenzy(): FrenzyState {
  return {
    white: { streak: 0, armed: false },
    purple: { streak: 0, armed: false },
  };
}

export function cloneFrenzy(frenzy: FrenzyState): FrenzyState {
  return {
    white: { ...frenzy.white },
    purple: { ...frenzy.purple },
  };
}

export function consumeArmedFrenzy(state: GameState): GameState {
  const tracker = state.frenzy[state.turn];
  if (!tracker.armed) {
    return { ...state, frenzyTurn: false };
  }
  return {
    ...state,
    frenzyTurn: true,
    frenzy: withTracker(state.frenzy, state.turn, { streak: tracker.streak, armed: false }),
  };
}

export interface StreakStep {
  state: GameState;
  armed: boolean;
}

export function settleFrenzyStreak(state: GameState, mover: Player): StreakStep {
  if (!state.rules.killFrenzy) {
    return { state, armed: false };
  }
  const tracker = state.frenzy[mover];
  const streak = state.turnKills > 0 ? tracker.streak + 1 : 0;
  if (streak < 3) {
    const updated: GameState = {
      ...state,
      frenzy: withTracker(state.frenzy, mover, { streak, armed: tracker.armed }),
    };
    return { state: updated, armed: false };
  }
  const armed: GameState = {
    ...state,
    frenzy: withTracker(state.frenzy, mover, { streak: 0, armed: true }),
  };
  return { state: withOpenFrenzy(armed, mover), armed: true };
}

export function closeFrenzyTurn(state: GameState, mover: Player): GameState {
  if (!state.frenzyTurn) {
    return state;
  }
  const closed: GameState = { ...state, frenzyTurn: false };
  if (closed.frenzy[mover].armed) {
    return closed;
  }
  return {
    ...closed,
    empowerment: {
      ...closed.empowerment,
      frenzyOpenPlayers: closed.empowerment.frenzyOpenPlayers.filter((player) => player !== mover),
    },
  };
}

function withTracker(frenzy: FrenzyState, player: Player, tracker: FrenzyTracker): FrenzyState {
  return { ...frenzy, [player]: tracker };
}

function withOpenFrenzy(state: GameState, mover: Player): GameState {
  if (state.empowerment.frenzyOpenPlayers.includes(mover)) {
    return state;
  }
  return {
    ...state,
    empowerment: {
      ...state.empowerment,
      frenzyOpenPlayers: [...state.empowerment.frenzyOpenPlayers, mover],
    },
  };
}
