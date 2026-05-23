// js/app.js
// ============================================================
// État global partagé, utilitaires, logique commune
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { computeEloChanges, BASE_ELO } from "./elo.js";

// ─── État global ───────────────────────────────────────────
export const state = {
  players: {},   // { [id]: { id, name, color, elo, createdAt } }
  matches: [],   // [ { id, mode, teamA, teamB, scoreA, scoreB, comment, date, eloChanges, createdAt } ]
  ready: false,
};

// ─── Listeners (page peut s'abonner) ───────────────────────
const subscribers = [];
export function onStateReady(fn) { subscribers.push(fn); }
function notifyAll() { subscribers.forEach(fn => fn()); }

// ─── Chargement depuis Firestore ───────────────────────────
export async function loadAll() {
  const [playersSnap, matchesSnap] = await Promise.all([
    getDocs(collection(db, "players")),
    getDocs(query(collection(db, "matches"), orderBy("date", "asc"))),
  ]);

  state.players = {};
  playersSnap.forEach(d => {
    state.players[d.id] = { id: d.id, ...d.data() };
  });

  state.matches = [];
  matchesSnap.forEach(d => {
    state.matches.push({ id: d.id, ...d.data() });
  });

  state.ready = true;
  notifyAll();
}

// ─── Recalcul complet ELO depuis l'historique ──────────────
// Recompute all ELO from scratch based on match order (by date)
export function recomputeAllElo() {
  // Reset
  const elos = {};
  for (const id of Object.keys(state.players)) {
    elos[id] = BASE_ELO;
  }

  // Sort matches by date ascending
  const sorted = [...state.matches].sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return da - db2;
  });

  for (const match of sorted) {
    const changes = computeEloChanges(match, elos.map ? elos : Object.fromEntries(
      Object.entries(elos).map(([id, elo]) => [id, { elo }])
    ));
    for (const [pid, ch] of Object.entries(changes)) {
      elos[pid] = ch.after;
    }
    // Store computed changes on match object for display
    match._eloChanges = changes;
  }

  // Update state.players elo
  for (const id of Object.keys(state.players)) {
    state.players[id].elo = elos[id] ?? BASE_ELO;
  }

  return sorted;
}

// Helper — convert elos map for computeEloChanges
function elosAsPlayerMap(elosFlat) {
  const m = {};
  for (const [id, elo] of Object.entries(elosFlat)) {
    m[id] = { elo };
  }
  return m;
}

export function recomputeAllEloFull() {
  const elos = {};
  for (const id of Object.keys(state.players)) {
    elos[id] = BASE_ELO;
  }

  const sorted = [...state.matches].sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return da - db2;
  });

  for (const match of sorted) {
    const changes = computeEloChanges(match, elosAsPlayerMap(elos));
    for (const [pid, ch] of Object.entries(changes)) {
      elos[pid] = ch.after;
    }
    match._eloChanges = changes;
  }

  for (const id of Object.keys(state.players)) {
    state.players[id].elo = elos[id] ?? BASE_ELO;
  }

  return { sorted, elos };
}

