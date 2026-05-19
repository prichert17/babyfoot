// js/index-page.js
// ============================================================
// Logique de la page d'accueil : classement + graphique ELO
// ============================================================

import { state, onStateReady, recomputeAllEloFull, formatDate, formatDateShort } from "./app.js";

let eloChart = null;

onStateReady(() => {
  const { sorted } = recomputeAllEloFull();
  renderHeroStats(sorted);
  renderRanking();
  renderEloChart(sorted);
  renderRecentMatches(sorted);
});

// ─── Hero Stats ──────────────────────────────────────────────
function renderHeroStats(sorted) {
  document.getElementById("totalPlayers").textContent = Object.keys(state.players).length;
  document.getElementById("totalMatches").textContent = sorted.length;

  const last = sorted[sorted.length - 1];
  document.getElementById("lastMatchDate").textContent = last
    ? formatDateShort(last.date) : "—";
}

// ─── Ranking Table ───────────────────────────────────────────
function renderRanking() {
  const tbody = document.getElementById("rankingBody");
  if (!tbody) return;

  const sorted = Object.values(state.players).sort((a, b) => b.elo - a.elo);
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">Aucun joueur enregistré</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map((p, i) => {
    const stats = getQuickStats(p.id);
    const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    const trendVal = getRecentTrend(p.id);
    const trendClass = trendVal > 0 ? "up" : trendVal < 0 ? "down" : "neutral";
    const trendText = trendVal > 0 ? `▲ +${trendVal}` : trendVal < 0 ? `▼ ${trendVal}` : "—";
    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td>
          <span class="player-chip">
            <span class="player-dot" style="background:${p.color}"></span>
            ${p.name}
          </span>
        </td>
        <td><span class="elo-val">${p.elo}</span></td>
        <td>${stats.total}</td>
        <td>${stats.wins}</td>
        <td><span class="winpct">${stats.winPct}%</span></td>
        <td class="text-muted">${stats.m1v1}</td>
        <td class="text-muted">${stats.m2v2}</td>
        <td><span class="trend ${trendClass}">${trendText}</span></td>
      </tr>`;
  }).join("");
}

function getQuickStats(playerId) {
  let total = 0, wins = 0, m1v1 = 0, m2v2 = 0;
  for (const m of state.matches) {
    const inA = m.teamA.some(p => p.playerId === playerId);
    const inB = m.teamB.some(p => p.playerId === playerId);
    if (!inA && !inB) continue;
    total++;
    if (m.mode === "1v1") m1v1++; else m2v2++;
    if ((inA && m.scoreA > m.scoreB) || (inB && m.scoreB > m.scoreA)) wins++;
  }
  return { total, wins, m1v1, m2v2, winPct: total > 0 ? ((wins / total) * 100).toFixed(0) : "0" };
}

function getRecentTrend(playerId) {
  // Somme des deltas ELO sur les 5 derniers matchs
  const sorted = [...state.matches].sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return da - db;
  });
  let delta = 0;
  let count = 0;
  for (let i = sorted.length - 1; i >= 0 && count < 5; i--) {
    const m = sorted[i];
    const involved = m.teamA.some(p => p.playerId === playerId) || m.teamB.some(p => p.playerId === playerId);
    if (!involved) continue;
    const ch = m._eloChanges?.[playerId];
    if (ch) delta += ch.delta;
    count++;
  }
  return delta;
}

// ─── ELO Chart ───────────────────────────────────────────────
function renderEloChart(sortedMatches) {
  const canvas = document.getElementById("eloChart");
  if (!canvas) return;

  // Build dataset per player
  const players = Object.values(state.players);
  if (!players.length) return;

  // Build X axis: index = match number (global)
  const labels = ["Début", ...sortedMatches.map((_, i) => `M${i + 1}`)];

  // Per player: track ELO evolution
  const datasets = players.map(p => {
    const { BASE_ELO } = { BASE_ELO: 1000 };
    const data = [BASE_ELO];
    for (const m of sortedMatches) {
      const prev = data[data.length - 1];
      const ch = m._eloChanges?.[p.id];
      data.push(ch ? ch.after : prev);
    }
    return {
      label: p.name,
      data,
      borderColor: p.color,
      backgroundColor: `${p.color}22`,
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: false,
    };
  });

  if (eloChart) eloChart.destroy();

  eloChart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: {
            color: "#8892a4",
            usePointStyle: true,
            pointStyle: "circle",
            font: { family: "DM Sans", size: 12 },
          }
        },
        tooltip: {
          backgroundColor: "#1c2030",
          borderColor: "#252a3a",
          borderWidth: 1,
          titleColor: "#e8ecf4",
          bodyColor: "#8892a4",
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ELO`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#252a3a" },
          ticks: { color: "#525d72", font: { family: "JetBrains Mono", size: 11 }, maxTicksLimit: 15 },
        },
        y: {
          grid: { color: "#252a3a" },
          ticks: { color: "#525d72", font: { family: "JetBrains Mono", size: 11 } },
        }
      }
    }
  });
}

// ─── Recent Matches ──────────────────────────────────────────
function renderRecentMatches(sortedMatches) {
  const container = document.getElementById("recentMatches");
  if (!container) return;

  const recent = [...sortedMatches].reverse().slice(0, 5);
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state">Aucun match enregistré</div>';
    return;
  }

  container.innerHTML = recent.map(m => matchCardHTML(m, false)).join("");
}

function matchCardHTML(m, showActions) {
  const pName = id => state.players[id]?.name ?? "?";
  const pColor = id => state.players[id]?.color ?? "#888";

  const teamAHTML = m.teamA.map(p => `
    <span class="match-player-name" style="color:${pColor(p.playerId)}">${pName(p.playerId)}</span>
    ${p.role ? `<span class="match-player-role">${p.role}</span>` : ""}
  `).join("");
  const teamBHTML = m.teamB.map(p => `
    <span class="match-player-name" style="color:${pColor(p.playerId)}">${pName(p.playerId)}</span>
    ${p.role ? `<span class="match-player-role">${p.role}</span>` : ""}
  `).join("");

  const winnerA = m.scoreA > m.scoreB;
  const winnerB = m.scoreB > m.scoreA;

  return `
    <div class="match-card">
      <span class="match-mode-badge">${m.mode.toUpperCase()}</span>
      <div class="match-teams">
        <div class="match-team">
          ${winnerA ? '<span class="winner-tag">VICTOIRE</span>' : winnerB ? '<span class="loser-tag">DÉFAITE</span>' : ''}
          <div class="match-players">${teamAHTML}</div>
        </div>
        <div class="match-score">
          ${m.scoreA} <span class="score-sep">—</span> ${m.scoreB}
        </div>
        <div class="match-team">
          ${winnerB ? '<span class="winner-tag">VICTOIRE</span>' : winnerA ? '<span class="loser-tag">DÉFAITE</span>' : ''}
          <div class="match-players">${teamBHTML}</div>
        </div>
      </div>
      <span class="match-date">${formatDate(m.date)}</span>
      ${m.comment ? `<div class="match-comment">"${m.comment}"</div>` : ""}
    </div>`;
}