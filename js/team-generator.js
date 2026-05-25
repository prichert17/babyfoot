// js/team-generator.js
// ============================================================
// Générateur d'équipes aléatoires avec système d'équilibrage
// ============================================================

import { state, onStateReady, showToast } from "./app.js";
import { predictTeamVictory } from "./elo.js";

const STORAGE_KEY = "babyfoot_player_weights";
const TEAMS_COUNT = 2;
const PLAYERS_PER_TEAM = 2;

let selectedPlayers = [];
let playerWeights = {};

// ─── Initialisation ────────────────────────────────────────
onStateReady(() => {
  loadPlayerWeights();
  renderPlayerSelector();
  renderWeightsTable();
  attachEventListeners();
});

function attachEventListeners() {
  document.getElementById("btnSelectAll")?.addEventListener("click", selectAllPlayers);
  document.getElementById("btnClearAll")?.addEventListener("click", clearSelection);
  document.getElementById("btnGenerate")?.addEventListener("click", generateTeams);
}

// ─── Gestion des poids (probabilités) ──────────────────────
function loadPlayerWeights() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    playerWeights = JSON.parse(saved);
  } else {
    playerWeights = {};
  }
  // Initialize missing players with weight 1
  for (const id of Object.keys(state.players)) {
    if (!playerWeights[id]) {
      playerWeights[id] = 1;
    }
  }
  savePlayerWeights();
}

function savePlayerWeights() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playerWeights));
}

function increaseWeight(playerId) {
  if (!playerWeights[playerId]) playerWeights[playerId] = 1;
  playerWeights[playerId] += 0.5;
  savePlayerWeights();
}

function resetWeights() {
  for (const id of Object.keys(state.players)) {
    playerWeights[id] = 1;
  }
  savePlayerWeights();
}

// ─── Sélection des joueurs ────────────────────────────────
function renderPlayerSelector() {
  const container = document.getElementById("playersSelector");
  if (!container) return;

  const players = Object.values(state.players).sort((a, b) => a.name.localeCompare(b.name));
  if (!players.length) {
    container.innerHTML = '<div class="empty-state">Aucun joueur enregistré</div>';
    return;
  }

  container.innerHTML = `
    <div class="players-selector-grid">
      ${players.map(p => `
        <label class="player-checkbox-label">
          <input type="checkbox" class="player-checkbox" value="${p.id}" data-name="${p.name}">
          <span class="player-checkbox-visual" style="border-color: ${p.color}; background: ${p.color}22">
            <span class="player-checkbox-dot" style="background: ${p.color}"></span>
          </span>
          <span class="player-checkbox-name">${p.name}</span>
        </label>
      `).join("")}
    </div>
  `;

  // Attach checkbox listeners
  container.querySelectorAll(".player-checkbox").forEach(cb => {
    cb.addEventListener("change", updateSelectedPlayers);
  });
}

function updateSelectedPlayers() {
  const checkboxes = document.querySelectorAll(".player-checkbox:checked");
  selectedPlayers = Array.from(checkboxes).map(cb => ({
    id: cb.value,
    name: cb.dataset.name
  }));
}

function selectAllPlayers() {
  document.querySelectorAll(".player-checkbox").forEach(cb => {
    cb.checked = true;
  });
  updateSelectedPlayers();
}

function clearSelection() {
  document.querySelectorAll(".player-checkbox").forEach(cb => {
    cb.checked = false;
  });
  selectedPlayers = [];
}

// ─── Génération des équipes ────────────────────────────────
function generateTeams() {
  if (selectedPlayers.length < TEAMS_COUNT * PLAYERS_PER_TEAM) {
    showToast(`Besoin d'au moins ${TEAMS_COUNT * PLAYERS_PER_TEAM} joueurs!`, "error");
    return;
  }

  // Copy selected players and shuffle with weights
  const candidates = [...selectedPlayers];
  const teams = [];
  const selectedInTeams = new Set();

  // Generate each team
  for (let t = 0; t < TEAMS_COUNT; t++) {
    const team = [];
    for (let p = 0; p < PLAYERS_PER_TEAM; p++) {
      // Weighted random selection
      const player = weightedRandomPick(
        candidates.filter(c => !selectedInTeams.has(c.id)),
        playerWeights
      );
      if (!player) break;
      team.push(player);
      selectedInTeams.add(player.id);
    }
    teams.push(team);
  }

  // Increase weights for non-selected players
  for (const p of selectedPlayers) {
    if (!selectedInTeams.has(p.id)) {
      increaseWeight(p.id);
    }
  }

  renderGeneratedTeams(teams);
  renderWeightsTable();
}

function weightedRandomPick(candidates, weights) {
  if (candidates.length === 0) return null;

  // Calculate total weight
  let totalWeight = 0;
  for (const c of candidates) {
    totalWeight += (weights[c.id] || 1);
  }

  // Pick randomly based on weights
  let random = Math.random() * totalWeight;
  for (const c of candidates) {
    random -= (weights[c.id] || 1);
    if (random <= 0) return c;
  }

  // Fallback
  return candidates[0];
}

// ─── Affichage des équipes ────────────────────────────────
const TEAM_COLORS = [
  { name: "ROUGE", css: "#ff4757", dark: "#d63447" },
  { name: "BLEU", css: "#00b8ff", dark: "#0099d8" }
];

const POSITIONS = [
  { name: "Attaque", emoji: "⚔️" },
  { name: "Défense", emoji: "🛡️" }
];

