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

/**
 * Calcule l'écart-type pour mesurer l'homogénéité d'une équipe
 * @param {number[]} values Les ELO des joueurs
 * @param {number} mean La moyenne des ELO
 * @returns {number} L'écart-type
 */
function calculateStdDev(values, mean) {
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Prédit intelligemment le résultat d'un match entre deux équipes
 * Utilise un algorithme avancé: ELO + facteur d'homogénéité + analyse historique
 * @param {Array} teamA Équipe A: [{id, name, elo}]
 * @param {Array} teamB Équipe B: [{id, name, elo}]
 * @param {Array} allMatches Historique des matchs (optionnel, pour l'analyse de forme)
 * @returns {{ teamA_percent: number, teamB_percent: number, eloA: number, eloB: number, explanation: string, confidence: number }}
 */
export function predictTeamVictory(teamA, teamB, allMatches = []) {
  // ─── PHASE 1: Calcul des ELO moyens ───
  const eloA = teamA.reduce((sum, p) => sum + (p.elo || BASE_ELO), 0) / teamA.length;
  const eloB = teamB.reduce((sum, p) => sum + (p.elo || BASE_ELO), 0) / teamB.length;
  
  // ─── PHASE 2: Calcul de l'homogénéité ───
  // Les équipes homogènes sont plus prévisibles et stables
  const stdDevA = calculateStdDev(teamA.map(p => p.elo || BASE_ELO), eloA);
  const stdDevB = calculateStdDev(teamB.map(p => p.elo || BASE_ELO), eloB);
  
  // Bonus de stabilité: équipe homogène = équipe plus cohésive
  const maxStdDev = 150; // Au-delà, c'est déséquilibré
  const stabilityBonusA = Math.max(0, 10 * (1 - Math.min(stdDevA, maxStdDev) / maxStdDev));
  const stabilityBonusB = Math.max(0, 10 * (1 - Math.min(stdDevB, maxStdDev) / maxStdDev));
  
  // ─── PHASE 3: Analyse de forme (hot streak) ───
  // Regarder les 5 derniers matchs de chaque joueur
  const formA = calculateTeamFormBonus(teamA, allMatches);
  const formB = calculateTeamFormBonus(teamB, allMatches);
  
  // ─── PHASE 4: Calcul de la probabilité ajustée ───
  const adjustedEloA = eloA + stabilityBonusA + formA;
  const adjustedEloB = eloB + stabilityBonusB + formB;
  
  let probA = expectedScore(adjustedEloA, adjustedEloB);
  let probB = 1 - probA;
  
  // ─── PHASE 5: Conversion en pourcentages ───
  const percentA = Math.round(probA * 10000) / 100;
  const percentB = Math.round(probB * 10000) / 100;
  
  // ─── PHASE 6: Calcul de la confiance ───
  // Plus il y a de matchs, plus on est confiant
  const matchCount = allMatches.length;
  const confidence = Math.min(100, 50 + Math.sqrt(matchCount) * 5);
  
  // ─── PHASE 7: Génération de l'explication ───
  const eloDiff = Math.abs(eloA - eloB);
  let explanation = "";
  
  if (eloDiff > 200) {
    explanation = "Équipes très déséquilibrées";
  } else if (eloDiff > 100) {
    explanation = "Équipes déséquilibrées";
  } else if (eloDiff > 30) {
    explanation = "Équipes équilibrées avec légère différence";
  } else {
    explanation = "Équipes parfaitement équilibrées";
  }
  
  // Ajouter note sur l'homogénéité
  if (stdDevA < 50 && stdDevB < 50) {
    explanation += " • Très cohésives";
  } else if (stdDevA > 120 || stdDevB > 120) {
    explanation += " • Plutôt déchirées";
  }
  
  return {
    teamA_percent: percentA,
    teamB_percent: percentB,
    eloA: Math.round(eloA),
    eloB: Math.round(eloB),
    explanation,
    confidence: Math.round(confidence)
  };
}

/**
 * Calcule un bonus de forme basé sur les récents matchs des joueurs
 * @param {Array} team Équipe: [{id, name, elo}]
 * @param {Array} allMatches Tous les matchs
 * @returns {number} Bonus ELO appliqué (-5 à +5)
 */
function calculateTeamFormBonus(team, allMatches) {
  if (!allMatches.length) return 0;
  
  let totalWins = 0;
  let totalMatches = 0;
  
  // Analyser les 5 derniers matchs
  const recentMatches = allMatches.slice(-5);
  
  for (const match of recentMatches) {
    for (const player of team) {
      // Chercher le joueur dans teamA et teamB
      const isInTeamA = match.teamA?.some(p => p.playerId === player.id);
      const isInTeamB = match.teamB?.some(p => p.playerId === player.id);
      
      if (isInTeamA) {
        totalMatches++;
        if (match.scoreA > match.scoreB) totalWins++;
      } else if (isInTeamB) {
        totalMatches++;
        if (match.scoreB > match.scoreA) totalWins++;
      }
    }
  }
  
  if (totalMatches === 0) return 0;
  
  // Taux de victoire sur les 5 derniers
  const winRate = totalWins / totalMatches;
  // Convertir en bonus (-5 à +5)
  return (winRate - 0.5) * 10;
}

export { BASE_ELO };