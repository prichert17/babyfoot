// js/elo.js
// ============================================================
// Calcul ELO pour 1v1 et 2v2
// ============================================================

const K_FACTOR = 32;      // Amplitude max du changement ELO par match
const BASE_ELO = 1000;    // ELO de départ d'un nouveau joueur

/**
 * Calcule la probabilité attendue de victoire de A contre B
 * @param {number} eloA
 * @param {number} eloB
 * @returns {number} entre 0 et 1
 */
export function expectedScore(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calcule le nouvel ELO après un résultat
 * @param {number} elo      ELO actuel du joueur
 * @param {number} expected Probabilité attendue
 * @param {number} actual   Score réel (1 = victoire, 0 = défaite, 0.5 = nul)
 * @returns {number} Nouvel ELO (arrondi)
 */
export function newElo(elo, expected, actual) {
  return Math.round(elo + K_FACTOR * (actual - expected));
}

/**
 * Calcul ELO pour un match 1v1
 * @param {number} eloA ELO actuel de A
 * @param {number} eloB ELO actuel de B
 * @param {number} scoreA Score de A
 * @param {number} scoreB Score de B
 * @returns {{ newEloA: number, newEloB: number, deltaA: number, deltaB: number }}
 */
export function calculate1v1(eloA, eloB, scoreA, scoreB) {
  const expA = expectedScore(eloA, eloB);
  const expB = expectedScore(eloB, eloA);
  let actualA, actualB;
  if (scoreA > scoreB)      { actualA = 1; actualB = 0; }
  else if (scoreB > scoreA) { actualA = 0; actualB = 1; }
  else                       { actualA = 0.5; actualB = 0.5; }

  const nA = newElo(eloA, expA, actualA);
  const nB = newElo(eloB, expB, actualB);
  return {
    newEloA: nA, deltaA: nA - eloA,
    newEloB: nB, deltaB: nB - eloB,
  };
}

/**
 * Calcul ELO pour un match 2v2
 * Moyenne ELO de chaque équipe, puis distribution proportionnelle aux joueurs
 * @param {{ id, elo }[]} teamA Tableau de 2 joueurs avec leur ELO
 * @param {{ id, elo }[]} teamB Tableau de 2 joueurs avec leur ELO
 * @param {number} scoreA
 * @param {number} scoreB
 * @returns {{ [playerId]: { before, after, delta } }}
 */
export function calculate2v2(teamA, teamB, scoreA, scoreB) {
  const avgA = (teamA[0].elo + teamA[1].elo) / 2;
  const avgB = (teamB[0].elo + teamB[1].elo) / 2;

  const expA = expectedScore(avgA, avgB);
  const expB = expectedScore(avgB, avgA);

  let actualA, actualB;
  if (scoreA > scoreB)      { actualA = 1; actualB = 0; }
  else if (scoreB > scoreA) { actualA = 0; actualB = 1; }
  else                       { actualA = 0.5; actualB = 0.5; }

  const changes = {};
  for (const p of teamA) {
    const n = newElo(p.elo, expA, actualA);
    changes[p.id] = { before: p.elo, after: n, delta: n - p.elo };
  }
  for (const p of teamB) {
    const n = newElo(p.elo, expB, actualB);
    changes[p.id] = { before: p.elo, after: n, delta: n - p.elo };
  }
  return changes;
}

/**
 * Point d'entrée unifié — calcule les changements ELO pour un match complet
 * @param {object} match    Objet match (mode, teamA, teamB, scoreA, scoreB)
 * @param {object} players  Map playerId → { elo }
 * @returns {{ [playerId]: { before, after, delta } }}
 */
export function computeEloChanges(match, players) {
  if (match.mode === "1v1") {
    const pA = match.teamA[0];
    const pB = match.teamB[0];
    const eloA = players[pA.playerId]?.elo ?? BASE_ELO;
    const eloB = players[pB.playerId]?.elo ?? BASE_ELO;
    const result = calculate1v1(eloA, eloB, match.scoreA, match.scoreB);
    return {
      [pA.playerId]: { before: eloA, after: result.newEloA, delta: result.deltaA },
      [pB.playerId]: { before: eloB, after: result.newEloB, delta: result.deltaB },
    };
  } else {
    const tA = match.teamA.map(p => ({ id: p.playerId, elo: players[p.playerId]?.elo ?? BASE_ELO }));
    const tB = match.teamB.map(p => ({ id: p.playerId, elo: players[p.playerId]?.elo ?? BASE_ELO }));
    return calculate2v2(tA, tB, match.scoreA, match.scoreB);
  }
}

export { BASE_ELO };