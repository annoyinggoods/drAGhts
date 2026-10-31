export type Player = "white" | "purple";

export type PieceKind = "pawn" | "king";

export interface Piece {
  player: Player;
  kind: PieceKind;
  id: number;
}

export interface Square {
  row: number;
  column: number;
}

export type Board = Array<Array<Piece | null>>;

export type KingMode = "english" | "flying";

export interface RulesConfig {
  beatAnyDirection: boolean;
  missKillPunishment: boolean;
  fourDirectionStepping: boolean;
  forcedFullSlide: boolean;
  killLink: boolean;
  extraTurnBonus: boolean;
  queenBuff: boolean;
  killFrenzy: boolean;
}

export type MoveKind = "quiet" | "capture";

export interface Move {
  from: Square;
  to: Square;
  kind: MoveKind;
  kills: Square[];
}

export type EndReason = "wipeout" | "blockage" | "twenty-rounds";

export type Standing = Player | "tie";

export interface ScorePair {
  white: number;
  purple: number;
}

export interface FinalResult {
  winner: Standing;
  reason: EndReason;
  scores: ScorePair;
  kills: ScorePair;
}

export interface KillEvent {
  type: "kill";
  player: Player;
  victim: Piece;
  victimSquare: Square;
  byPieceId: number;
}

export interface PromoteEvent {
  type: "promote";
  player: Player;
  pieceId: number;
  square: Square;
}

export interface PunishEvent {
  type: "punish";
  player: Player;
  victim: Piece;
  victimSquare: Square;
}

export interface ScoreEvent {
  type: "score";
  player: Player;
  delta: number;
  scores: ScorePair;
}

export interface GameEndEvent {
  type: "gameEnd";
  reason: EndReason;
  winner: Player | null;
  loser: Player | null;
  standing: Standing;
}

export type GameEvent = KillEvent | PromoteEvent | PunishEvent | ScoreEvent | GameEndEvent;

export type GameStatus = "inProgress" | "ended";

export interface PendingChain {
  pieceId: number;
  square: Square;
}

export interface PendingPunishment {
  victimPlayer: Player;
}

export interface QueenBuff {
  pieceId: number;
  armedTurn: number;
  owner: Player;
}

export interface Empowerment {
  frenzyOpenPlayers: Player[];
  activeBuffs: QueenBuff[];
}

export interface FrenzyTracker {
  streak: number;
  armed: boolean;
}

export interface FrenzyState {
  white: FrenzyTracker;
  purple: FrenzyTracker;
}

export interface MoveContext {
  rules: RulesConfig;
  frenzyTurn: boolean;
  buffedPieceIds: number[];
}

export type MoveOrder = { [pieceId: string]: number };

export type Rng = () => number;

export interface RoundTurns {
  white: boolean;
  purple: boolean;
}

export interface GameState {
  board: Board;
  turn: Player;
  rules: RulesConfig;
  status: GameStatus;
  winner: Player | null;
  endReason: EndReason | null;
  result: FinalResult | null;
  scores: ScorePair;
  kills: ScorePair;
  turnKills: number;
  captureAvailable: boolean | null;
  pendingChain: PendingChain | null;
  pendingPunishment: PendingPunishment | null;
  empowerment: Empowerment;
  frenzy: FrenzyState;
  frenzyTurn: boolean;
  moverStartedAsPawn: boolean;
  moveCounter: number;
  lastMoveOrder: MoveOrder;
  endgameRounds: number;
  endgameCounting: boolean;
  roundHadKill: boolean;
  roundTurns: RoundTurns;
}

export interface MoveResult {
  state: GameState;
  events: GameEvent[];
}
