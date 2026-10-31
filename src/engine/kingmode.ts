import { KingMode, RulesConfig } from "./types.js";

export function kingModeFor(rules: RulesConfig): KingMode {
  if (rules.forcedFullSlide || rules.queenBuff || rules.killFrenzy) {
    return "flying";
  }
  return "english";
}
