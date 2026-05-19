// js/matches.js
// ============================================================
// Logique de la page Matchs
// ============================================================

import {
  state, onStateReady, recomputeAllEloFull,
  addMatch, editMatch, deleteMatch, exportCSV,
  formatDate, showToast, confirm as confirmDialog
} from "./app.js";
import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentMode = "1v1";
let allSorted = [];

onStateReady(() => {
  const { sorted } = recomputeAllEloFull();
  allSorted = sorted;
  populatePlayerSelects();
  renderMatches(sorted);
  updateMatchCount(sorted);
});

// ─── Mode toggle ─────────────────────────────────────────────
document.querySelectorAll(".toggle-btn[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".toggle-btn[data-mode]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    set2v2Visibility(currentMode === "2v2");
    populatePlayerSelects();
  });
});

function set2v2Visibility(is2v2) {
  document.getElementById("teamA2Row").style.display = is2v2 ? "flex" : "none";
  document.getElementById("teamB2Row").style.display = is2v2 ? "flex" : "none";
  document.getElementById("roleA1").style.display = is2v2 ? "flex" : "none";
  document.getElementById("roleB1").style.display = is2v2 ? "flex" : "none";
}

// ─── Role buttons ─────────────────────────────────────────────
document.querySelectorAll(".role-toggle").forEach(group => {
  group.querySelectorAll(".role-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
});

// ─── Populate selects ─────────────────────────────────────────
function populatePlayerSelects() {
  const players = Object.values(state.players).sort((a, b) => a.name.localeCompare(b.name));
  const selects = ["teamA1", "teamA2", "teamB1", "teamB2"];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Sélectionner joueur…</option>' +
      players.map(p => `<option value="${p.id}" style="color:${p.color}">${p.name}</option>`).join("");
    if (val) sel.value = val;
  });
}

// ─── Modal open / close ───────────────────────────────────────
function openModal(matchData = null) {
  const modal = document.getElementById("matchModal");
  const title = document.getElementById("modalTitle");

  // Reset form
  document.getElementById("editMatchId").value = "";
  document.getElementById("scoreA").value = 0;
  document.getElementById("scoreB").value = 0;
  document.getElementById("matchComment").value = "";
  document.getElementById("matchDate").value = toDatetimeLocal(new Date());

  // Reset mode to 1v1
  currentMode = "1v1";
  document.querySelectorAll(".toggle-btn[data-mode]").forEach(b => b.classList.toggle("active", b.dataset.mode === "1v1"));
  set2v2Visibility(false);
  ["teamA1", "teamA2", "teamB1", "teamB2"].forEach(id => { const s = document.getElementById(id); if (s) s.value = ""; });

  if (matchData) {
    title.textContent = "Modifier le match";
    document.getElementById("editMatchId").value = matchData.id;
    currentMode = matchData.mode;
    document.querySelectorAll(".toggle-btn[data-mode]").forEach(b => b.classList.toggle("active", b.dataset.mode === matchData.mode));
    set2v2Visibility(matchData.mode === "2v2");
    document.getElementById("scoreA").value = matchData.scoreA;
    document.getElementById("scoreB").value = matchData.scoreB;
    document.getElementById("matchComment").value = matchData.comment ?? "";

    const date = matchData.date?.toDate ? matchData.date.toDate() : new Date(matchData.date);
    document.getElementById("matchDate").value = toDatetimeLocal(date);

    // Fill players
    fillPlayerSlot("teamA1", "roleA1", matchData.teamA[0]);
    fillPlayerSlot("teamA2", "roleA2", matchData.teamA[1]);
    fillPlayerSlot("teamB1", "roleB1", matchData.teamB[0]);
    fillPlayerSlot("teamB2", "roleB2", matchData.teamB[1]);
  } else {
    title.textContent = "Nouveau match";
  }

  modal.classList.add("open");
}

function fillPlayerSlot(selectId, roleId, slot) {
  if (!slot) return;
  const sel = document.getElementById(selectId);
  if (sel) sel.value = slot.playerId ?? "";
  if (slot.role) {
    const group = document.getElementById(roleId);
    group?.querySelectorAll(".role-btn").forEach(b => b.classList.toggle("active", b.dataset.role === slot.role));
  }
}

function closeModal() { document.getElementById("matchModal").classList.remove("open"); }

document.getElementById("btnAddMatch")?.addEventListener("click", () => openModal());
document.getElementById("modalClose")?.addEventListener("click", closeModal);
document.getElementById("cancelMatch")?.addEventListener("click", closeModal);
document.getElementById("matchModal")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });

