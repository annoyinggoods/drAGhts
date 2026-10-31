import { RulesConfig } from "../engine/types.js";

export interface DashboardRow {
  date: string;
  rules: string;
  mode: string;
  winner: string;
  pScore: number;
  p2Score: number;
}

export function getMuted(): boolean {
  try {
    return localStorage.getItem("draghts-muted") === "true";
  } catch {
    return false;
  }
}

export function setMuted(value: boolean): void {
  try {
    localStorage.setItem("draghts-muted", value ? "true" : "false");
  } catch {
  }
}

export function getDashboard(): DashboardRow[] {
  try {
    const raw = localStorage.getItem("draghts-dashboard");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as DashboardRow[];
  } catch {
  }
  return [];
}

export function setDashboard(rows: DashboardRow[]): void {
  try {
    localStorage.setItem("draghts-dashboard", JSON.stringify(rows));
  } catch {
  }
}

export function appendDashboard(row: DashboardRow): DashboardRow[] {
  const rows = getDashboard();
  rows.push(row);
  if (rows.length > 50) {
    rows.splice(0, rows.length - 50);
  }
  setDashboard(rows);
  return rows;
}

export function activeRulesLabel(config: RulesConfig): string {
  const nums: number[] = [];
  if (config.beatAnyDirection) nums.push(1);
  if (config.missKillPunishment) nums.push(2);
  if (config.fourDirectionStepping) nums.push(3);
  if (config.forcedFullSlide) nums.push(4);
  if (config.killLink) nums.push(5);
  if (config.extraTurnBonus) nums.push(6);
  if (config.queenBuff) nums.push(7);
  if (config.killFrenzy) nums.push(8);
  if (nums.length === 0) return "Classic";
  return nums.join(" ");
}
