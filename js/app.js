// ============================================
// APP — Main controller
// ============================================

const App = (() => {

  let currentMode = '1v1';      // '1v1' | '2v2'
  let currentView = 'ranking';  // active view

  // ── NAVIGATION ────────────────────────────
  const showView = (name) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const view = document.getElementById(`view-${name}`);
    if (view) view.classList.add('active');
    const btn = document.querySelector(`[data-view="${name}"]`);
    if (btn) btn.classList.add('active');
    currentView = name;

    // Close mobile menu
    document.getElementById('sidebar').classList.remove('open');

    // Refresh content
    switch (name) {
      case 'ranking':   refreshRanking(); break;
      case 'matches':   refreshMatches(); break;
      case 'add-player': refreshPlayersGrid(); break;
      case 'add-match': refreshAddMatchForm(); break;
    }
  };

  // ── DATA HELPERS ──────────────────────────
  const refreshRanking = () => {
    const players = Storage.getPlayers();
    const matches = Storage.getMatches();
    UI.renderRanking(players, matches);
  };

  const refreshMatches = () => {
    const players = Storage.getPlayers();
    const matches = Storage.getMatches();
    UI.renderMatches(matches, players);
  };

  const refreshPlayersGrid = () => {
    const players = Storage.getPlayers();
    const matches = Storage.getMatches();
    UI.renderPlayersGrid(players, matches);
  };

  const refreshAddMatchForm = () => {
    const players = Storage.getPlayers();
    UI.populateSelects(players);
    updateEloPreview();
  };

  // ── MODE SELECTOR (ADD MATCH) ─────────────
  const setMode = (mode) => {
    currentMode = mode;
    document.getElementById('mode-1v1').classList.toggle('active', mode === '1v1');
    document.getElementById('mode-2v2').classList.toggle('active', mode === '2v2');

    const slots2v2 = ['team-a-1', 'team-b-1'];
    const roleSlots = ['role-a-0', 'role-b-0'];

    if (mode === '2v2') {
      document.querySelector('[data-team="a"][data-slot="1"]').classList.remove('hidden');
      document.querySelector('[data-team="b"][data-slot="1"]').classList.remove('hidden');
      document.getElementById('role-a-0').classList.remove('hidden');
      document.getElementById('role-b-0').classList.remove('hidden');
    } else {
      document.querySelector('[data-team="a"][data-slot="1"]').classList.add('hidden');
      document.querySelector('[data-team="b"][data-slot="1"]').classList.add('hidden');
      document.getElementById('role-a-0').classList.add('hidden');
      document.getElementById('role-b-0').classList.add('hidden');
    }

    updateEloPreview();
  };

  // ── ROLE BUTTONS ──────────────────────────
  const initRoleButtons = (container = document) => {
    container.querySelectorAll('.role-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.role-selector');
        parent.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  };

  // ── GET ACTIVE ROLE IN SELECTOR ───────────
  const getActiveRole = (selectorId) => {
    const sel = document.getElementById(selectorId);
    if (!sel) return null;
    const active = sel.querySelector('.role-btn.active');
    return active ? active.getAttribute('data-role') : null;
  };

  // ── ELO PREVIEW ───────────────────────────
  const updateEloPreview = () => {
    const players = Storage.getPlayers();
    const match = buildMatchFromForm();
    if (!match) { UI.renderEloPreview(null, players); return; }

    const changes = ELO.computeMatchElo(match, players);
    UI.renderEloPreview(changes, players);
  };

  // ── BUILD MATCH OBJECT FROM FORM ──────────
  const buildMatchFromForm = (prefix = '') => {
    const sel = (id) => document.getElementById(id);
    const pA0 = sel(`${prefix}team-a-0`)?.value;
    const pB0 = sel(`${prefix}team-b-0`)?.value;
    const sA  = parseInt(sel(`${prefix}score-a`)?.value ?? '0');
    const sB  = parseInt(sel(`${prefix}score-b`)?.value ?? '0');

    if (!pA0 || !pB0) return null;

    const teamA = [{ playerId: pA0, role: prefix === '' ? getActiveRole('role-a-0') : getActiveRole('edit-role-a-0') }];
    const teamB = [{ playerId: pB0, role: prefix === '' ? getActiveRole('role-b-0') : getActiveRole('edit-role-b-0') }];

    const mode = prefix === '' ? currentMode : (sel('edit-mode-2v2')?.classList.contains('active') ? '2v2' : '1v1');

    if (mode === '2v2') {
      const pA1 = sel(`${prefix}team-a-1`)?.value;
      const pB1 = sel(`${prefix}team-b-1`)?.value;
      if (pA1) teamA.push({ playerId: pA1, role: prefix === '' ? getActiveRole('role-a-1') : getActiveRole('edit-role-a-1') });
      if (pB1) teamB.push({ playerId: pB1, role: prefix === '' ? getActiveRole('role-b-1') : getActiveRole('edit-role-b-1') });
    }

    // Uniqueness check
    const allIds = [...teamA.map(p => p.playerId), ...teamB.map(p => p.playerId)].filter(Boolean);
    if (new Set(allIds).size !== allIds.length) return null;

    return { mode, teamA, teamB, scoreA: sA, scoreB: sB };
  };

  // ── SUBMIT MATCH ──────────────────────────
  const submitMatch = () => {
    const match = buildMatchFromForm();
    if (!match) {
      UI.toast('Sélectionnez tous les joueurs (sans doublons) !', 'error');
      return;
    }

    const dateInput = document.getElementById('match-date').value;
    const matchDate = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    const comment = document.getElementById('match-comment').value.trim();

    // Compute ELO changes
    const players = Storage.getPlayers();
    const changes = ELO.computeMatchElo(match, players);

    // Save match
    Storage.addMatch({ ...match, matchDate, comment });

    // Update player ELOs
    changes.forEach(c => Storage.updatePlayerElo(c.playerId, c.newElo));

    UI.toast('Match enregistré ! 🎉', 'success');
    resetAddMatchForm();
    UI.renderEloPreview(null, players);
  };

  const resetAddMatchForm = () => {
    ['team-a-0','team-a-1','team-b-0','team-b-1'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('score-a').value = 0;
    document.getElementById('score-b').value = 0;
    document.getElementById('match-comment').value = '';
    document.getElementById('match-date').value = '';
  };

  // ── ADD PLAYER ────────────────────────────
  const addPlayer = () => {
    const input = document.getElementById('new-player-name');
    const pseudo = input.value.trim();
    if (!pseudo) { UI.toast('Entrez un pseudo !', 'error'); return; }

    const players = Storage.getPlayers();
    if (players.some(p => p.pseudo.toLowerCase() === pseudo.toLowerCase())) {
      UI.toast('Ce pseudo existe déjà !', 'error');
      return;
    }

    Storage.addPlayer(pseudo);
    input.value = '';
    UI.toast(`${pseudo} ajouté ! 👋`, 'success');
    refreshPlayersGrid();
  };

  // ── ADMIN AUTH ────────────────────────────
  const ADMIN_PASSWORD = 'admindaph';

  const askAdminPassword = () => {
    const pwd = prompt('🔒 Mot de passe administrateur requis :');
    if (pwd === null) return false; // annulé
    if (pwd !== ADMIN_PASSWORD) {
      alert('❌ Mot de passe incorrect.');
      return false;
    }
    return true;
  };

  // ── EDIT PLAYER NAME (ADMIN) ──────────────
  const adminEditPlayerName = (id) => {
    if (!askAdminPassword()) return;

    const players = Storage.getPlayers();
    const player = players.find(p => p.id === id);
    if (!player) return;

    const newName = prompt(`✏️ Nouveau pseudo pour "${player.pseudo}" :`, player.pseudo);
    if (newName === null) return; // annulé
    const trimmed = newName.trim();
    if (!trimmed) { alert('Le pseudo ne peut pas être vide.'); return; }
    if (trimmed === player.pseudo) return; // pas de changement

    if (players.some(p => p.id !== id && p.pseudo.toLowerCase() === trimmed.toLowerCase())) {
      alert('❌ Ce pseudo existe déjà !');
      return;
    }

    Storage.updatePlayerPseudo(id, trimmed);
    UI.toast(`Pseudo mis à jour : ${trimmed} ✅`, 'success');
    refreshPlayersGrid();
  };

  // ── DELETE PLAYER (ADMIN) ─────────────────
  const adminDeletePlayer = (id) => {
    if (!askAdminPassword()) return;

    const players = Storage.getPlayers();
    const player = players.find(p => p.id === id);
    if (!player) return;

    const confirmed = confirm(
      `🗑️ Supprimer le joueur "${player.pseudo}" ?\n\nAttention : ses matchs seront conservés mais associés à un joueur supprimé.`
    );
    if (!confirmed) return;

    // Remove player
    const updated = players.filter(p => p.id !== id);
    Storage.savePlayers(updated);

    UI.toast(`${player.pseudo} supprimé.`, 'success');
    refreshPlayersGrid();
  };

  // gardé pour compatibilité interne (non utilisé depuis l'UI)
  const startEditPlayerName = adminEditPlayerName;

  // ── EDIT MODAL ────────────────────────────
  const openEditModal = (matchId) => {
    const matches = Storage.getMatches();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const players = Storage.getPlayers();
    const body = document.getElementById('edit-modal-body');
    body.innerHTML = UI.buildEditMatchForm(match, players);

    // Set player values
    const setSelectVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    setSelectVal('edit-team-a-0', match.teamA[0]?.playerId);
    setSelectVal('edit-team-b-0', match.teamB[0]?.playerId);
    if (match.mode === '2v2') {
      setSelectVal('edit-team-a-1', match.teamA[1]?.playerId);
      setSelectVal('edit-team-b-1', match.teamB[1]?.playerId);
    }

    // Init role buttons
    initRoleButtons(body);

    // Mode toggle in modal
    const modeSetEdit = (mode) => {
      document.getElementById('edit-mode-1v1').classList.toggle('active', mode === '1v1');
      document.getElementById('edit-mode-2v2').classList.toggle('active', mode === '2v2');
      const slot2a = document.getElementById('edit-slot-a1');
      const slot2b = document.getElementById('edit-slot-b1');
      const role0a = document.getElementById('edit-role-a-0');
      const role0b = document.getElementById('edit-role-b-0');
      if (slot2a) slot2a.classList.toggle('hidden', mode === '1v1');
      if (slot2b) slot2b.classList.toggle('hidden', mode === '1v1');
      if (role0a) role0a.classList.toggle('hidden', mode === '1v1');
      if (role0b) role0b.classList.toggle('hidden', mode === '1v1');
    };

    body.querySelector('#edit-mode-1v1')?.addEventListener('click', () => modeSetEdit('1v1'));
    body.querySelector('#edit-mode-2v2')?.addEventListener('click', () => modeSetEdit('2v2'));

    // Save
    body.querySelector('#edit-save-btn').addEventListener('click', () => saveEditMatch(matchId));

    // Delete
    body.querySelector('#edit-delete-btn').addEventListener('click', () => {
      if (confirm('Supprimer ce match et recalculer les ELOs ?')) {
        Storage.deleteMatch(matchId);
        recalcAndSaveAllElos();
        closeEditModal();
        UI.toast('Match supprimé.', 'success');
        refreshMatches();
      }
    });

    document.getElementById('edit-modal').classList.remove('hidden');
  };

  const closeEditModal = () => {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('edit-modal-body').innerHTML = '';
  };

  const saveEditMatch = (matchId) => {
    const body = document.getElementById('edit-modal-body');
    const pA0 = document.getElementById('edit-team-a-0')?.value;
    const pB0 = document.getElementById('edit-team-b-0')?.value;
    const sA  = parseInt(document.getElementById('edit-score-a')?.value ?? '0');
    const sB  = parseInt(document.getElementById('edit-score-b')?.value ?? '0');
    const dateVal = document.getElementById('edit-match-date')?.value;
    const comment = document.getElementById('edit-match-comment')?.value.trim() ?? '';

    if (!pA0 || !pB0) { UI.toast('Sélectionnez les joueurs !', 'error'); return; }

    const is2v2 = body.querySelector('#edit-mode-2v2')?.classList.contains('active');
    const mode = is2v2 ? '2v2' : '1v1';

    const getRoleEdit = (selectorId) => {
      const sel = document.getElementById(selectorId);
      if (!sel) return null;
      const active = sel.querySelector('.role-btn.active');
      return active ? active.getAttribute('data-role') : null;
    };

    const teamA = [{ playerId: pA0, role: getRoleEdit('edit-role-a-0') }];
    const teamB = [{ playerId: pB0, role: getRoleEdit('edit-role-b-0') }];

    if (is2v2) {
      const pA1 = document.getElementById('edit-team-a-1')?.value;
      const pB1 = document.getElementById('edit-team-b-1')?.value;
      if (pA1) teamA.push({ playerId: pA1, role: getRoleEdit('edit-role-a-1') });
      if (pB1) teamB.push({ playerId: pB1, role: getRoleEdit('edit-role-b-1') });
    }

    const allIds = [...teamA, ...teamB].map(p => p.playerId).filter(Boolean);
    if (new Set(allIds).size !== allIds.length) {
      UI.toast('Un joueur ne peut pas être dans les deux équipes !', 'error');
      return;
    }

    const matchDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
    Storage.updateMatch(matchId, { mode, teamA, teamB, scoreA: sA, scoreB: sB, matchDate, comment });

    recalcAndSaveAllElos();
    closeEditModal();
    UI.toast('Match modifié ! ✅', 'success');
    refreshMatches();
  };

  // ── FULL ELO RECALC ───────────────────────
  const recalcAndSaveAllElos = () => {
    const players = Storage.getPlayers();
    const matches = Storage.getMatches();
    const elos = ELO.recalcAllElo(matches, players);
    players.forEach(p => {
      if (elos[p.id] !== undefined) Storage.updatePlayerElo(p.id, elos[p.id]);
    });
  };

  // ── CSV EXPORT ────────────────────────────
  const exportCsv = () => {
    const matches = Storage.getMatches();
    const players = Storage.getPlayers();
    if (!matches.length) { UI.toast('Aucun match à exporter.', 'error'); return; }

    const pMap = {};
    players.forEach(p => pMap[p.id] = p.pseudo);

    const headers = [
      'match_id','mode','date','score_a','score_b','winner',
      'player_a1','role_a1','player_a2','role_a2',
      'player_b1','role_b1','player_b2','role_b2',
      'comment'
    ];

    const rows = matches.map(m => {
      const winner = m.scoreA > m.scoreB ? 'A' : m.scoreB > m.scoreA ? 'B' : 'draw';
      const getSlot = (team, idx) => ({
        name: pMap[team[idx]?.playerId] ?? '',
        role: team[idx]?.role ?? ''
      });
      const a0 = getSlot(m.teamA, 0), a1 = getSlot(m.teamA, 1);
      const b0 = getSlot(m.teamB, 0), b1 = getSlot(m.teamB, 1);

      return [
        m.id, m.mode, m.matchDate, m.scoreA, m.scoreB, winner,
        a0.name, a0.role, a1.name, a1.role,
        b0.name, b0.role, b1.name, b1.role,
        (m.comment || '').replace(/,/g, ';')
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `babyfoot_elo_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Export CSV téléchargé ! 📊', 'success');
  };

  // ── INIT ──────────────────────────────────
  const init = () => {
    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.getAttribute('data-view')));
    });

    // Mobile menu
    document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Mode buttons (add match)
    document.getElementById('mode-1v1').addEventListener('click', () => setMode('1v1'));
    document.getElementById('mode-2v2').addEventListener('click', () => setMode('2v2'));

    // Role buttons (add match)
    initRoleButtons();

    // Score & player changes → ELO preview
    ['score-a','score-b','team-a-0','team-a-1','team-b-0','team-b-1'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', updateEloPreview);
      document.getElementById(id)?.addEventListener('input', updateEloPreview);
    });

    // Submit match
    document.getElementById('submit-match-btn').addEventListener('click', submitMatch);

    // Add player
    document.getElementById('add-player-btn').addEventListener('click', addPlayer);
    document.getElementById('new-player-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') addPlayer();
    });

    // Export CSV
    document.getElementById('export-csv-btn').addEventListener('click', exportCsv);

    // Close modal
    document.getElementById('close-modal-btn').addEventListener('click', closeEditModal);
    document.getElementById('edit-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('edit-modal')) closeEditModal();
    });

    // Set default match date to now
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('match-date').value =
      `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // Initial view
    refreshRanking();
    refreshAddMatchForm();
  };

  return { init, openEditModal, startEditPlayerName, adminEditPlayerName, adminDeletePlayer, exportCsv };
})();

document.addEventListener('DOMContentLoaded', App.init);