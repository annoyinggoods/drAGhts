import { GameState } from "../engine/types.js";
import { getMuted, setMuted, activeRulesLabel } from "./localStorage.js";
import { stopFrenzyLoopSound } from "./sounds.js";

export interface HUDState {
  container: HTMLElement;
}

export class HUD {
  public container: HTMLElement;
  private onUpdate?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setUpdateCallback(cb: () => void): void {
    this.onUpdate = cb;
  }

  public init(): void {
    this.render();
  }

  public update(state: GameState): void {
    this.renderState(state);
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  public updateTurnBanner(text: string): void {
    const banner = this.container.querySelector("#hud-turn-banner");
    if (banner) {
      banner.textContent = text;
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="hud-container" aria-label="Game heads-up display">
        <div class="hud-row hud-scores-row" aria-live="polite" aria-atomic="true">
          <div class="hud-player" id="hud-white">
            <span class="player-label">WHITE</span>
            <span class="player-score" id="score-white">0</span>
            <span class="streak-chip" id="streak-white">frenzy 0/3</span>
          </div>
          <div class="hud-player" id="hud-purple">
            <span class="player-label">PURPLE</span>
            <span class="player-score" id="score-purple">0</span>
            <span class="streak-chip" id="streak-purple">frenzy 0/3</span>
          </div>
        </div>
        <div class="hud-row">
          <div class="turn-banner" id="hud-turn-banner" aria-live="assertive" aria-atomic="true"></div>
        </div>
        <div class="hud-row" id="countdown-row" style="display:none;" aria-live="polite" aria-atomic="true">
          <span class="countdown-chip" aria-label="Endgame rounds remaining">20 rounds</span>
        </div>
        <div class="hud-row rules-chips" aria-label="Active rules"></div>
        <div class="hud-row" style="justify-content: flex-end;">
          <button type="button" id="mute-btn" class="mute-btn" aria-label="Mute" title="Mute">Mute</button>
        </div>
      </div>
    `;
    const muteBtn = this.container.querySelector("#mute-btn") as HTMLButtonElement | null;
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        const newValue = !getMuted();
        setMuted(newValue);
        muteBtn.textContent = newValue ? "Unmute" : "Mute";
        muteBtn.setAttribute("aria-label", newValue ? "Unmute" : "Mute");
        if (newValue) {
          stopFrenzyLoopSound();
        }
      });
      muteBtn.textContent = getMuted() ? "Unmute" : "Mute";
      muteBtn.setAttribute("aria-label", getMuted() ? "Unmute" : "Mute");
    }
  }

  private renderState(state: GameState): void {
    const container = this.container.querySelector(".hud-container");
    if (!container) return;

    if (state.frenzyTurn) {
      container.classList.add("frenzy-active");
    } else {
      container.classList.remove("frenzy-active");
    }

    const scoreWhite = this.container.querySelector("#score-white");
    const scorePurple = this.container.querySelector("#score-purple");
    if (scoreWhite) scoreWhite.textContent = String(state.scores.white);
    if (scorePurple) scorePurple.textContent = String(state.scores.purple);

    const streakWhite = this.container.querySelector("#streak-white");
    const streakPurple = this.container.querySelector("#streak-purple");
    if (streakWhite) {
      streakWhite.textContent = streakLabel(state.frenzy.white.streak, state.frenzy.white.armed, state.frenzyTurn);
    }
    if (streakPurple) {
      streakPurple.textContent = streakLabel(state.frenzy.purple.streak, state.frenzy.purple.armed, state.frenzyTurn);
    }

    this.updateTurnBanner(`${state.turn.toUpperCase()} to move`);

    const countdownRow = this.container.querySelector("#countdown-row") as HTMLElement | null;
    if (countdownRow) {
      if (state.endgameCounting && state.endgameRounds > 0) {
        countdownRow.style.display = "flex";
        const chip = countdownRow.querySelector(".countdown-chip");
        if (chip) {
          chip.textContent = `${state.endgameRounds} rounds`;
          chip.setAttribute("aria-label", `${state.endgameRounds} rounds remaining`);
        }
      } else {
        countdownRow.style.display = "none";
      }
    }

    const rulesRow = this.container.querySelector(".rules-chips");
    if (rulesRow) {
      rulesRow.textContent = "";
      const label = activeRulesLabel(state.rules);
      if (label === "Classic") {
        const chip = document.createElement("span");
        chip.className = "rule-chip";
        chip.textContent = "Classic";
        rulesRow.appendChild(chip);
      } else {
        const parts = label.split(" ");
        for (const part of parts) {
          const chip = document.createElement("span");
          chip.className = "rule-chip";
          chip.textContent = part;
          rulesRow.appendChild(chip);
        }
      }
    }
  }
}

function streakLabel(streak: number, armed: boolean, frenzyTurn: boolean): string {
  if (armed || frenzyTurn) return "FRENZY!";
  return `frenzy ${streak}/3`;
}
