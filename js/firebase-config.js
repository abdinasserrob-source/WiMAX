/**
 * WiMAX — Firebase (CDN, sans npm).
 * Inclure après firebase-app-compat.js et firebase-database-compat.js
 *
 * Règles Realtime Database (mode test) — Console → Realtime Database → Règles :
 * {
 *   "rules": {
 *     ".read": true,
 *     ".write": true
 *   }
 * }
 *
 * Structure classement : classement/{monID}/ → { id, identite, score, total, date }
 * Souvenirs galerie : souvenirs/{pushId}/ → { identite, monID, image, date, heure }
 * (monID = identifiant appareil, jamais affiché à l’utilisateur.)
 * (Lecture/écriture ouvertes — à durcir en production.)
 */

var WIMAX_KEY_MON_ID = "monID";

/**
 * ID unique par appareil (localStorage), invisible pour l’utilisateur.
 */
function wimaxGetOrCreateMonID() {
  var monID = localStorage.getItem(WIMAX_KEY_MON_ID);
  if (!monID) {
    monID = Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem(WIMAX_KEY_MON_ID, monID);
  }
  return monID;
}

window.__WIMAX_getMonID = wimaxGetOrCreateMonID;

var firebaseConfig = {
  apiKey: "AIzaSyAvtVa12XxGU7DCPzJ8wvLRCHQn5SvxogM",
  authDomain: "wimaw-quiz.firebaseapp.com",
  databaseURL: "https://wimaw-quiz-default-rtdb.firebaseio.com",
  projectId: "wimaw-quiz",
  storageBucket: "wimaw-quiz.firebasestorage.app",
  messagingSenderId: "117427650711",
  appId: "1:117427650711:web:4155fddf3241761ad729d2",
};

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.__WIMAX_FB_DB = firebase.database();
}