// ─── Stats joueur ───────────────────────────────────────────
export function computePlayerStats(playerId, sortedMatches) {
  const p = state.players[playerId];
  if (!p) return null;

  let totalMatches = 0, wins = 0, losses = 0, draws = 0, seriewins = 0, bestserie=0;
  let matches1v1 = 0, matches2v2 = 0;
  let matchesAtt = 0, matchesDef = 0;
  const vsRecord = {}; // { opponentId: { wins, losses, draws } }
  const teammateRecord = {};
  const eloHistory = [{ elo: BASE_ELO, matchIndex: 0, date: null }];

  for (const match of sortedMatches) {
    const inA = match.teamA.some(p2 => p2.playerId === playerId);
    const inB = match.teamB.some(p2 => p2.playerId === playerId);
    if (!inA && !inB) continue;

    totalMatches++;
    if (match.mode === "1v1") matches1v1++; else matches2v2++;

    // Role
    const mySlots = (inA ? match.teamA : match.teamB).filter(p2 => p2.playerId === playerId);
    const myRole = mySlots[0]?.role ?? null;
    if (myRole === "attaque") matchesAtt++;
    if (myRole === "defense") matchesDef++;

    // Victoire ?
    const won = (inA && match.scoreA > match.scoreB) || (inB && match.scoreB > match.scoreA);
    const lost = (inA && match.scoreA < match.scoreB) || (inB && match.scoreB < match.scoreA);
    if (won) wins++ , seriewins++;
    else if (lost) losses++, bestserie=Math.max(bestserie,seriewins), seriewins=0;
    else draws++;

    // ELO change
    const ch = match._eloChanges?.[playerId];
    if (ch) eloHistory.push({ elo: ch.after, matchIndex: totalMatches, date: match.date });

    // vs record
    const opponents = (inA ? match.teamB : match.teamA).map(p2 => p2.playerId);
    for (const oppId of opponents) {
      if (!vsRecord[oppId]) vsRecord[oppId] = { wins: 0, losses: 0, draws: 0 };
      if (won) vsRecord[oppId].wins++;
      else if (lost) vsRecord[oppId].losses++;
      else vsRecord[oppId].draws++;
    }

    const teammates = (inA ? match.teamA : match.teamB).map(p2 => p2.playerId).filter(id => id !== playerId); // exclure soi-même

    for (const tmId of teammates) {
      if (!teammateRecord[tmId]) teammateRecord[tmId] = { wins: 0, losses: 0, draws: 0 };
      if (won) teammateRecord[tmId].wins++;
      else if (lost) teammateRecord[tmId].losses++;
      else teammateRecord[tmId].draws++;
    }
  }
  bestserie=Math.max(bestserie,seriewins);

  const winPct = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : "0.0";

  // Best/worst opponents
  const oppList = Object.entries(vsRecord).map(([id, rec]) => ({
    id, ...rec, name: state.players[id]?.name ?? "?",
    winPct: rec.wins + rec.losses + rec.draws > 0 ? rec.wins / (rec.wins + rec.losses + rec.draws) : 0
  })).sort((a, b) => b.winPct - a.winPct);

  const teammateList = Object.entries(teammateRecord).map(([id, rec]) => ({
  id, ...rec, name: state.players[id]?.name ?? "?",
  winPct: rec.wins + rec.losses + rec.draws > 0 ? rec.wins / (rec.wins + rec.losses + rec.draws) : 0
})).sort((a, b) => b.winPct - a.winPct);

  return {
    totalMatches, wins, losses, draws, matches1v1, matches2v2,
    matchesAtt, matchesDef, winPct, eloHistory, oppList, bestserie, teammateList
  };
}

// ─── Firestore : Ajouter un match ───────────────────────────
export async function addMatch(matchData) {
  const { sorted } = recomputeAllEloFull();
  // Compute ELO changes at the time of this match
  const elos = {};
  for (const id of Object.keys(state.players)) elos[id] = BASE_ELO;
  for (const m of sorted) {
    for (const [pid, ch] of Object.entries(m._eloChanges ?? {})) {
      elos[pid] = ch.after;
    }
  }
  const changes = computeEloChanges(matchData, elosAsPlayerMap(elos));

  const docRef = await addDoc(collection(db, "matches"), {
    ...matchData,
    eloChanges: changes,
    createdAt: Timestamp.now(),
  });

  // Update each player's ELO in Firestore
  for (const [pid, ch] of Object.entries(changes)) {
    await updateDoc(doc(db, "players", pid), { elo: ch.after });
  }

  await loadAll();
  recomputeAllEloFull();
  return docRef.id;
}

// ─── Firestore : Modifier un match ──────────────────────────
export async function editMatch(matchId, matchData) {
  await updateDoc(doc(db, "matches", matchId), matchData);

  // Recompute all ELO from scratch
  await loadAll(); // reload fresh data
  const { sorted, elos } = recomputeAllEloFull();

  // Update all player ELOs in Firestore
  const batch = [];
  for (const [pid, elo] of Object.entries(elos)) {
    batch.push(updateDoc(doc(db, "players", pid), { elo }));
  }
  await Promise.all(batch);

  // Also update eloChanges stored on each match
  for (const m of sorted) {
    if (m._eloChanges) {
      await updateDoc(doc(db, "matches", m.id), { eloChanges: m._eloChanges });
    }
  }

  await loadAll();
  recomputeAllEloFull();
}

