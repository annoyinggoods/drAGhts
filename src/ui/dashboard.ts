import { getDashboard, setDashboard } from "./localStorage.js";

export interface DashboardConfig {
  onClose: () => void;
}

export class Dashboard {
  public container: HTMLElement;
  private config: DashboardConfig;
  private trigger: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, config: DashboardConfig) {
    this.container = container;
    this.config = config;
  }

  public show(): void {
    this.trigger = document.activeElement as HTMLElement | null;
    const stored = getDashboard();
    const rows = [...stored].reverse();
    const rowsHTML = rows.length === 0
      ? '<p class="dashboard-empty">No finished games yet.</p>'
      : `<div class="dashboard-table-wrapper"><table aria-label="Finished games" class="dashboard-table">
          <thead><tr><th>Date</th><th>Rules</th><th>Mode</th><th>Winner</th><th>P</th><th>P2/AI</th></tr></thead>
          <tbody>
            ${rows.map((r) => `<tr><td>${r.date}</td><td>${r.rules}</td><td>${r.mode}</td><td>${r.winner}</td><td>${r.pScore}</td><td>${r.p2Score}</td></tr>`).join("")}
          </tbody>
        </table></div>`;

    this.container.innerHTML = `
      <div class="dashboard-modal" role="dialog" aria-label="Dashboard" aria-modal="true">
        <h2>Dashboard</h2>
        ${rowsHTML}
        <div class="dashboard-actions">
          <button type="button" id="clear-dashboard-btn">Clear</button>
          <button type="button" id="close-dashboard-btn">Close</button>
        </div>
      </div>
    `;
    this.container.style.display = "flex";

    const clearBtn = this.container.querySelector("#clear-dashboard-btn") as HTMLButtonElement | null;
    const closeBtn = this.container.querySelector("#close-dashboard-btn") as HTMLButtonElement | null;

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (confirm("Clear all dashboard entries?")) {
          setDashboard([]);
          this.show();
        }
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.hide();
        this.config.onClose();
      });
    }

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.hide();
        this.config.onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const modal = this.container.querySelector(".dashboard-modal") as HTMLElement | null;
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll("button")) as HTMLElement[];
      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", this.keyHandler);

    if (closeBtn) closeBtn.focus();
  }

  public hide(): void {
    this.container.style.display = "none";
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    if (this.trigger && document.contains(this.trigger)) {
      this.trigger.focus();
    }
    this.trigger = null;
  }
}
