// ============================================
// ELO ENGINE
// K=32 standard. 2v2: team ELO = avg of players.
// ============================================

const ELO = (() => {
  const K = 32;

  const expected = (ratingA, ratingB) => 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

  const newRating = (current, exp, score) => Math.round(current + K * (score - exp));

  // Returns array of { playerId, oldElo, newElo, delta }
  const computeMatchElo = (match, players) => {
    const pMap = {};
    players.forEach(p => pMap[p.id] = p.elo);

    const getElo = (id) => pMap[id] ?? 1000;

    let teamAIds, teamBIds;
    if (match.mode === '1v1') {
      teamAIds = [match.teamA[0].playerId];
      teamBIds = [match.teamB[0].playerId];
    } else {
      teamAIds = match.teamA.map(p => p.playerId);
      teamBIds = match.teamB.map(p => p.playerId);
    }

    const eloA = teamAIds.reduce((sum, id) => sum + getElo(id), 0) / teamAIds.length;
    const eloB = teamBIds.reduce((sum, id) => sum + getElo(id), 0) / teamBIds.length;

    const scoreA = match.scoreA;
    const scoreB = match.scoreB;

    let resultA; // 1 = win, 0 = loss, 0.5 = draw
    if (scoreA > scoreB) resultA = 1;
    else if (scoreA < scoreB) resultA = 0;
    else resultA = 0.5;
    const resultB = 1 - resultA;

    const expA = expected(eloA, eloB);
    const expB = expected(eloB, eloA);

    const deltaA = Math.round(K * (resultA - expA));
    const deltaB = Math.round(K * (resultB - expB));

    const changes = [];
    teamAIds.forEach(id => {
      changes.push({ playerId: id, oldElo: getElo(id), newElo: getElo(id) + deltaA, delta: deltaA });
    });
    teamBIds.forEach(id => {
      changes.push({ playerId: id, oldElo: getElo(id), newElo: getElo(id) + deltaB, delta: deltaB });
    });

    return changes;
  };

  // Full recalculation from scratch (for when a match is edited/deleted)
  const recalcAllElo = (allMatches, allPlayers) => {
    // Reset all ELOs to 1000
    const elos = {};
    allPlayers.forEach(p => elos[p.id] = 1000);

    // Sort matches by matchDate
    const sorted = [...allMatches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    sorted.forEach(match => {
      let teamAIds, teamBIds;
      if (match.mode === '1v1') {
        teamAIds = [match.teamA[0].playerId];
        teamBIds = [match.teamB[0].playerId];
      } else {
        teamAIds = match.teamA.map(p => p.playerId);
        teamBIds = match.teamB.map(p => p.playerId);
      }

      const eloA = teamAIds.reduce((sum, id) => sum + (elos[id] ?? 1000), 0) / teamAIds.length;
      const eloB = teamBIds.reduce((sum, id) => sum + (elos[id] ?? 1000), 0) / teamBIds.length;

      let resultA = match.scoreA > match.scoreB ? 1 : match.scoreA < match.scoreB ? 0 : 0.5;
      let resultB = 1 - resultA;

      const expA = expected(eloA, eloB);
      const expB = expected(eloB, eloA);

      const deltaA = Math.round(K * (resultA - expA));
      const deltaB = Math.round(K * (resultB - expB));

      teamAIds.forEach(id => { elos[id] = (elos[id] ?? 1000) + deltaA; });
      teamBIds.forEach(id => { elos[id] = (elos[id] ?? 1000) + deltaB; });
    });

    return elos; // { playerId: eloValue }
  };

  // Stats per player from match history
  const computePlayerStats = (playerId, allMatches) => {
    let total = 0, wins = 0, losses = 0, draws = 0;
    let matches1v1 = 0, matches2v2 = 0;
    let asAttaque = 0, asDefense = 0;

    allMatches.forEach(m => {
      let inA = false, inB = false;
      let playerSlot = null;

      m.teamA.forEach(p => { if (p.playerId === playerId) { inA = true; playerSlot = p; } });
      m.teamB.forEach(p => { if (p.playerId === playerId) { inB = true; playerSlot = p; } });

      if (!inA && !inB) return;
      total++;

      if (m.mode === '1v1') matches1v1++;
      else {
        matches2v2++;
        if (playerSlot && playerSlot.role === 'attaque') asAttaque++;
        else if (playerSlot && playerSlot.role === 'defense') asDefense++;
      }

      const wonA = m.scoreA > m.scoreB;
      const wonB = m.scoreB > m.scoreA;
      const draw = m.scoreA === m.scoreB;

      if (draw) draws++;
      else if ((inA && wonA) || (inB && wonB)) wins++;
      else losses++;
    });

    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return { total, wins, losses, draws, matches1v1, matches2v2, asAttaque, asDefense, winrate };
  };

  return { computeMatchElo, recalcAllElo, computePlayerStats };
})();