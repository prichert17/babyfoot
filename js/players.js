// js/players.js
// ============================================================
// Logique de la page Joueurs
// ============================================================

import {
  state, onStateReady, recomputeAllEloFull,
  addPlayer, editPlayer, computePlayerStats,
  formatDate, formatDateShort, showToast
} from "./app.js";

const COLOR_PRESETS = [
  "#00e87a","#00b8ff","#ff4757","#ffa502","#a55eea",
  "#ff6b81","#eccc68","#1e90ff","#ff6348","#2ed573"
];

let detailChart = null;
let allSorted = [];

onStateReady(() => {
  const { sorted } = recomputeAllEloFull();
  allSorted = sorted;
  renderPlayersGrid();
  renderColorPresets();
});

// ─── Color Presets ────────────────────────────────────────────
function renderColorPresets() {
  const container = document.getElementById("colorPresets");
  if (!container) return;
  container.innerHTML = COLOR_PRESETS.map(c => `
    <div class="color-preset" style="background:${c}" data-color="${c}" title="${c}"></div>
  `).join("");
  container.querySelectorAll(".color-preset").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("playerColor").value = el.dataset.color;
      container.querySelectorAll(".color-preset").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
    });
  });
}

// ─── Players Grid ─────────────────────────────────────────────
function renderPlayersGrid() {
  const grid = document.getElementById("playersGrid");
  if (!grid) return;

  const players = Object.values(state.players).sort((a, b) => b.elo - a.elo);
  if (!players.length) {
    grid.innerHTML = '<div class="empty-state">Aucun joueur enregistré</div>';
    return;
  }

  grid.innerHTML = players.map(p => {
    const stats = quickStats(p.id);
    return `
      <div class="player-card" style="--player-color:${p.color}">
        <div class="player-card-header">
          <div class="player-card-info">
            <div class="player-avatar" style="background:${p.color}">
              ${p.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="player-card-name">${p.name}</div>
              <div class="player-card-elo">ELO: <span style="color:var(--accent);font-weight:700">${p.elo}</span></div>
            </div>
          </div>
          <div class="player-card-actions">
            <button class="btn-icon" data-view="${p.id}" title="Voir stats">👁</button>
            <button class="btn-icon" data-edit="${p.id}" title="Modifier">✏️</button>
          </div>
        </div>
        <div class="player-mini-stats">
          <div class="mini-stat">
            <span class="mini-stat-val">${stats.total}</span>
            <span class="mini-stat-lbl">Matchs</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-val">${stats.wins}</span>
            <span class="mini-stat-lbl">Victoires</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-val">${stats.winPct}%</span>
            <span class="mini-stat-lbl">Win%</span>
          </div>
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => openPlayerDetail(btn.dataset.view));
  });
  grid.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit));
  });
}

function quickStats(playerId) {
  let total = 0, wins = 0;
  for (const m of state.matches) {
    const inA = m.teamA.some(p => p.playerId === playerId);
    const inB = m.teamB.some(p => p.playerId === playerId);
    if (!inA && !inB) continue;
    total++;
    if ((inA && m.scoreA > m.scoreB) || (inB && m.scoreB > m.scoreA)) wins++;
  }
  return { total, wins, winPct: total > 0 ? ((wins / total) * 100).toFixed(0) : "0" };
}

// ─── Add Player Modal ─────────────────────────────────────────
function openAddModal() {
  document.getElementById("playerModalTitle").textContent = "Nouveau joueur";
  document.getElementById("playerName").value = "";
  document.getElementById("playerColor").value = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
  document.getElementById("editPlayerId").value = "";
  document.getElementById("playerModal").classList.add("open");
}

function openEditModal(playerId) {
  const p = state.players[playerId];
  if (!p) return;
  document.getElementById("playerModalTitle").textContent = "Modifier le joueur";
  document.getElementById("playerName").value = p.name;
  document.getElementById("playerColor").value = p.color;
  document.getElementById("editPlayerId").value = playerId;
  document.getElementById("playerModal").classList.add("open");
}

function closePlayerModal() { document.getElementById("playerModal").classList.remove("open"); }

document.getElementById("btnAddPlayer")?.addEventListener("click", openAddModal);
document.getElementById("playerModalClose")?.addEventListener("click", closePlayerModal);
document.getElementById("cancelPlayer")?.addEventListener("click", closePlayerModal);
document.getElementById("playerModal")?.addEventListener("click", e => { if (e.target === e.currentTarget) closePlayerModal(); });

document.getElementById("savePlayer")?.addEventListener("click", async () => {
  const name = document.getElementById("playerName").value.trim();
  const color = document.getElementById("playerColor").value;
  const editId = document.getElementById("editPlayerId").value;
  if (!name) { showToast("Veuillez entrer un pseudo", "error"); return; }

  try {
    if (editId) {
      await editPlayer(editId, { name, color });
      showToast("Joueur modifié");
    } else {
      await addPlayer(name, color);
      showToast(`${name} ajouté !`);
    }
    closePlayerModal();
    const { sorted } = recomputeAllEloFull();
    allSorted = sorted;
    renderPlayersGrid();
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'enregistrement", "error");
  }
});

// ─── Player Detail Modal ──────────────────────────────────────
function openPlayerDetail(playerId) {
  const p = state.players[playerId];
  if (!p) return;

  const { sorted } = recomputeAllEloFull();
  const stats = computePlayerStats(playerId, sorted);
  if (!stats) return;

  document.getElementById("detailPlayerName").textContent = p.name;
  document.getElementById("detailPlayerName").style.color = p.color;

  const body = document.getElementById("playerDetailBody");

  // ELO History for chart
  const eloData = stats.eloHistory.map(h => h.elo);
  const eloLabels = stats.eloHistory.map((h, i) => i === 0 ? "Début" : `M${i}`);

  // Rivals
  const rivals = stats.oppList.slice(0, 10);
  const rivalsHTML = rivals.length
    ? rivals.map(r => `
        <div class="rival-card">
          <div>
            <span class="player-dot" style="background:${state.players[r.id]?.color ?? '#888'};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:.4rem"></span>
            <span class="rival-name">${r.name}</span>
          </div>
          <span class="rival-record">${r.wins}V / ${r.losses}D / ${r.draws}N</span>
        </div>`).join("")
    : '<p class="text-muted" style="font-size:.85rem">Aucun adversaire</p>';

    // Coequipiers
    const coep = stats.teammateList.slice(0,10);
    const coepHTML = coep.length
    ? coep.map(r => `
        <div class="rival-card">
          <div>
            <span class="player-dot" style="background:${state.players[r.id]?.color ?? '#888'};display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:.4rem"></span>
            <span class="rival-name">${r.name}</span>
          </div>
          <span class="rival-record">${r.wins}V / ${r.losses}D / ${r.draws}N</span>
        </div>`).join("")
    : '<p class="text-muted" style="font-size:.85rem">Aucun coéquipier</p>';


  // Player's matches
  const playerMatches = sorted.filter(m =>
    m.teamA.some(pp => pp.playerId === playerId) || m.teamB.some(pp => pp.playerId === playerId)
  ).reverse().slice(0, 20);

  body.innerHTML = `
    <!-- Stats grid -->
    <div class="detail-stats-grid">
      <div class="detail-stat-card">
        <span class="detail-stat-val" style="color:${p.color}">${p.elo}</span>
        <span class="detail-stat-lbl">ELO actuel</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.totalMatches}</span>
        <span class="detail-stat-lbl">Matchs</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.winPct}%</span>
        <span class="detail-stat-lbl">Win %</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.wins}</span>
        <span class="detail-stat-lbl">Victoires</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.losses}</span>
        <span class="detail-stat-lbl">Défaites</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.draws}</span>
        <span class="detail-stat-lbl">Nuls</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.matches1v1}</span>
        <span class="detail-stat-lbl">1 VS 1</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.matches2v2}</span>
        <span class="detail-stat-lbl">2 VS 2</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.matchesAtt}</span>
        <span class="detail-stat-lbl">Attaque</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.matchesDef}</span>
        <span class="detail-stat-lbl">Défense</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val">${stats.bestserie}</span>
        <span class="detail-stat-lbl">Meilleure série de victoires</span>
      </div>
    </div>

    <!-- ELO Chart -->
    <p class="detail-section-title">Évolution ELO</p>
    <div class="detail-chart-wrap">
      <canvas id="detailEloChart"></canvas>
    </div>

    <div class="detail-grid">
      <!-- Rivals -->
      <div>
        <p class="detail-section-title">Ils se font poutrer</p>
        ${rivalsHTML}
      </div>
      <!-- Rivals -->
      <div>
        <p class="detail-section-title">Ils me carry</p>
        ${coepHTML}
      </div>
      <!-- Recent matches -->
      <div>
        <p class="detail-section-title">Derniers matchs</p>
        <div class="detail-match-list">
          ${playerMatches.map(m => {
            const inA = m.teamA.some(pp => pp.playerId === playerId);
            const won = (inA && m.scoreA > m.scoreB) || (!inA && m.scoreB > m.scoreA);
            const lost = (inA && m.scoreA < m.scoreB) || (!inA && m.scoreB < m.scoreA);
            const resultClass = won ? "win" : lost ? "loss" : "";
            const resultText = won ? "WIN" : lost ? "PERD" : "NUL";
            const opponents = (inA ? m.teamB : m.teamA).map(pp => state.players[pp.playerId]?.name ?? "?").join(" & ");
            const ch = m._eloChanges?.[playerId];
            const deltaStr = ch ? (ch.delta > 0 ? `+${ch.delta}` : `${ch.delta}`) : "";
            return `<div class="detail-match-item">
              <span class="dm-result ${resultClass}">${resultText}</span>
              <span>vs <strong>${opponents}</strong></span>
              <span>${m.scoreA}–${m.scoreB}</span>
              ${ch ? `<span style="font-family:var(--font-mono);font-size:.75rem;color:${ch.delta >= 0 ? 'var(--accent)' : 'var(--danger)'}">${deltaStr}</span>` : ""}
              <span class="dm-date">${formatDateShort(m.date)}</span>
            </div>`;
          }).join("") || '<p class="text-muted" style="font-size:.85rem">Aucun match</p>'}
        </div>
      </div>
      
    </div>
  `;

  document.getElementById("playerDetailModal").classList.add("open");

  // Draw chart after DOM insert
  setTimeout(() => {
    const canvas = document.getElementById("detailEloChart");
    if (!canvas) return;
    if (detailChart) detailChart.destroy();
    detailChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: eloLabels,
        datasets: [{
          label: p.name,
          data: eloData,
          borderColor: p.color,
          backgroundColor: `${p.color}22`,
          borderWidth: 2.5,
          pointRadius: 4,
          tension: 0.35,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#1c2030",
            borderColor: "#252a3a",
            borderWidth: 1,
            titleColor: "#e8ecf4",
            bodyColor: "#8892a4",
          }
        },
        scales: {
          x: { grid: { color: "#252a3a" }, ticks: { color: "#525d72", font: { family: "JetBrains Mono", size: 10 } } },
          y: { grid: { color: "#252a3a" }, ticks: { color: "#525d72", font: { family: "JetBrains Mono", size: 10 } } }
        }
      }
    });
  }, 50);
}

function closeDetailModal() {
  document.getElementById("playerDetailModal").classList.remove("open");
  if (detailChart) { detailChart.destroy(); detailChart = null; }
}

document.getElementById("detailModalClose")?.addEventListener("click", closeDetailModal);
document.getElementById("playerDetailModal")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeDetailModal(); });