function renderGeneratedTeams(teams) {
  const container = document.getElementById("teamsContainer");
  if (!container) return;

  // Préparer les données d'équipes enrichies avec ELO
  const enrichedTeams = teams.map(team =>
    team.map(player => ({
      ...player,
      ...state.players[player.id]
    }))
  );

  // Calculer la prédiction
  const prediction = predictTeamVictory(enrichedTeams[0], enrichedTeams[1], state.matches);

  // Déterminer quelle équipe est favorite
  const isFavorite0 = prediction.teamA_percent > prediction.teamB_percent;

  container.innerHTML = `
    <div class="generated-teams-grid">
      ${enrichedTeams.map((team, teamIdx) => {
        const teamColor = TEAM_COLORS[teamIdx];
        const shuffledPositions = [...POSITIONS].sort(() => Math.random() - 0.5);
        const probability = teamIdx === 0 ? prediction.teamA_percent : prediction.teamB_percent;
        const isFavorite = (teamIdx === 0 && isFavorite0) || (teamIdx === 1 && !isFavorite0);
        
        return `
          <div class="team-card" style="border-left: 4px solid ${teamColor.css}">
            <div class="team-header" style="background: ${teamColor.css}22">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div>
                  <h3 class="team-name" style="color: ${teamColor.css}; margin: 0">ÉQUIPE ${teamColor.name}</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="team-badge" style="background: ${teamColor.css}; color: #000">
                    ${teamColor.css === "#ff4757" ? "🔴" : "🔵"}
                  </span>
                  <div class="team-probability" style="background: ${teamColor.css}; color: #000; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 600; font-size: 0.95rem; min-width: 60px; text-align: center;">
                    ${probability}%
                  </div>
                  ${isFavorite ? '<span style="font-size: 1.2rem; margin-left: 0.25rem;">⭐</span>' : ''}
                </div>
              </div>
            </div>
            <div class="team-players">
              ${team.map((player, playerIdx) => {
                const position = shuffledPositions[playerIdx];
                return `
                  <div class="team-player">
                    <div class="player-position">
                      <span class="position-emoji">${position.emoji}</span>
                      <span class="position-name">${position.name}</span>
                    </div>
                    <div class="player-info" style="border-left: 3px solid ${player.color}; padding-left: 0.75rem">
                      <div class="player-name">${player.name}</div>
                      <div class="player-elo">ELO: ${Math.round(player.elo)}</div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
            <div class="team-stats" style="padding: 0.75rem; border-top: 1px solid ${teamColor.css}33; font-size: 0.85rem; color: #666;">
              <div>Moyenne ELO: <strong style="color: ${teamColor.css}">${teamIdx === 0 ? prediction.eloA : prediction.eloB}</strong></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>

    <!-- PRÉDICTION DÉTAILLÉE -->
    <div class="prediction-card" style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px; border: 1px solid #667eea30;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; color: #333; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
          🔮 PRÉDICTION DE VICTOIRE
        </h3>
        <span style="background: #667eea; color: white; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
          Confiance: ${prediction.confidence}%
        </span>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px; border-left: 4px solid ${TEAM_COLORS[0].css};">
          <div style="font-size: 2.5rem; font-weight: 700; color: ${TEAM_COLORS[0].css}; margin-bottom: 0.25rem;">
            ${prediction.teamA_percent}%
          </div>
          <div style="font-size: 0.9rem; color: #666;">Équipe ROUGE</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px; border-left: 4px solid ${TEAM_COLORS[1].css};">
          <div style="font-size: 2.5rem; font-weight: 700; color: ${TEAM_COLORS[1].css}; margin-bottom: 0.25rem;">
            ${prediction.teamB_percent}%
          </div>
          <div style="font-size: 0.9rem; color: #666;">Équipe BLEU</div>
        </div>
      </div>

      <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-size: 0.9rem; color: #555; line-height: 1.6;">
          <strong>Analyse:</strong> ${prediction.explanation}
          <br/>
          <span style="font-size: 0.85rem; color: #888; margin-top: 0.5rem; display: block;">
            Cette prédiction est basée sur les ELO, l'homogénéité des équipes et la forme récente des joueurs.
          </span>
        </div>
      </div>
    </div>
  `;
}

// ─── Table des poids ──────────────────────────────────────
function renderWeightsTable() {
  const container = document.getElementById("weightsTable");
  if (!container) return;

  const players = Object.values(state.players)
    .map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      weight: playerWeights[p.id] || 1
    }))
    .sort((a, b) => b.weight - a.weight);

  if (!players.length) return;

  // Calculate selection chance
  const totalWeight = players.reduce((sum, p) => sum + p.weight, 0);
  const maxChance = Math.max(...players.map(p => (p.weight / totalWeight) * 100));

  container.innerHTML = `
    <div class="weights-info">
      <p style="color: var(--text2); margin-bottom: 1rem;">
        Les joueurs qui ne sont pas sélectionnés voient leur probabilité augmenter pour la prochaine génération.
        <button class="btn btn-ghost" id="btnResetWeights" style="margin-left: 1rem;">Réinitialiser</button>
      </p>
    </div>
    <div class="weights-grid">
      ${players.map(p => {
        const chance = ((p.weight / totalWeight) * 100).toFixed(1);
        const barWidth = (chance / parseFloat((maxChance).toFixed(1))) * 100;
        return `
          <div class="weight-row">
            <div class="weight-player" style="color: ${p.color}">
              <span class="weight-dot" style="background: ${p.color}"></span>
              ${p.name}
            </div>
            <div class="weight-bar-container">
              <div class="weight-bar" style="width: ${barWidth}%; background: ${p.color}"></div>
            </div>
            <div class="weight-chance" style="color: ${p.color}; font-weight: 600">
              ${chance}%
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  document.getElementById("btnResetWeights")?.addEventListener("click", () => {
    resetWeights();
    renderWeightsTable();
    showToast("Poids réinitialisés!");
  });
}
