/**
 * Quiz WiMAX — 100 QCM, 10 tirés / session.
 * Classement partagé : Firebase Realtime Database (clé classement/).
 */
(function () {
  var STORAGE_ARCHIVE = "wimax_quiz_archives";
  var SESSION_SIZE = 10;

  var QUESTIONS = window.WIMAX_QUIZ_QUESTIONS || [];
  if (!QUESTIONS.length) {
    console.error("WIMAX_QUIZ_QUESTIONS manquant : chargez js/quiz-questions.js avant quiz.js");
  }

  function randBelow(n) {
    if (n <= 0) return 0;
    if (window.crypto && crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffleInPlace(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = randBelow(i + 1);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickQuestionIndices(excludeIds) {
    var excludeMap = {};
    (excludeIds || []).forEach(function (id) {
      excludeMap[id] = true;
    });
    var pool = [];
    for (var i = 0; i < QUESTIONS.length; i++) {
      if (!excludeMap[i]) pool.push(i);
    }
    if (pool.length < SESSION_SIZE) {
      pool = [];
      for (var j = 0; j < QUESTIONS.length; j++) pool.push(j);
    }
    shuffleInPlace(pool);
    return pool.slice(0, SESSION_SIZE);
  }

  function nowDateStr() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0") +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }

  function formatDateFR(d) {
    var day = String(d.getDate()).padStart(2, "0");
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    return day + "/" + mo + "/" + d.getFullYear();
  }

  function getMonID() {
    if (typeof window.__WIMAX_getMonID === "function") {
      return window.__WIMAX_getMonID();
    }
    var monID = localStorage.getItem("monID");
    if (!monID) {
      monID = Date.now().toString(36) + Math.random().toString(36).substr(2);
      localStorage.setItem("monID", monID);
    }
    return monID;
  }

  /** Une ligne par entrée Firebase (clé = monID appareil). Pas de fusion par identité. */
  function rowsFromFirebaseVal(val) {
    var rows = [];
    if (!val || typeof val !== "object") return rows;
    Object.keys(val).forEach(function (k) {
      var o = val[k] || {};
      if (o.identite == null || String(o.identite).trim() === "") return;
      if (o.score == null || o.score === "") return;
      rows.push({
        deviceId: k,
        identite: String(o.identite),
        score: Number(o.score),
        total: Number(o.total) || SESSION_SIZE,
        date: String(o.date || ""),
      });
    });
    return rows;
  }

  /**
   * Clé Firebase = monID (cet appareil uniquement).
   * @param {function} cb — (result: { ok, message?, updated? })
   */
  function publishScoreToFirebase(identite, score, total, cb) {
    var db = window.__WIMAX_FB_DB;
    if (!db) {
      cb({ ok: false, message: "Firebase indisponible. Vérifie la connexion et les scripts." });
      return;
    }
    var monID = getMonID();
    if (!monID) {
      cb({ ok: false, message: "Identifiant appareil indisponible." });
      return;
    }
    var ref = db.ref("classement").child(monID);
    var dateStr = formatDateFR(new Date());
    ref
      .once("value")
      .then(function (snap) {
        if (!snap.exists()) {
          return ref
            .set({
              id: monID,
              identite: identite,
              score: score,
              total: total,
              date: dateStr,
            })
            .then(
              function () {
                cb({ ok: true, message: "✅ Score publié !", updated: true });
              },
              function (err) {
                cb({ ok: false, message: (err && err.message) || "Erreur Firebase." });
              }
            );
        }
        var v = snap.val() || {};
        var prevScore = Number(v.score);
        var prevTotal = Number(v.total) || total;
        if (score > prevScore) {
          return ref
            .update({
              id: monID,
              identite: identite,
              score: score,
              total: total,
              date: dateStr,
            })
            .then(
              function () {
                cb({
                  ok: true,
                  message: "🎉 Nouveau record ! " + score + "/" + total,
                  updated: true,
                });
              },
              function (err) {
                cb({ ok: false, message: (err && err.message) || "Erreur mise à jour." });
              }
            );
        }
        if (score < prevScore) {
          cb({
            ok: true,
            message: "Ton meilleur score reste " + prevScore + "/" + prevTotal,
            updated: false,
          });
          return;
        }
        cb({
          ok: true,
          message: "Score identique (" + score + "/" + total + ").",
          updated: false,
        });
      })
      .catch(function (err) {
        cb({ ok: false, message: (err && err.message) || "Erreur réseau Firebase." });
      });
  }

  var state = {
    sessionIds: [],
    session: [],
    index: 0,
    score: 0,
    answered: false,
    selectedWrong: -1,
  };

  var elPlay = document.getElementById("quiz-play");
  var elResult = document.getElementById("quiz-result");
  var elProgressLabel = document.getElementById("quiz-progress-label");
  var elProgressPct = document.getElementById("quiz-progress-pct");
  var elBar = document.getElementById("quiz-bar-fill");
  var elQuestion = document.getElementById("quiz-question");
  var elOptions = document.getElementById("quiz-options");
  var elHint = document.getElementById("quiz-hint");
  var elHintText = document.getElementById("quiz-hint-text");
  var elNextWrap = document.getElementById("quiz-next-wrap");
  var elNextBtn = document.getElementById("quiz-next-btn");

  var elScoreNum = document.getElementById("quiz-score-num");
  var elBadge = document.getElementById("quiz-badge");
  var elFeedbackTitle = document.getElementById("quiz-feedback-title");
  var elFeedbackDesc = document.getElementById("quiz-feedback-desc");
  var elArchivesList = document.getElementById("quiz-archives-list");
  var elArchivesEmpty = document.getElementById("quiz-archives-empty");
  var elArchiveToast = document.getElementById("quiz-archive-toast");
  var archiveToastTimer = null;

  var elClassementMsg = document.getElementById("quiz-classement-msg");
  var elClassementModal = document.getElementById("quiz-classement-view-modal");
  var elClassementBackdrop = document.getElementById("quiz-classement-view-backdrop");
  var elClassementList = document.getElementById("quiz-classement-view-list");
  var classementFbHandler = null;

  function loadArchivesFromStorage() {
    var raw = localStorage.getItem(STORAGE_ARCHIVE);
    var list = [];
    try {
      list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    return list;
  }

  function renderArchivesUI() {
    if (!elArchivesList || !elArchivesEmpty) return;
    var list = loadArchivesFromStorage();
    elArchivesList.innerHTML = "";
    if (!list.length) {
      elArchivesEmpty.classList.remove("hidden");
      return;
    }
    elArchivesEmpty.classList.add("hidden");
    list
      .slice()
      .reverse()
      .forEach(function (entry) {
        var li = document.createElement("li");
        li.className = "quiz-archives__item";
        li.textContent = entry.date + " — " + entry.score + "/" + entry.total;
        elArchivesList.appendChild(li);
      });
  }

  function clearClassementMsg() {
    if (!elClassementMsg) return;
    elClassementMsg.textContent = "";
    elClassementMsg.classList.add("hidden");
  }

  function showClassementMsg(text) {
    if (!elClassementMsg || !text) return;
    elClassementMsg.textContent = text;
    elClassementMsg.classList.remove("hidden");
  }

  function fillClassementViewListSnapshot(snap) {
    if (!elClassementList) return;
    var val = snap.val();
    var rows = rowsFromFirebaseVal(val);
    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    elClassementList.innerHTML = "";
    var myDeviceId = getMonID();
    if (!rows.length) {
      var empty = document.createElement("li");
      empty.className = "quiz-classement-view__empty";
      empty.textContent = "Aucun score publié pour l’instant.";
      elClassementList.appendChild(empty);
      return;
    }
    var medals = ["🥇", "🥈", "🥉"];
    rows.forEach(function (e, i) {
      var li = document.createElement("li");
      li.className = "quiz-classement-view__row";
      if (myDeviceId && e.deviceId === myDeviceId) li.classList.add("quiz-classement-view__row--me");
      var prefix = i < 3 ? medals[i] + " " : "    ";
      li.textContent = prefix + e.identite + "     " + e.score + "/" + e.total;
      elClassementList.appendChild(li);
    });
  }

  function openClassementViewModal() {
    if (!elClassementModal) return;
    elClassementModal.classList.add("is-open");
    elClassementModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var db = window.__WIMAX_FB_DB;
    if (!db) {
      if (elClassementList) {
        elClassementList.innerHTML = "";
        var liErr = document.createElement("li");
        liErr.className = "quiz-classement-view__empty";
        liErr.textContent = "Firebase indisponible.";
        elClassementList.appendChild(liErr);
      }
      return;
    }
    classementFbHandler = function (snap) {
      fillClassementViewListSnapshot(snap);
    };
    db.ref("classement").on("value", classementFbHandler);
  }

  function closeClassementViewModal() {
    var db = window.__WIMAX_FB_DB;
    if (db && classementFbHandler) {
      db.ref("classement").off("value", classementFbHandler);
      classementFbHandler = null;
    }
    if (!elClassementModal) return;
    elClassementModal.classList.remove("is-open");
    elClassementModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function showPlay() {
    elPlay.classList.remove("hidden");
    elResult.classList.add("hidden");
  }

  function showResult() {
    elPlay.classList.add("hidden");
    elResult.classList.remove("hidden");
    clearClassementMsg();
    var total = state.session.length;
    elScoreNum.textContent = state.score + "/" + total;

    if (state.score >= total * 0.8) {
      elBadge.textContent = "Bravo !";
      elFeedbackTitle.textContent = "Excellent résultat !";
      elFeedbackDesc.textContent =
        "Vous maîtrisez très bien les notions clés du WiMAX et de l'accès sans fil métropolitain.";
    } else if (state.score >= total * 0.5) {
      elBadge.textContent = "Bravo !";
      elFeedbackTitle.textContent = "Bon résultat !";
      elFeedbackDesc.textContent =
        "Vous avez une bonne compréhension des principes fondamentaux de la technologie WiMAX.";
    } else {
      elBadge.textContent = "Continuez !";
      elFeedbackTitle.textContent = "Encore un effort";
      elFeedbackDesc.textContent =
        "Revoyez les scénarios pédagogiques et rejouez le quiz pour renforcer vos acquis.";
    }
    renderArchivesUI();
  }

  function updateProgress() {
    var total = state.session.length;
    var n = state.index + 1;
    var pct = Math.round((n / total) * 100);
    elProgressLabel.textContent = "Question " + n + "/" + total;
    elProgressPct.textContent = pct + "% complété";
    elBar.style.width = pct + "%";
  }

  function onPick(choiceOriginalIndex, btn) {
    if (state.answered) return;
    var q = state._raw;
    state.answered = true;
    var buttons = elOptions.querySelectorAll(".quiz-option");

    var correctOriginal = q.correct;
    if (choiceOriginalIndex === correctOriginal) {
      state.score++;
      btn.classList.add("quiz-option--correct");
    } else {
      state.selectedWrong = choiceOriginalIndex;
      btn.classList.add("quiz-option--wrong");
      buttons.forEach(function (b) {
        if (b === btn) return;
        var orig = parseInt(b.getAttribute("data-orig"), 10);
        if (orig === correctOriginal) b.classList.add("quiz-option--correct");
      });
    }

    buttons.forEach(function (b) {
      b.disabled = true;
    });

    elHintText.textContent = q.hint;
    elHint.classList.remove("hidden");
    elNextWrap.classList.remove("hidden");
    elNextBtn.textContent = state.index + 1 >= state.session.length ? "Voir les résultats" : "Question suivante";
    updateProgress();
  }

  function renderQuestionWithDataOrig() {
    var raw = state.session[state.index];
    state.answered = false;
    state.selectedWrong = -1;
    elQuestion.textContent = raw.q;
    elHint.classList.add("hidden");
    elNextWrap.classList.add("hidden");
    elOptions.innerHTML = "";

    var order = [0, 1, 2, 3];
    shuffleInPlace(order);

    order.forEach(function (origIdx, pos) {
      var opt = raw.options[origIdx];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.setAttribute("data-orig", String(origIdx));
      btn.innerHTML =
        '<span class="quiz-option__letter">' +
        String.fromCharCode(65 + pos) +
        "</span><span>" +
        opt +
        "</span>";
      btn.addEventListener("click", function () {
        onPick(origIdx, btn);
      });
      elOptions.appendChild(btn);
    });

    state._raw = raw;
    updateProgress();
  }

  function next() {
    if (!state.answered) return;
    if (state.index + 1 >= state.session.length) {
      showResult();
      return;
    }
    state.index++;
    renderQuestionWithDataOrig();
  }

  function startSession(excludeIds) {
    if (!QUESTIONS.length) return;
    state.sessionIds = pickQuestionIndices(excludeIds);
    state.session = state.sessionIds.map(function (i) {
      return QUESTIONS[i];
    });
    state.index = 0;
    state.score = 0;
    showPlay();
    renderQuestionWithDataOrig();
  }

  function archiveScore() {
    var list = loadArchivesFromStorage();
    var dateStr = nowDateStr();
    list.push({
      score: state.score,
      total: state.session.length,
      date: dateStr,
    });
    localStorage.setItem(STORAGE_ARCHIVE, JSON.stringify(list));
    renderArchivesUI();
    if (elArchiveToast) {
      elArchiveToast.textContent = "Partie enregistrée : " + dateStr + " — " + state.score + "/" + state.session.length + ".";
      elArchiveToast.classList.remove("hidden");
      if (archiveToastTimer) clearTimeout(archiveToastTimer);
      archiveToastTimer = setTimeout(function () {
        elArchiveToast.classList.add("hidden");
        archiveToastTimer = null;
      }, 5000);
    }
  }

  function shareScore() {
    var id = window.WiMAXIdentite && window.WiMAXIdentite.get ? window.WiMAXIdentite.get() : "";
    var text =
      (id ? id + " — " : "") +
      "J'ai obtenu " +
      state.score +
      "/" +
      state.session.length +
      " au Quiz WiMAX (10 questions tirées parmi 100) !";
    if (navigator.share) {
      navigator
        .share({
          title: "Quiz WiMAX",
          text: text,
          url: window.location.href,
        })
        .catch(function () {});
    } else {
      alert(text);
    }
  }

  elNextBtn.addEventListener("click", next);

  document.getElementById("quiz-share-btn").addEventListener("click", shareScore);
  document.getElementById("quiz-archive-btn").addEventListener("click", archiveScore);
  document.getElementById("quiz-replay-btn").addEventListener("click", function () {
    var previousIds = state.sessionIds && state.sessionIds.length ? state.sessionIds.slice() : [];
    startSession(previousIds);
  });

  var btnPublish = document.getElementById("quiz-publish-score-btn");
  var btnVoirClassement = document.getElementById("quiz-voir-classement-btn");
  var btnClassementClose = document.getElementById("quiz-classement-close");

  if (btnPublish) {
    btnPublish.addEventListener("click", function () {
      var identite = window.WiMAXIdentite && window.WiMAXIdentite.get ? window.WiMAXIdentite.get() : "";
      if (!identite) {
        alert("Crée d’abord ton identité depuis l’accueil du portail WiMAX (home).");
        return;
      }
      publishScoreToFirebase(identite, state.score, state.session.length, function (res) {
        if (!res.ok) {
          if (res.message) alert(res.message);
          return;
        }
        if (res.message) showClassementMsg(res.message);
      });
    });
  }
  if (btnVoirClassement) {
    btnVoirClassement.addEventListener("click", openClassementViewModal);
  }
  if (elClassementBackdrop) {
    elClassementBackdrop.addEventListener("click", closeClassementViewModal);
  }
  if (btnClassementClose) {
    btnClassementClose.addEventListener("click", closeClassementViewModal);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (elClassementModal && elClassementModal.classList.contains("is-open")) {
      closeClassementViewModal();
    }
  });

  startSession([]);

  document.body.classList.add("page-enter");
  requestAnimationFrame(function () {
    document.body.classList.add("page-enter-active");
  });
})();
