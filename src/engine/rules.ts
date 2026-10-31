import { KingMode, RulesConfig } from "./types.js";
import { kingModeFor } from "./kingmode.js";

export type RuleAction = "enabled" | "disabled";

export interface RuleCorrection {
  rule: number;
  action: RuleAction;
  reason: string;
}

export interface RuleValidation {
  config: RulesConfig;
  corrections: RuleCorrection[];
}

export function baseRules(): RulesConfig {
  return {
    beatAnyDirection: false,
    missKillPunishment: false,
    fourDirectionStepping: false,
    forcedFullSlide: false,
    killLink: false,
    extraTurnBonus: false,
    queenBuff: false,
    killFrenzy: false,
  };
}

export function rulesWith(overrides: Partial<RulesConfig>): RulesConfig {
  return { ...baseRules(), ...overrides };
}

export function kingMode(config: RulesConfig): KingMode {
  return kingModeFor(config);
}

export function validateRules(config: RulesConfig): RuleValidation {
  const corrected: RulesConfig = { ...config };
  const corrections: RuleCorrection[] = [];
  enableKillLink(corrected, corrections);
  resolveSteppingConflict(corrected, corrections);
  return { config: corrected, corrections };
}

function enableKillLink(config: RulesConfig, corrections: RuleCorrection[]): void {
  if (config.killLink) {
    return;
  }
  const needing: number[] = [];
  if (config.extraTurnBonus) {
    needing.push(6);
  }
  if (config.queenBuff) {
    needing.push(7);
  }
  if (needing.length === 0) {
    return;
  }
  config.killLink = true;
  corrections.push({
    rule: 5,
    action: "enabled",
    reason: `${ruleNames(needing)} need rule 5 (kill link) to count the kills of a chain, so rule 5 was turned on.`,
  });
}

function resolveSteppingConflict(config: RulesConfig, corrections: RuleCorrection[]): void {
  if (!config.fourDirectionStepping || !config.forcedFullSlide) {
    return;
  }
  config.fourDirectionStepping = false;
  corrections.push({
    rule: 3,
    action: "disabled",
    reason: "Rules 3 and 4 cannot both be on, so rule 4 was left on and rule 3 was turned off.",
  });
}

function ruleNames(numbers: number[]): string {
  const joined = numbers.join(" and ");
  if (numbers.length === 1) {
    return `Rule ${joined}`;
  }
  return `Rules ${joined}`;
}
