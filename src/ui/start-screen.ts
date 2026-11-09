import { GameState, RulesConfig } from "../engine/types.js";
import { createGame, startTurn } from "../engine/game.js";
import { validateRules, rulesWith, baseRules } from "../engine/rules.js";
import { addToast } from "./toasts.js";

export interface StartGameDetail {
  whitePlayer: string;
  purplePlayer: string;
  computerColour: string | null;
  firstTurn: string;
}

export interface StartScreenConfig {
  onStart: (state: GameState, computerGame: boolean, aggression: number, depth: number, detail?: StartGameDetail) => void;
  onDashboard: () => void;
  onPlayAgain?: () => void;
  currentRules?: RulesConfig;
}

export interface StartScreenUI {
  container: HTMLElement;
}

let gameActive = false;

export function isGameActive(): boolean {
  return gameActive;
}

export class StartScreen {
  public container: HTMLElement;
  private config: StartScreenConfig;
  private rules: RulesConfig;
  private starting = false;

  constructor(container: HTMLElement, config: StartScreenConfig) {
    this.container = container;
    this.config = config;
    this.rules = config.currentRules ?? baseRules();
  }

  public show(): void {
    gameActive = false;
    this.container.dataset.gameActive = "false";
    this.container.style.display = "block";
    this.starting = false;
    this.render();
    this.attach();
  }

  private render(): void {
    const chaosRules = rulesWith({
      beatAnyDirection: true,
      missKillPunishment: true,
      forcedFullSlide: true,
      killLink: true,
      extraTurnBonus: true,
      queenBuff: true,
      killFrenzy: true,
    });
    const chaosActive = isSameRules(this.rules, chaosRules);
    const customActive = !isSameRules(this.rules, baseRules()) && !chaosActive;

    const togglesHTML = [
      { n: 1, label: "Beat any direction", key: "beatAnyDirection" },
      { n: 2, label: "Miss a kill, lose pawn", key: "missKillPunishment" },
      { n: 3, label: "Four-direction stepping", key: "fourDirectionStepping" },
      { n: 4, label: "Forced full slide", key: "forcedFullSlide" },
      { n: 5, label: "Kill link", key: "killLink" },
      { n: 6, label: "Extra turn bonus", key: "extraTurnBonus" },
      { n: 7, label: "Queen buff", key: "queenBuff" },
      { n: 8, label: "Kill frenzy", key: "killFrenzy" },
    ]
      .map(
        (t) => `
      <label class="toggle-label" aria-label="Rule ${t.n}">
        <input type="checkbox" data-rule="${t.n}" ${this.rules[t.key as keyof RulesConfig] ? "checked" : ""}>
        <span class="toggle-text">Rule ${t.n}: ${t.label}</span>
      </label>
    `,
      )
      .join("");

    this.container.innerHTML = `
      <div class="start-screen" aria-label="Start screen">
        <h2>drAGhts</h2>
        <section aria-label="Game mode">
          <h3>Mode</h3>
          <div class="mode-choices">
            <label><input type="radio" name="mode" value="hotseat" checked> Hot-seat</label>
            <label><input type="radio" name="mode" value="computer"> Computer</label>
          </div>
        </section>
        <section aria-label="Preset">
          <h3>Preset</h3>
          <div class="preset-choices">
            <label><input type="radio" name="preset" value="classic" ${!chaosActive && !customActive ? "checked" : ""}> Classic</label>
            <label><input type="radio" name="preset" value="chaos" ${chaosActive ? "checked" : ""}> Chaos</label>
            <label><input type="radio" name="preset" value="custom" ${customActive ? "checked" : ""}> Custom</label>
          </div>
        </section>
        <section id="computer-options" style="display:none;" aria-label="Computer options">
          <h3>Computer</h3>
          <label>Aggression <input type="range" id="aggression-slider" min="1" max="5" value="3"></label>
          <div class="difficulty-choices">
            <label><input type="radio" name="difficulty" value="2" checked> Easy (depth 2)</label>
            <label><input type="radio" name="difficulty" value="4"> Medium (depth 4)</label>
            <label><input type="radio" name="difficulty" value="6"> Hard (depth 6)</label>
          </div>
        </section>
        <section id="toggles-section" aria-label="Rule toggles" style="display:${customActive ? "block" : "none"};">
          <h3>Rules</h3>
          <div class="toggles" id="toggles">${togglesHTML}</div>
        </section>
        <div class="start-actions">
          <button type="button" id="start-btn">Start Game</button>
          <button type="button" id="dashboard-btn">Dashboard</button>
        </div>
        <div id="coin-flip" aria-live="polite" aria-atomic="true"></div>
      </div>
    `;
  }