// ─── Save match ───────────────────────────────────────────────
document.getElementById("saveMatch")?.addEventListener("click", async () => {
  const mode = currentMode;
  const scoreA = parseInt(document.getElementById("scoreA").value) || 0;
  const scoreB = parseInt(document.getElementById("scoreB").value) || 0;
  const comment = document.getElementById("matchComment").value.trim();
  const dateVal = document.getElementById("matchDate").value;
  const editId = document.getElementById("editMatchId").value;

  // Build teams
  const getSlot = (selectId, roleId) => {
    const sel = document.getElementById(selectId);
    if (!sel?.value) return null;
    const roleGroup = document.getElementById(roleId);
    const activeRole = roleGroup?.querySelector(".role-btn.active")?.dataset.role ?? null;
    return { playerId: sel.value, role: activeRole };
  };

  const teamA = [getSlot("teamA1", "roleA1")];
  const teamB = [getSlot("teamB1", "roleB1")];
  if (mode === "2v2") {
    teamA.push(getSlot("teamA2", "roleA2"));
    teamB.push(getSlot("teamB2", "roleB2"));
  }

  if (teamA.some(p => !p) || teamB.some(p => !p)) {
    showToast("Veuillez sélectionner tous les joueurs", "error"); return;
  }

  // Check duplicate players
  const allIds = [...teamA, ...teamB].map(p => p.playerId);
  if (new Set(allIds).size !== allIds.length) {
    showToast("Un joueur ne peut pas jouer dans les deux équipes", "error"); return;
  }

  const date = dateVal ? Timestamp.fromDate(new Date(dateVal)) : Timestamp.now();
  const matchData = { mode, teamA: teamA.filter(Boolean), teamB: teamB.filter(Boolean), scoreA, scoreB, comment, date };

  try {
    if (editId) {
      await editMatch(editId, matchData);
      showToast("Match modifié avec succès");
    } else {
      await addMatch(matchData);
      showToast("Match enregistré !");
    }
    closeModal();
    const { sorted } = recomputeAllEloFull();
    allSorted = sorted;
    applyFilters();
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'enregistrement", "error");
  }
});

// ─── Render matches list ──────────────────────────────────────
function renderMatches(matches) {
  const container = document.getElementById("matchesList");
  if (!container) return;
  if (!matches.length) {
    container.innerHTML = '<div class="empty-state">Aucun match trouvé</div>';
    return;
  }
  // Show newest first
  const reversed = [...matches].reverse();
  container.innerHTML = reversed.map(m => matchCardHTML(m)).join("");

  // Attach actions
  container.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = state.matches.find(x => x.id === btn.dataset.edit);
      if (m) openModal({ ...m, _eloChanges: m._eloChanges });
    });
  });
  container.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Supprimer ce match ?", "Cette action est irréversible et recalcule tous les ELO.");
      if (!ok) return;
      try {
        await deleteMatch(btn.dataset.delete);
        showToast("Match supprimé");
        const { sorted } = recomputeAllEloFull();
        allSorted = sorted;
        applyFilters();
      } catch { showToast("Erreur lors de la suppression", "error"); }
    });
  });
  container.querySelectorAll("[data-elo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = allSorted.find(x => x.id === btn.dataset.elo);
      if (m) openEloModal(m);
    });
  });
}

function matchCardHTML(m) {
  const pName = id => state.players[id]?.name ?? "?";
  const pColor = id => state.players[id]?.color ?? "#888";

  const teamHTML = (team, score, winner) => {
    const label = winner ? '<span class="winner-tag">WIN</span>' : score < (team === m.teamA ? m.scoreB : m.scoreA) ? '<span class="loser-tag">PERD</span>' : '';
    return `<div class="match-team">
      ${label}
      <div class="match-players">
        ${team.map(p => `
          <span class="match-player-name" style="color:${pColor(p.playerId)}">${pName(p.playerId)}</span>
          ${p.role ? `<span class="match-player-role">${p.role}</span>` : ""}
        `).join("")}
      </div>
    </div>`;
  };

  const winA = m.scoreA > m.scoreB;
  const winB = m.scoreB > m.scoreA;

  return `
    <div class="match-card">
      <span class="match-mode-badge">${m.mode.toUpperCase()}</span>
      <div class="match-teams">
        ${teamHTML(m.teamA, m.scoreA, winA)}
        <div class="match-score">${m.scoreA} <span class="score-sep">—</span> ${m.scoreB}</div>
        ${teamHTML(m.teamB, m.scoreB, winB)}
      </div>
      <span class="match-date">${formatDate(m.date)}</span>
      <div class="match-actions">
        <button class="btn-icon" data-elo="${m.id}" title="Voir ELO">👁</button>
        <button class="btn-icon" data-edit="${m.id}" title="Modifier">✏️</button>
        <button class="btn-icon" data-delete="${m.id}" title="Supprimer">🗑</button>
      </div>
      ${m.comment ? `<div class="match-comment">"${m.comment}"</div>` : ""}
    </div>`;
}

