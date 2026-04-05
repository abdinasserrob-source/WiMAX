/**
 * Popup classement Firebase (toutes les pages avec #btnClassement).
 * Temps réel tant que la popup est ouverte.
 */
(function () {
  var SESSION_DEFAULT = 10;

  function getMonID() {
    if (typeof window.__WIMAX_getMonID === "function") {
      return window.__WIMAX_getMonID();
    }
    return localStorage.getItem("monID") || "";
  }

  function getMonIdentite() {
    return (localStorage.getItem("monIdentite") || "").trim();
  }

  function rowsFromSnapshot(val) {
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
        total: Number(o.total) || SESSION_DEFAULT,
        date: String(o.date || ""),
      });
    });
    return rows;
  }

  var fbHandler = null;
  var overlayEl = null;
  var popupEl = null;

  function ensureDom() {
    if (document.getElementById("overlayClassement")) {
      overlayEl = document.getElementById("overlayClassement");
      popupEl = document.getElementById("popupClassement");
      return;
    }

    overlayEl = document.createElement("div");
    overlayEl.id = "overlayClassement";
    overlayEl.className = "classement-global-overlay";
    overlayEl.setAttribute("aria-hidden", "true");

    popupEl = document.createElement("div");
    popupEl.id = "popupClassement";
    popupEl.className = "classement-global-popup";
    popupEl.setAttribute("role", "dialog");
    popupEl.setAttribute("aria-modal", "true");
    popupEl.setAttribute("aria-labelledby", "classement-global-title");

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.id = "btnClassementClose";
    closeBtn.className = "classement-global-close";
    closeBtn.setAttribute("aria-label", "Fermer le classement");
    closeBtn.innerHTML = "&times;";

    var title = document.createElement("h2");
    title.id = "classement-global-title";
    title.className = "classement-global-title";
    title.textContent = "🏆 Classement WiMAX";

    var rule = document.createElement("div");
    rule.className = "classement-global-rule";

    var list = document.createElement("div");
    list.id = "listeClassement";
    list.className = "classement-global-list";

    popupEl.appendChild(closeBtn);
    popupEl.appendChild(title);
    popupEl.appendChild(rule);
    popupEl.appendChild(list);

    document.body.appendChild(overlayEl);
    document.body.appendChild(popupEl);

    overlayEl.addEventListener("click", fermerClassement);
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      fermerClassement();
    });
    popupEl.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  function renderListe(snap) {
    var container = document.getElementById("listeClassement");
    if (!container) return;

    var rows = rowsFromSnapshot(snap.val());
    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    rows = rows.slice(0, 10);

    var monID = getMonID();
    var monIdentite = getMonIdentite();
    var medals = ["🥇", "🥈", "🥉"];

    container.innerHTML = "";

    if (!rows.length) {
      container.textContent = "Aucun score publié encore 🎯";
      return;
    }

    rows.forEach(function (s, i) {
      var isMe = Boolean(monID && s.deviceId === monID);
      if (!isMe && !monID && monIdentite && s.identite === monIdentite) {
        isMe = true;
      }

      var row = document.createElement("div");
      row.className = "classement-global-row";
      if (isMe) row.classList.add("classement-global-row--me");

      var medal = i < 3 ? medals[i] : "  ";
      var left = document.createElement("span");
      left.className = "classement-global-row__name";
      left.textContent = medal + " " + s.identite;

      var rightWrap = document.createElement("span");
      rightWrap.className = "classement-global-row__right";

      var right = document.createElement("span");
      right.className = "classement-global-row__score";
      right.textContent = s.score + "/" + s.total;
      rightWrap.appendChild(right);

      if (isMe) {
        var vous = document.createElement("span");
        vous.className = "classement-global-row__vous";
        vous.textContent = "● Vous";
        rightWrap.appendChild(vous);
      }

      row.appendChild(left);
      row.appendChild(rightWrap);
      container.appendChild(row);
    });
  }

  function fermerClassement() {
    var db = window.__WIMAX_FB_DB;
    if (db && fbHandler) {
      db.ref("classement").off("value", fbHandler);
      fbHandler = null;
    }
    if (overlayEl) {
      overlayEl.style.display = "none";
      overlayEl.setAttribute("aria-hidden", "true");
    }
    if (popupEl) {
      popupEl.style.display = "none";
      popupEl.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "";
  }

  function ouvrirClassement() {
    ensureDom();
    var db = window.__WIMAX_FB_DB;

    overlayEl.style.display = "block";
    overlayEl.setAttribute("aria-hidden", "false");
    popupEl.style.display = "flex";
    popupEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (!db) {
      var c = document.getElementById("listeClassement");
      if (c) c.textContent = "Classement indisponible (Firebase non chargé).";
      return;
    }

    if (fbHandler) {
      db.ref("classement").off("value", fbHandler);
    }
    fbHandler = function (snap) {
      renderListe(snap);
    };
    db.ref("classement").on("value", fbHandler);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("#btnClassement");
    if (!btn) return;
    e.preventDefault();
    ouvrirClassement();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!popupEl || popupEl.style.display !== "flex") return;
    fermerClassement();
  });

  window.WiMAXClassementPopup = {
    open: ouvrirClassement,
    close: fermerClassement,
  };
})();