  private attach(): void {
    const modeInputs = this.container.querySelectorAll('input[name="mode"]');
    modeInputs.forEach((el) => {
      el.addEventListener("change", () => {
        const isComputer = (this.container.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value === "computer";
        const compSection = this.container.querySelector("#computer-options") as HTMLElement | null;
        if (compSection) {
          compSection.style.display = isComputer ? "block" : "none";
        }
      });
    });

    const presetInputs = this.container.querySelectorAll('input[name="preset"]');
    presetInputs.forEach((el) => {
      el.addEventListener("change", () => {
        const value = (this.container.querySelector('input[name="preset"]:checked') as HTMLInputElement)?.value;
        const togglesSection = this.container.querySelector("#toggles-section") as HTMLElement | null;
        if (value === "classic") {
          this.setTogglesFromConfig(baseRules());
          this.rules = baseRules();
          if (togglesSection) togglesSection.style.display = "none";
        } else if (value === "chaos") {
          const chaos = rulesWith({
            beatAnyDirection: true,
            missKillPunishment: true,
            forcedFullSlide: true,
            killLink: true,
            extraTurnBonus: true,
            queenBuff: true,
            killFrenzy: true,
          });
          this.setTogglesFromConfig(chaos);
          this.rules = chaos;
          if (togglesSection) togglesSection.style.display = "none";
        } else if (value === "custom") {
          if (togglesSection) togglesSection.style.display = "block";
        }
      });
    });

    const toggles = this.container.querySelectorAll('input[type="checkbox"]');
    toggles.forEach((el) => {
      el.addEventListener("change", () => {
        this.applyLiveValidation();
      });
    });

    const startBtn = this.container.querySelector("#start-btn") as HTMLButtonElement | null;
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        this.startGame();
      });
    }

    const dashBtn = this.container.querySelector("#dashboard-btn");
    if (dashBtn) {
      dashBtn.addEventListener("click", () => {
        this.config.onDashboard();
      });
    }
  }

  private applyLiveValidation(): void {
    const candidate = rulesWith(this.readToggles());
    const validated = validateRules(candidate);
    this.rules = validated.config;
    if (validated.corrections.length > 0) {
      this.setTogglesFromConfig(validated.config);
      for (const corr of validated.corrections) {
        addToast(corr.reason);
      }
    }
  }

  private readToggles(): Partial<RulesConfig> {
    const overrides: Partial<RulesConfig> = {};
    const keyMap: Record<number, keyof RulesConfig> = {
      1: "beatAnyDirection",
      2: "missKillPunishment",
      3: "fourDirectionStepping",
      4: "forcedFullSlide",
      5: "killLink",
      6: "extraTurnBonus",
      7: "queenBuff",
      8: "killFrenzy",
    };
    for (let n = 1; n <= 8; n++) {
      const el = this.container.querySelector(`input[data-rule="${n}"]`) as HTMLInputElement | null;
      if (el) {
        const key = keyMap[n];
        if (key) {
          (overrides as Record<string, boolean>)[key] = el.checked;
        }
      }
    }
    return overrides;
  }

  private setTogglesFromConfig(config: RulesConfig): void {
    const map: Record<number, keyof RulesConfig> = {
      1: "beatAnyDirection",
      2: "missKillPunishment",
      3: "fourDirectionStepping",
      4: "forcedFullSlide",
      5: "killLink",
      6: "extraTurnBonus",
      7: "queenBuff",
      8: "killFrenzy",
    };
    for (const entry of Object.entries(map)) {
      const n = Number(entry[0]);
      const key = entry[1] as keyof RulesConfig;
      const el = this.container.querySelector(`input[data-rule="${n}"]`) as HTMLInputElement | null;
      if (el) {
        el.checked = !!config[key];
      }
    }
  }

  private updateRulesFromUI(): void {
    this.rules = rulesWith(this.readToggles());
  }

  private startGame(): void {
    if (this.starting) return;
    this.updateRulesFromUI();
    const validated = validateRules(this.rules);
    this.rules = validated.config;
    if (validated.corrections.length > 0) {
      this.setTogglesFromConfig(validated.config);
      for (const corr of validated.corrections) {
        addToast(corr.reason);
      }
    }
    const correctedRules = this.rules;

    const isComputer = (this.container.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value === "computer";
    const aggressionEl = this.container.querySelector("#aggression-slider") as HTMLInputElement | null;
    const aggression = parseInt(aggressionEl?.value ?? "3", 10);
    const depthStr = (this.container.querySelector('input[name="difficulty"]:checked') as HTMLInputElement)?.value ?? "2";
    const depth = parseInt(depthStr, 10);

    const whiteFirst = Math.random() < 0.5;
    const initialTurn = (whiteFirst ? "white" : "purple") as "white" | "purple";
    const result = createGame(correctedRules);
    const gameState: GameState = startTurn({ ...result, turn: initialTurn });

    const whitePlayer = isComputer ? "Human" : "White";
    const purplePlayer = isComputer ? "Computer" : "Purple";
    const computerColour = isComputer ? "purple" : null;
    const detail: StartGameDetail = { whitePlayer, purplePlayer, computerColour, firstTurn: initialTurn };

    const coinFlipEl = this.container.querySelector("#coin-flip");
    if (coinFlipEl) {
      coinFlipEl.textContent = `Colour assigned: ${initialTurn === "white" ? "White plays first" : "Purple plays first"}`;
    }

    const gameArea = document.getElementById("game-area");
    if (gameArea) {
      gameArea.dataset.firstTurn = initialTurn;
      gameArea.dataset.whitePlayer = whitePlayer;
      gameArea.dataset.purplePlayer = purplePlayer;
      if (computerColour) {
        gameArea.dataset.computerColour = computerColour;
      } else {
        delete gameArea.dataset.computerColour;
      }
    }

    this.starting = true;
    const startBtn = this.container.querySelector("#start-btn") as HTMLButtonElement | null;
    if (startBtn) startBtn.disabled = true;

    window.setTimeout(() => {
      gameActive = true;
      this.container.dataset.gameActive = "true";
      this.container.style.display = "none";
      this.config.onStart(gameState, isComputer, aggression, depth, detail);
    }, 1200);
  }
}

function isSameRules(a: RulesConfig, b: RulesConfig): boolean {
  return (
    a.beatAnyDirection === b.beatAnyDirection &&
    a.missKillPunishment === b.missKillPunishment &&
    a.fourDirectionStepping === b.fourDirectionStepping &&
    a.forcedFullSlide === b.forcedFullSlide &&
    a.killLink === b.killLink &&
    a.extraTurnBonus === b.extraTurnBonus &&
    a.queenBuff === b.queenBuff &&
    a.killFrenzy === b.killFrenzy
  );
}