// ─── ELO Detail Modal ─────────────────────────────────────────
function openEloModal(m) {
  const modal = document.getElementById("eloModal");
  const body = document.getElementById("eloModalBody");
  const allPlayers = [...m.teamA, ...m.teamB];

  body.innerHTML = `
    <table class="elo-detail-table">
      <thead><tr>
        <th style="text-align:left;color:var(--text3);font-size:.78rem;padding-bottom:.5rem">Joueur</th>
        <th style="text-align:right;color:var(--text3);font-size:.78rem">Avant</th>
        <th style="text-align:right;color:var(--text3);font-size:.78rem">Après</th>
        <th style="text-align:right;color:var(--text3);font-size:.78rem">Δ</th>
      </tr></thead>
      <tbody>
        ${allPlayers.map(p => {
          const ch = m._eloChanges?.[p.playerId];
          if (!ch) return "";
          const deltaClass = ch.delta > 0 ? "elo-change-pos" : ch.delta < 0 ? "elo-change-neg" : "";
          const deltaStr = ch.delta > 0 ? `+${ch.delta}` : `${ch.delta}`;
          return `<tr>
            <td>
              <span class="player-chip">
                <span class="player-dot" style="background:${state.players[p.playerId]?.color ?? '#888'}"></span>
                ${state.players[p.playerId]?.name ?? "?"}
                ${p.role ? `<span style="font-size:.7rem;color:var(--text3)">(${p.role})</span>` : ""}
              </span>
            </td>
            <td style="text-align:right;font-family:var(--font-mono)">${ch.before}</td>
            <td style="text-align:right;font-family:var(--font-mono);font-weight:600">${ch.after}</td>
            <td style="text-align:right" class="${deltaClass}">${deltaStr}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  modal.classList.add("open");
}
document.getElementById("eloModalClose")?.addEventListener("click", () => document.getElementById("eloModal").classList.remove("open"));
document.getElementById("eloModal")?.addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("open"); });

// ─── Filters ──────────────────────────────────────────────────
function applyFilters() {
  const search = document.getElementById("filterSearch")?.value.toLowerCase() ?? "";
  const mode = document.getElementById("filterMode")?.value ?? "";
  const from = document.getElementById("filterDateFrom")?.value;
  const to = document.getElementById("filterDateTo")?.value;

  let filtered = allSorted;

  if (mode) filtered = filtered.filter(m => m.mode === mode);

  if (search) {
    filtered = filtered.filter(m => {
      const all = [...m.teamA, ...m.teamB];
      return all.some(p => state.players[p.playerId]?.name.toLowerCase().includes(search));
    });
  }

  if (from) {
    const fromDate = new Date(from);
    filtered = filtered.filter(m => {
      const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
      return d >= fromDate;
    });
  }
  if (to) {
    const toDate = new Date(to + "T23:59:59");
    filtered = filtered.filter(m => {
      const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
      return d <= toDate;
    });
  }

  renderMatches(filtered);
  updateMatchCount(filtered);
}

["filterSearch","filterMode","filterDateFrom","filterDateTo"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", applyFilters);
  document.getElementById(id)?.addEventListener("change", applyFilters);
});

document.getElementById("clearFilters")?.addEventListener("click", () => {
  ["filterSearch","filterMode","filterDateFrom","filterDateTo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  applyFilters();
});

function updateMatchCount(matches) {
  const el = document.getElementById("matchCount");
  if (el) el.textContent = `${matches.length} match${matches.length !== 1 ? "s" : ""}`;
}

// ─── Export CSV ───────────────────────────────────────────────
document.getElementById("btnExportCSV")?.addEventListener("click", () => {
  exportCSV(allSorted);
  showToast("CSV exporté !");
});

// ─── Helpers ──────────────────────────────────────────────────
function toDatetimeLocal(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}