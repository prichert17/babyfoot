// js/index-page.js
// ============================================================
// Logique de la page d'accueil : classement + graphique ELO
// ============================================================

import { state, onStateReady, recomputeAllEloFull, formatDate, formatDateShort, getActionLogs } from "./app.js";

let eloChart = null;

onStateReady(() => {
  const { sorted } = recomputeAllEloFull();
  renderHeroStats(sorted);
  renderRanking();
  renderDuos();
  renderEloChart(sorted);
  renderRecentMatches(sorted);
  renderActionLogs();
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

// ─── Duo Stats ──────────────────────────────────────────────
function calculateDuoStats() {
  const duoMap = {}; // Key: "id1-id2" (sorted), Value: { ids, matches, wins }
  
  // Only process 2v2 matches
  for (const m of state.matches) {
    if (m.mode !== "2v2" || m.teamA.length < 2 || m.teamB.length < 2) continue;
    
    // Duo A
    const duoA = [m.teamA[0].playerId, m.teamA[1].playerId].sort().join("-");
    const duoB = [m.teamB[0].playerId, m.teamB[1].playerId].sort().join("-");
    
    const isAWin = m.scoreA > m.scoreB;
    const isBWin = m.scoreB > m.scoreA;
    
    if (!duoMap[duoA]) duoMap[duoA] = { ids: [m.teamA[0].playerId, m.teamA[1].playerId], matches: 0, wins: 0 };
    duoMap[duoA].matches++;
    if (isAWin) duoMap[duoA].wins++;
    
    if (!duoMap[duoB]) duoMap[duoB] = { ids: [m.teamB[0].playerId, m.teamB[1].playerId], matches: 0, wins: 0 };
    duoMap[duoB].matches++;
    if (isBWin) duoMap[duoB].wins++;
  }
  
  // Convert to array and compute win rates, filter only duos with 3+ matches
  const duos = Object.entries(duoMap)
    .filter(([_, data]) => data.matches > 2)
    .map(([_, data]) => {
      return {
        ...data,
        winRate: data.matches > 0 ? ((data.wins / data.matches) * 100).toFixed(0) : 0
      };
    });
  
  // Sort by win rate, descending
  duos.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
  
  return duos;
}

function renderDuos() {
  const container = document.getElementById("duosContainer");
  if (!container) return;
  
  const duos = calculateDuoStats();
  if (!duos.length) {
    container.innerHTML = '<div class="empty-state">Pas assez de matchs 2v2 pour afficher les duos</div>';
    return;
  }
  
  const bestDuos = duos.slice(0, 3);
  const worstDuos = duos.slice(-3).reverse(); // Get last 3 and reverse to show worst first
  
  const duoCard = (duo, type) => {
    const names = duo.ids.map(id => state.players[id]?.name ?? "?").join(" & ");
    const colors = duo.ids.map(id => state.players[id]?.color ?? "#888");
    const bgStyle = `background: linear-gradient(135deg, ${colors[0]}22, ${colors[1]}22)`;
    const isBest = type === "best";
    const typeClass = isBest ? "best" : "worst";
    
    return `
      <div class="duo-card ${typeClass}" style="${bgStyle}">
        <div class="duo-names">
          ${duo.ids.map(id => `
            <span class="duo-player" style="color: ${state.players[id]?.color}">
              ${state.players[id]?.name ?? "?"}
            </span>
          `).join('<span class="duo-sep">&</span>')}
        </div>
        <div class="duo-stats">
          <div class="duo-stat">
            <span class="duo-stat-val" style="color: ${isBest ? 'var(--accent)' : 'var(--danger)'}">${duo.winRate}%</span>
            <span class="duo-stat-lbl">Win Rate</span>
          </div>
          <div class="duo-stat">
            <span class="duo-stat-val">${duo.wins}/${duo.matches}</span>
            <span class="duo-stat-lbl">Victoires</span>
          </div>
        </div>
      </div>
    `;
  };
  
  container.innerHTML = `
    <div class="duos-section">
      <div class="duos-subsection">
        <h3 class="duos-title">🏆 Meilleurs Duos</h3>
        <div class="duos-grid">
          ${bestDuos.map(duo => duoCard(duo, "best")).join("")}
        </div>
      </div>
      <div class="duos-subsection">
        <h3 class="duos-title">📉 Pires Duos</h3>
        <div class="duos-grid">
          ${worstDuos.map(duo => duoCard(duo, "worst")).join("")}
        </div>
      </div>
    </div>
  `;
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

// ─── Action Logs (Suppressions + Modifications) ────────────
function renderActionLogs() {
  const container = document.getElementById("deletionLog");
  if (!container) return;

  const logs = getActionLogs();
  if (!logs.length) {
    container.innerHTML = '<div class="empty-state" style="color: #ccc; font-size: 0.85rem;">Aucune action enregistrée</div>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const timestamp = new Date(log.timestamp);
    const timeStr = timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const dateStr = timestamp.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    
    let icon = "📝";
    let actionText = "Modification";
    let actionColor = "#667eea";
    
    if (log.action === "deletion") {
      icon = "🗑️";
      actionText = "Suppression";
      actionColor = "#ff6b6b";
    } else if (log.action === "edit") {
      icon = "✏️";
      actionText = "Modification";
      actionColor = "#ffa500";
    }

    return `
      <div class="log-entry" style="padding: 0.75rem 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: flex-start; font-size: 0.85rem; color: #666;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-size: 1.1rem;">${icon}</span>
            <strong style="color: ${actionColor};">${actionText}</strong>
            <span style="color: #999; font-size: 0.8rem;">${log.mode}</span>
          </div>
          <div style="color: #555; margin-bottom: 0.25rem;">
            <span style="font-weight: 500;">${log.teamA}</span> vs <span style="font-weight: 500;">${log.teamB}</span>
          </div>
          <div style="color: #888; font-size: 0.8rem;">
            Score: <strong>${log.score}</strong>
            ${log.oldScore ? ` (avant: ${log.oldScore})` : ""}
          </div>
        </div>
        <div style="text-align: right; color: #999; white-space: nowrap; margin-left: 1rem;">
          <div style="font-size: 0.75rem;">${dateStr}</div>
          <div style="font-size: 0.75rem;">${timeStr}</div>
        </div>
      </div>
    `;
  }).join("");
}