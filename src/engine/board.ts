import { Board, Piece, Player, Square } from "./types.js";

export const BOARD_SIZE = 8;

export const PURPLE_START_ROWS: ReadonlyArray<number> = [0, 1, 2];
export const WHITE_START_ROWS: ReadonlyArray<number> = [5, 6, 7];

export const DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function inBounds(row: number, column: number): boolean {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

export function isDark(row: number, column: number): boolean {
  return (row + column) % 2 === 1;
}

export function forwardStep(player: Player): number {
  return player === "white" ? -1 : 1;
}

export function opponentOf(player: Player): Player {
  return player === "white" ? "purple" : "white";
}

export function sameSquare(left: Square, right: Square): boolean {
  return left.row === right.row && left.column === right.column;
}

export function emptyBoard(): Board {
  const board: Board = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const cells: Array<Piece | null> = [];
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      cells.push(null);
    }
    board.push(cells);
  }
  return board;
}

export function initialBoard(): Board {
  const board = emptyBoard();
  let id = 1;
  for (const row of PURPLE_START_ROWS) {
    id = placeRow(board, row, "purple", id);
  }
  for (const row of WHITE_START_ROWS) {
    id = placeRow(board, row, "white", id);
  }
  return board;
}

export function placeRow(board: Board, row: number, player: Player, startId: number): number {
  let id = startId;
  for (let column = 0; column < BOARD_SIZE; column += 1) {
    if (!isDark(row, column)) {
      continue;
    }
    placePiece(board, { row, column }, { player, kind: "pawn", id });
    id += 1;
  }
  return id;
}

export function placePiece(board: Board, square: Square, piece: Piece): void {
  checkedRow(board, square)[square.column] = piece;
}

export function clearSquare(board: Board, square: Square): void {
  checkedRow(board, square)[square.column] = null;
}

export function pieceAt(board: Board, square: Square): Piece | null {
  const row = rowAt(board, square.row);
  if (!row) {
    return null;
  }
  return row[square.column] ?? null;
}

export function clonePiece(piece: Piece): Piece {
  return { player: piece.player, kind: piece.kind, id: piece.id };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece === null ? null : clonePiece(piece))));
}

export function countPieces(board: Board, player: Player): number {
  let total = 0;
  for (const row of board) {
    for (const piece of row) {
      if (piece !== null && piece.player === player) {
        total += 1;
      }
    }
  }
  return total;
}

export function wipeoutWinner(board: Board): Player | null {
  const white = countPieces(board, "white");
  const purple = countPieces(board, "purple");
  if (white === 0 && purple === 0) {
    return null;
  }
  if (white === 0) {
    return "purple";
  }
  if (purple === 0) {
    return "white";
  }
  return null;
}

export function piecesOf(board: Board, player: Player): Piece[] {
  const pieces: Piece[] = [];
  for (const square of squaresWithPieces(board, player)) {
    const piece = pieceAt(board, square);
    if (piece !== null) {
      pieces.push(clonePiece(piece));
    }
  }
  return pieces;
}

export function squareOfPiece(board: Board, pieceId: number): Square | null {
  for (const square of squaresWithPieces(board, "white")) {
    if (pieceAt(board, square)?.id === pieceId) {
      return square;
    }
  }
  for (const square of squaresWithPieces(board, "purple")) {
    if (pieceAt(board, square)?.id === pieceId) {
      return square;
    }
  }
  return null;
}

export function diagonalSteps(rowSteps: ReadonlyArray<number>): Array<readonly [number, number]> {
  const steps: Array<readonly [number, number]> = [];
  for (const rowStep of rowSteps) {
    steps.push([rowStep, -1], [rowStep, 1]);
  }
  return steps;
}

export interface RayWalk {
  empties: Square[];
  blocker: Square | null;
}

export function walkRay(
  board: Board,
  from: Square,
  rowStep: number,
  columnStep: number,
): RayWalk {
  const empties: Square[] = [];
  let row = from.row + rowStep;
  let column = from.column + columnStep;
  while (inBounds(row, column)) {
    const square = { row, column };
    if (pieceAt(board, square) !== null) {
      return { empties, blocker: square };
    }
    empties.push(square);
    row += rowStep;
    column += columnStep;
  }
  return { empties, blocker: null };
}

export function squaresWithPieces(board: Board, player: Player): Square[] {
  const squares: Square[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board.length; column += 1) {
      const piece = pieceAt(board, { row, column });
      if (piece !== null && piece.player === player) {
        squares.push({ row, column });
      }
    }
  }
  return squares;
}

function rowAt(board: Board, row: number): Array<Piece | null> | undefined {
  return board[row];
}

function checkedRow(board: Board, square: Square): Array<Piece | null> {
  const row = rowAt(board, square.row);
  if (row === undefined || square.column < 0 || square.column >= BOARD_SIZE) {
    throw new Error(`square ${square.row},${square.column} is outside the board`);
  }
  return row;
}
