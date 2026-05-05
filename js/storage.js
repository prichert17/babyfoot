// ============================================
// STORAGE — localStorage persistence
// ============================================

const Storage = (() => {
  const KEYS = { PLAYERS: 'bfe_players', MATCHES: 'bfe_matches' };

  const PALETTE = [
    '#f0e030', '#4daaff', '#ff4d4d', '#4dff88', '#ff9f1c',
    '#c77dff', '#00d4aa', '#ff6b9d', '#7ec8e3', '#f4a261',
    '#e76f51', '#2ec4b6', '#a8dadc', '#ffbf69', '#cbf3f0',
    '#e63946', '#457b9d', '#84a98c', '#f1faee', '#a8c5da'
  ];

  const assignColor = (players) => {
    const usedColors = players.map(p => p.color).filter(Boolean);
    const available = PALETTE.filter(c => !usedColors.includes(c));
    return available.length > 0 ? available[0] : PALETTE[players.length % PALETTE.length];
  };

  const getPlayers = () => JSON.parse(localStorage.getItem(KEYS.PLAYERS) || '[]');
  const getMatches = () => JSON.parse(localStorage.getItem(KEYS.MATCHES) || '[]');
  const savePlayers = (p) => localStorage.setItem(KEYS.PLAYERS, JSON.stringify(p));
  const saveMatches = (m) => localStorage.setItem(KEYS.MATCHES, JSON.stringify(m));

  const migratePlayers = () => {
    const players = getPlayers();
    let changed = false;
    players.forEach((p, i) => {
      if (!p.color) {
        const usedSoFar = players.slice(0, i).map(x => x.color).filter(Boolean);
        const available = PALETTE.filter(c => !usedSoFar.includes(c));
        p.color = available.length > 0 ? available[0] : PALETTE[i % PALETTE.length];
        changed = true;
      }
    });
    if (changed) savePlayers(players);
  };

  const addPlayer = (pseudo) => {
    const players = getPlayers();
    const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const color = assignColor(players);
    const player = { id, pseudo, elo: 1000, color, createdAt: new Date().toISOString() };
    players.push(player);
    savePlayers(players);
    return player;
  };

  const updatePlayerPseudo = (id, newPseudo) => {
    const players = getPlayers();
    const p = players.find(x => x.id === id);
    if (p) { p.pseudo = newPseudo; savePlayers(players); }
  };

  const updatePlayerColor = (id, color) => {
    const players = getPlayers();
    const p = players.find(x => x.id === id);
    if (p) { p.color = color; savePlayers(players); }
  };

  const updatePlayerElo = (id, newElo) => {
    const players = getPlayers();
    const p = players.find(x => x.id === id);
    if (p) { p.elo = newElo; savePlayers(players); }
  };

  const addMatch = (match) => {
    const matches = getMatches();
    const id = 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const full = { id, ...match, addedAt: new Date().toISOString() };
    matches.push(full);
    saveMatches(matches);
    return full;
  };

  const updateMatch = (id, data) => {
    const matches = getMatches();
    const idx = matches.findIndex(m => m.id === id);
    if (idx !== -1) {
      matches[idx] = { ...matches[idx], ...data };
      saveMatches(matches);
      return matches[idx];
    }
    return null;
  };

  const deleteMatch = (id) => {
    let matches = getMatches();
    matches = matches.filter(m => m.id !== id);
    saveMatches(matches);
  };

  return {
    getPlayers, getMatches, savePlayers, saveMatches, migratePlayers,
    addPlayer, updatePlayerPseudo, updatePlayerElo, updatePlayerColor,
    addMatch, updateMatch, deleteMatch, PALETTE
  };
})();