// ─── Firestore : Supprimer un match ─────────────────────────
export async function deleteMatch(matchId) {
  await deleteDoc(doc(db, "matches", matchId));
  await loadAll();
  const { elos } = recomputeAllEloFull();
  const batch = [];
  for (const [pid, elo] of Object.entries(elos)) {
    batch.push(updateDoc(doc(db, "players", pid), { elo }));
  }
  await Promise.all(batch);
  await loadAll();
  recomputeAllEloFull();
}

// ─── Firestore : Joueur ─────────────────────────────────────
export async function addPlayer(name, color) {
  const ref = await addDoc(collection(db, "players"), {
    name, color, elo: BASE_ELO,
    createdAt: Timestamp.now(),
  });
  await loadAll();
  return ref.id;
}

export async function editPlayer(playerId, updates) {
  await updateDoc(doc(db, "players", playerId), updates);
  await loadAll();
}

// ─── CSV Export ─────────────────────────────────────────────
export function exportCSV(sortedMatches) {
  const header = [
    "match_id","date","mode",
    "teamA_p1","teamA_p1_role","teamA_p2","teamA_p2_role",
    "teamB_p1","teamB_p1_role","teamB_p2","teamB_p2_role",
    "scoreA","scoreB","winner",
    "eloA_p1_before","eloA_p1_after","eloA_p2_before","eloA_p2_after",
    "eloB_p1_before","eloB_p1_after","eloB_p2_before","eloB_p2_after",
    "comment"
  ];

  const rows = sortedMatches.map(m => {
    const date = m.date?.toDate ? m.date.toDate().toISOString() : new Date(m.date).toISOString();
    const winner = m.scoreA > m.scoreB ? "A" : m.scoreB > m.scoreA ? "B" : "draw";
    const pName = id => state.players[id]?.name ?? id;
    const eloBef = (id) => m._eloChanges?.[id]?.before ?? "";
    const eloAft = (id) => m._eloChanges?.[id]?.after ?? "";
    const a1 = m.teamA[0] ?? {}; const a2 = m.teamA[1] ?? {};
    const b1 = m.teamB[0] ?? {}; const b2 = m.teamB[1] ?? {};
    return [
      m.id, date, m.mode,
      pName(a1.playerId), a1.role ?? "",
      pName(a2.playerId ?? ""), a2.role ?? "",
      pName(b1.playerId), b1.role ?? "",
      pName(b2.playerId ?? ""), b2.role ?? "",
      m.scoreA, m.scoreB, winner,
      eloBef(a1.playerId), eloAft(a1.playerId),
      eloBef(a2.playerId ?? ""), eloAft(a2.playerId ?? ""),
      eloBef(b1.playerId), eloAft(b1.playerId),
      eloBef(b2.playerId ?? ""), eloAft(b2.playerId ?? ""),
      (m.comment ?? "").replace(/"/g, '""')
    ].map(v => `"${v}"`).join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "babyfoot_matches.csv";
  a.click(); URL.revokeObjectURL(url);
}

// ─── Utilitaires UI ─────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function showToast(msg, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toast.innerHTML = `<span>${icons[type] ?? "✓"}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateY(10px)"; toast.style.transition = "all 0.3s"; setTimeout(() => toast.remove(), 300); }, 3000);
}

export function confirm(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-box">
        <h4>${title}</h4>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" id="confirmNo">Annuler</button>
          <button class="btn btn-danger" id="confirmYes">Supprimer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#confirmYes").onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector("#confirmNo").onclick = () => { overlay.remove(); resolve(false); };
  });
}

// ─── Navbar burger ──────────────────────────────────────────
document.getElementById("navBurger")?.addEventListener("click", () => {
  document.getElementById("mobileMenu")?.classList.toggle("open");
});

// ─── Init ───────────────────────────────────────────────────
loadAll();