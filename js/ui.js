// ============================================
// UI — Rendering helpers
// ============================================

const UI = (() => {

  // ── TOAST ─────────────────────────────────
  let toastTimer = null;
  const toast = (msg, type = 'success') => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 3000);
  };

  // ── PLAYER SELECT OPTIONS ──────────────────
  const populateSelects = (players, excludeIds = []) => {
    const selects = document.querySelectorAll('.player-select');
    selects.forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">— Joueur —</option>';
      players.forEach(p => {
        if (!excludeIds.includes(p.id)) {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.pseudo;
          sel.appendChild(opt);
        }
      });
      sel.value = currentVal;
    });
  };

  // ── RANKING ───────────────────────────────
  const renderRanking = (players, matches) => {
    const container = document.getElementById('ranking-list');
    if (!players.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><p>Aucun joueur enregistré.<br>Ajoutez des joueurs pour commencer !</p></div>`;
      return;
    }

    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    container.innerHTML = sorted.map((p, i) => {
      const rank = i + 1;
      const stats = ELO.computePlayerStats(p.id, matches);
      const rankClass = rank <= 3 ? `rank-${rank}` : '';

      return `
        <div class="rank-card ${rankClass}">
          <div class="rank-number">${rank}</div>
          <div class="rank-info">
            <div class="rank-name">${escHtml(p.pseudo)}</div>
            <div class="rank-stats">
              <span class="stat-pill">${stats.total} matchs</span>
              <span class="stat-pill win">✓ ${stats.wins}</span>
              <span class="stat-pill lose">✗ ${stats.losses}</span>
              <span class="stat-pill">${stats.winrate}% win</span>
              ${stats.matches2v2 > 0 ? `<span class="stat-pill">⚔ ATT×${stats.asAttaque}</span><span class="stat-pill">🛡 DEF×${stats.asDefense}</span>` : ''}
              <span class="stat-pill">1v1×${stats.matches1v1}</span>
              <span class="stat-pill">2v2×${stats.matches2v2}</span>
            </div>
          </div>
          <div>
            <div class="rank-elo">${p.elo}</div>
          </div>
        </div>
      `;
    }).join('');
  };

  // ── MATCHES LIST ──────────────────────────
  const renderMatches = (matches, players) => {
    const container = document.getElementById('matches-list');
    if (!matches.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><p>Aucun match enregistré pour l'instant.</p></div>`;
      return;
    }

    const pMap = {};
    players.forEach(p => pMap[p.id] = p.pseudo);

    const getNames = (team) => team.map(slot => {
      const name = pMap[slot.playerId] || '?';
      const roleStr = slot.role ? ` <small>(${slot.role === 'attaque' ? '⚔' : '🛡'})</small>` : '';
      return `${escHtml(name)}${roleStr}`;
    }).join(', ');

    const sorted = [...matches].sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));

    container.innerHTML = sorted.map(m => {
      const winA = m.scoreA > m.scoreB;
      const winB = m.scoreB > m.scoreA;
      const dateStr = formatDate(m.matchDate);

      return `
        <div class="match-card" data-id="${m.id}">
          <div class="match-team">
            <div class="match-mode-badge">${m.mode.toUpperCase()}</div>
            <div class="match-team-name">${getNames(m.teamA)}</div>
            ${m.comment ? `<div class="match-comment">"${escHtml(m.comment)}"</div>` : ''}
          </div>

          <div>
            <div class="match-score">
              <span class="${winA ? 'score-win' : 'score-lose'}">${m.scoreA}</span>
              <span class="score-sep"> — </span>
              <span class="${winB ? 'score-win' : 'score-lose'}">${m.scoreB}</span>
            </div>
            <div class="match-meta" style="text-align:center">${dateStr}</div>
          </div>

          <div class="match-team" style="text-align:right">
            <div class="match-team-name">${getNames(m.teamB)}</div>
          </div>

          <button class="match-edit-btn" data-edit="${m.id}" title="Modifier">✎</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit');
        App.openEditModal(id);
      });
    });
  };

  // ── PLAYERS GRID ──────────────────────────
  const renderPlayersGrid = (players, matches) => {
    const container = document.getElementById('players-grid');
    if (!players.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><p>Aucun joueur. Ajoutez-en un !</p></div>`;
      return;
    }

    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    container.innerHTML = sorted.map(p => {
      const stats = ELO.computePlayerStats(p.id, matches);
      return `
        <div class="player-card" data-id="${p.id}">
          <div class="player-card-name">
            <span class="player-display-name">${escHtml(p.pseudo)}</span>
            <div class="player-card-actions">
              <button class="edit-name-btn" data-id="${p.id}" title="Renommer (admin)">✎</button>
              <button class="delete-player-btn" data-id="${p.id}" title="Supprimer (admin)">🗑</button>
            </div>
          </div>
          <div class="player-card-elo">${p.elo} ELO</div>
          <div class="player-card-stats">
            <span>${stats.total} matchs · ${stats.winrate}% win</span>
            <span>✓ ${stats.wins} · ✗ ${stats.losses} · = ${stats.draws}</span>
            <span>1v1: ${stats.matches1v1} · 2v2: ${stats.matches2v2}</span>
            ${stats.matches2v2 > 0 ? `<span>⚔ ATT×${stats.asAttaque} · 🛡 DEF×${stats.asDefense}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.edit-name-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        App.adminEditPlayerName(id);
      });
    });

    container.querySelectorAll('.delete-player-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        App.adminDeletePlayer(id);
      });
    });
  };

  // ── ELO PREVIEW ──────────────────────────
  const renderEloPreview = (changes, players) => {
    const pMap = {};
    players.forEach(p => pMap[p.id] = p.pseudo);
    const container = document.getElementById('elo-preview');
    const content = document.getElementById('elo-preview-content');
    if (!changes || !changes.length) { container.classList.add('hidden'); return; }

    content.innerHTML = changes.map(c => {
      const sign = c.delta >= 0 ? '+' : '';
      const cls = c.delta >= 0 ? 'elo-change-pos' : 'elo-change-neg';
      return `<div class="elo-preview-row">
        <span>${escHtml(pMap[c.playerId] || '?')}</span>
        <span>${c.oldElo} → <strong>${c.newElo}</strong> <span class="${cls}">(${sign}${c.delta})</span></span>
      </div>`;
    }).join('');

    container.classList.remove('hidden');
  };

  // ── BUILD EDIT MODAL BODY ─────────────────
  const buildEditMatchForm = (match, players) => {
    const pMap = {};
    players.forEach(p => pMap[p.id] = p.pseudo);
    const is2v2 = match.mode === '2v2';

    const playerOpts = players.map(p => `<option value="${p.id}">${escHtml(p.pseudo)}</option>`).join('');

    const buildSelect = (slotId, selectedId) =>
      `<select class="player-select" id="edit-${slotId}"><option value="">— Joueur —</option>${playerOpts}</select>`;

    const buildRoleSelector = (slotId, role, hidden) =>
      `<div class="role-selector${hidden ? ' hidden' : ''}" id="edit-role-${slotId}">
        <button class="role-btn${role === 'attaque' ? ' active' : ''}" data-role="attaque">⚔ ATT</button>
        <button class="role-btn${role === 'defense' ? ' active' : ''}" data-role="defense">🛡 DEF</button>
      </div>`;

    const teamASlot0 = match.teamA[0] || {};
    const teamASlot1 = match.teamA[1] || {};
    const teamBSlot0 = match.teamB[0] || {};
    const teamBSlot1 = match.teamB[1] || {};

    const html = `
      <div class="match-form-container" style="max-width:100%">
        <div class="mode-selector">
          <button class="mode-btn${!is2v2 ? ' active' : ''}" id="edit-mode-1v1">1V1</button>
          <button class="mode-btn${is2v2 ? ' active' : ''}" id="edit-mode-2v2">2V2</button>
        </div>

        <div class="teams-container">
          <div class="team-card team-a">
            <div class="team-label">ÉQUIPE A</div>
            <div class="player-slots">
              <div class="player-slot" data-slot="ea0">
                ${buildSelect('a-0', teamASlot0.playerId)}
                ${buildRoleSelector('a-0', teamASlot0.role, !is2v2)}
              </div>
              <div class="player-slot${!is2v2 ? ' hidden' : ''}" id="edit-slot-a1">
                ${buildSelect('a-1', teamASlot1.playerId)}
                ${buildRoleSelector('a-1', teamASlot1.role || 'defense', false)}
              </div>
            </div>
            <div class="score-input-wrap">
              <label>SCORE</label>
              <input type="number" class="score-input" id="edit-score-a" min="0" max="99" value="${match.scoreA}" />
            </div>
          </div>
          <div class="vs-divider">VS</div>
          <div class="team-card team-b">
            <div class="team-label">ÉQUIPE B</div>
            <div class="player-slots">
              <div class="player-slot" data-slot="eb0">
                ${buildSelect('b-0', teamBSlot0.playerId)}
                ${buildRoleSelector('b-0', teamBSlot0.role, !is2v2)}
              </div>
              <div class="player-slot${!is2v2 ? ' hidden' : ''}" id="edit-slot-b1">
                ${buildSelect('b-1', teamBSlot1.playerId)}
                ${buildRoleSelector('b-1', teamBSlot1.role || 'defense', false)}
              </div>
            </div>
            <div class="score-input-wrap">
              <label>SCORE</label>
              <input type="number" class="score-input" id="edit-score-b" min="0" max="99" value="${match.scoreB}" />
            </div>
          </div>
        </div>

        <div class="form-field">
          <label>DATE DU MATCH</label>
          <input type="datetime-local" id="edit-match-date" value="${toDatetimeLocal(match.matchDate)}" />
        </div>

        <div class="form-field">
          <label>COMMENTAIRE <span class="optional">(optionnel)</span></label>
          <textarea id="edit-match-comment" rows="2">${escHtml(match.comment || '')}</textarea>
        </div>

        <button class="submit-btn" id="edit-save-btn">💾 SAUVEGARDER</button>
        <button class="delete-match-btn" id="edit-delete-btn">🗑 SUPPRIMER CE MATCH</button>
      </div>
    `;

    return html;
  };

  // ── HELPERS ───────────────────────────────
  const escHtml = (str) => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const toDatetimeLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return { toast, populateSelects, renderRanking, renderMatches, renderPlayersGrid, renderEloPreview, buildEditMatchForm, escHtml, formatDate, toDatetimeLocal };
})();