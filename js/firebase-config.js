// js/firebase-config.js
// ============================================================
// CONFIGURATION FIREBASE — À MODIFIER AVEC VOS PROPRES CLÉS
// Suivez le guide README_FIREBASE.md pour obtenir ces valeurs
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBdqB2-WeOdgeNXuNli8fpaUoj9q_7Z2MM",
  authDomain: "babyfoot-elo-81618.firebaseapp.com",
  projectId: "babyfoot-elo-81618",
  storageBucket: "babyfoot-elo-81618.firebasestorage.app",
  messagingSenderId: "557162921964",
  appId: "1:557162921964:web:3c126c10bf9e0d8b58cac9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ============================================================
// STRUCTURE FIRESTORE :
//
// Collection "players" — un document par joueur :
// {
//   id: string (auto),
//   name: string,
//   color: string (hex),
//   elo: number (défaut 1000),
//   createdAt: timestamp
// }
//
// Collection "matches" — un document par match :
// {
//   id: string (auto),
//   mode: "1v1" | "2v2",
//   teamA: [{ playerId, role: "attaque"|"defense"|null }],
//   teamB: [{ playerId, role: "attaque"|"defense"|null }],
//   scoreA: number,
//   scoreB: number,
//   comment: string,
//   date: timestamp,
//   createdAt: timestamp,
//   eloChanges: {          // snapshot ELO AVANT le match
//     [playerId]: { before: number, after: number, delta: number }
//   }
// }
// ============================================================