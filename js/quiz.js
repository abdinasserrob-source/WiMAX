/**
 * Quiz WiMAX — 15 questions, 10 tirées au sort par session.
 */
(function () {
  var STORAGE_ARCHIVE = "wimax_quiz_archives";

  var QUESTIONS = [
    {
      q: "Quelle norme IEEE est associée au WiMAX ?",
      options: ["802.11", "802.16", "802.3", "802.15"],
      correct: 1,
      hint: "Le WiMAX repose sur la famille IEEE 802.16 pour les réseaux métropolitains sans fil.",
    },
    {
      q: "Quelle bande est souvent utilisée pour le WiMAX licencié en extérieur ?",
      options: ["2,4 GHz (ISM)", "3,5 GHz", "900 MHz FM", "60 GHz mmWave"],
      correct: 1,
      hint: "La bande 3,5 GHz offre un bon compromis entre portée et capacité pour les déploiements outdoor.",
    },
    {
      q: "Que signifie principalement l'OFDM dans ce contexte ?",
      options: [
        "Un protocole de routage IP",
        "Une modulation multi-porteuses résistante aux évanouissements",
        "Un algorithme de chiffrement symétrique",
        "Un format de compression vidéo",
      ],
      correct: 1,
      hint: "L'OFDM répartit les données sur de nombreuses sous-porteuses orthogonales.",
    },
    {
      q: "Le WiMAX fixe (802.16d) vise surtout :",
      options: [
        "Les liaisons satellite géostationnaires",
        "L'accès résidentiel / entreprise avec antenne extérieure",
        "Le Bluetooth basse consommation",
        "Le câblage cuivre DSL",
      ],
      correct: 1,
      hint: "Le profil fixe sert typiquement au dernier kilomètre sans fil.",
    },
    {
      q: "Le handover concerne principalement :",
      options: [
        "Le changement de fréquence Wi-Fi domestique",
        "Le passage d'une cellule à une autre sans couper la session",
        "La conversion analogique-numérique",
        "La mise à jour du firmware du modem",
      ],
      correct: 1,
      hint: "Le handover permet la continuité de service en mobilité (profil mobile).",
    },
    {
      q: "La QoS dans WiMAX sert à :",
      options: [
        "Augmenter automatiquement la puissance du Wi-Fi domestique",
        "Classer et prioriser les flux (voix, vidéo, données)",
        "Remplacer le DNS",
        "Mesurer uniquement la température du matériel",
      ],
      correct: 1,
      hint: "Des classes comme UGS, rtPS ou nrtPS permettent d'allouer la bande selon les besoins.",
    },
    {
      q: "Non line of sight (NLOS) signifie :",
      options: [
        "Liaison uniquement avec visibilité optique parfaite",
        "Propagation possible malgré des obstacles partiels",
        "Absence totale de signal",
        "Connexion par fibre optique",
      ],
      correct: 1,
      hint: "Les schémas MIMO et certaines bandes aident à traverser un urbanisme complexe.",
    },
    {
      q: "Par rapport au LTE grand public, le WiMAX :",
      options: [
        "Est toujours le standard dominant des smartphones en 2026",
        "A souvent été un concurrent historique pour l'accès sans fil à large couverture",
        "N'utilise jamais de spectre licencié",
        "Est identique au Zigbee",
      ],
      correct: 1,
      hint: "Sur le marché, le LTE/5G a largement pris le relais, mais le WiMAX reste un cas d'étude pédagogique.",
    },
    {
      q: "Un SS (Subscriber Station) est :",
      options: [
        "Le routeur cœur du FAI au niveau national",
        "L'équipement côté abonné qui dialogue avec la BS",
        "Un serveur de messagerie",
        "Un câble coaxial",
      ],
      correct: 1,
      hint: "La station de base (BS) et les SS forment l'architecture point à multipoint.",
    },
    {
      q: "La portée typique annoncée pour certains liens WiMAX peut atteindre :",
      options: ["Quelques mètres seulement", "Jusqu'à plusieurs dizaines de km en conditions favorables", "Uniquement 50 cm", "L'orbite lunaire"],
      correct: 1,
      hint: "Les liaisons longue portée dépendent de la bande, de la puissance et du relief.",
    },
    {
      q: "Le duplexage TDD signifie :",
      options: [
        "Montant et descendant sur des fréquences séparées uniquement",
        "Montant et descendant partagent la même fréquence dans le temps",
        "Pas de lien montant possible",
        "Double câble Ethernet obligatoire",
      ],
      correct: 1,
      hint: "En TDD, des créneaux temporels alternent émission et réception.",
    },
    {
      q: "PKM dans le contexte 802.16 concerne surtout :",
      options: [
        "La gestion des clés et l'authentification des équipements",
        "La couleur des antennes",
        "Un protocole de streaming musical",
        "La facturation de l'électricité",
      ],
      correct: 0,
      hint: "Privacy Key Management assure l'échange sécurisé des paramètres de chiffrement.",
    },
    {
      q: "Le débit utile perçu par l'utilisateur dépend notamment de :",
      options: [
        "Uniquement de la couleur du logo de l'opérateur",
        "La charge de la cellule, le MCS et les retransmissions",
        "L'heure du jour uniquement",
        "Le type de prise murale",
      ],
      correct: 1,
      hint: "Le MCS (modulation and coding scheme) s'adapte aux conditions radio.",
    },
    {
      q: "WiMAX peut être pertinent pour illustrer :",
      options: [
        "Les réseaux LPWAN pour capteurs à très bas débit",
        "Le dernier kilomètre rural ou les liaisons backhaul sans tranchée",
        "Uniquement le NFC pour paiement contact",
        "Le HDMI des téléviseurs",
      ],
      correct: 1,
      hint: "Les zones peu denses profitent d'une couverture large sans fibre jusqu'à l'abonné.",
    },
    {
      q: "La latence est importante pour :",
      options: [
        "Les transferts FTP batch uniquement hors ligne",
        "La voix sur IP, la visioconférence et le jeu en ligne",
        "Le stockage magnétique sur bande",
        "L'impression matricielle",
      ],
      correct: 1,
      hint: "Une latence faible améliore l'interactivité des applications temps réel.",
    },
  ];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickQuestions() {
    var idx = shuffle(QUESTIONS.map(function (_, i) { return i; })).slice(0, 10);
    return idx.map(function (i) { return QUESTIONS[i]; });
  }

  var state = {
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

  function showPlay() {
    elPlay.classList.remove("hidden");
    elResult.classList.add("hidden");
  }

  function showResult() {
    elPlay.classList.add("hidden");
    elResult.classList.remove("hidden");
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
  }

  function updateProgress() {
    var total = state.session.length;
    var n = state.index + 1;
    var pct = Math.round((n / total) * 100);
    elProgressLabel.textContent = "Question " + n + "/" + total;
    elProgressPct.textContent = pct + "% complété";
    elBar.style.width = pct + "%";
  }

  function renderQuestion() {
    var q = state.session[state.index];
    state.answered = false;
    state.selectedWrong = -1;
    elQuestion.textContent = q.q;
    elHint.classList.add("hidden");
    elNextWrap.classList.add("hidden");
    elOptions.innerHTML = "";

    q.options.forEach(function (opt, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option";
      btn.innerHTML =
        '<span class="quiz-option__letter">' +
        String.fromCharCode(65 + i) +
        "</span><span>" +
        opt +
        "</span>";
      btn.addEventListener("click", function () {
        onPick(i, btn);
      });
      elOptions.appendChild(btn);
    });
    updateProgress();
  }

  function onPick(choice, btn) {
    if (state.answered) return;
    var q = state.session[state.index];
    state.answered = true;
    var buttons = elOptions.querySelectorAll(".quiz-option");

    if (choice === q.correct) {
      state.score++;
      btn.classList.add("quiz-option--correct");
    } else {
      state.selectedWrong = choice;
      btn.classList.add("quiz-option--wrong");
      buttons[q.correct].classList.add("quiz-option--correct");
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

  function next() {
    if (!state.answered) return;
    if (state.index + 1 >= state.session.length) {
      showResult();
      return;
    }
    state.index++;
    renderQuestion();
  }

  function startSession() {
    state.session = pickQuestions();
    state.index = 0;
    state.score = 0;
    showPlay();
    renderQuestion();
  }

  function archiveScore() {
    var raw = localStorage.getItem(STORAGE_ARCHIVE);
    var list = [];
    try {
      list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    var d = new Date();
    var dateStr =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0") +
      " " +
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0");
    list.push({
      score: state.score,
      total: state.session.length,
      date: dateStr,
    });
    localStorage.setItem(STORAGE_ARCHIVE, JSON.stringify(list));
    alert("Score archivé le " + dateStr);
  }

  function shareScore() {
    var text =
      "J'ai obtenu " + state.score + "/" + state.session.length + " au Quiz WiMAX sur le portail !";
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
    startSession();
  });

  startSession();

  document.body.classList.add("page-enter");
  requestAnimationFrame(function () {
    document.body.classList.add("page-enter-active");
  });
})();
