import { Move } from "./types.js";

export function moveKey(move: Move): string {
  return [
    move.from.row,
    move.from.column,
    move.to.row,
    move.to.column,
    move.kind,
  ].join(",");
}

export function uniqueMoves(moves: Move[]): Move[] {
  const seen = new Set<string>();
  const unique: Move[] = [];
  for (const move of moves) {
    const key = moveKey(move);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(move);
  }
  return unique;
}
