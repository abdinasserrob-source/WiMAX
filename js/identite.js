/**
 * Identité locale — localStorage "monIdentite" = "🦁 Ali" (emoji + prénom).
 * Barre d’avatar : éléments avec [data-identite-slot]
 */
(function () {
  var KEY = "monIdentite";
  var MAX_NAME = 15;
  var EMOJIS = [
    "🦁",
    "🐯",
    "🦊",
    "🐻",
    "🦅",
    "🐬",
    "🦋",
    "🌟",
    "🎯",
    "🚀",
    "🌈",
    "⚡",
    "🎸",
    "🏆",
    "🌺",
    "🦄",
  ];

  var selectedEmoji = "";
  var modalRoot = null;
  var escapeHandler = null;

  function get() {
    return (localStorage.getItem(KEY) || "").trim();
  }

  function set(val) {
    localStorage.setItem(KEY, String(val || "").trim());
    window.dispatchEvent(new CustomEvent("wimax-identite-change"));
  }

  function needsSetup() {
    return !get();
  }

  function parseExisting(s) {
    s = String(s || "").trim();
    if (!s) return { emoji: "", name: "" };
    var i = s.indexOf(" ");
    if (i === -1) return { emoji: s, name: "" };
    return { emoji: s.slice(0, i).trim(), name: s.slice(i + 1).trim().slice(0, MAX_NAME) };
  }

  function buildIdentite(emoji, name) {
    var n = String(name || "").trim().slice(0, MAX_NAME);
    return String(emoji || "").trim() + " " + n;
  }

  function closeModal() {
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
    if (!modalRoot || !modalRoot.parentNode) return;
    modalRoot.parentNode.removeChild(modalRoot);
    modalRoot = null;
    document.body.style.overflow = "";
  }

  function showIdentiteModal(opts) {
    opts = opts || {};
    var firstRun = Boolean(opts.firstRun);
    var existing = get();
    var parsed = parseExisting(existing);
    selectedEmoji = parsed.emoji || EMOJIS[0];

    modalRoot = document.createElement("div");
    modalRoot.className = "identite-modal";
    modalRoot.setAttribute("role", "dialog");
    modalRoot.setAttribute("aria-modal", "true");
    modalRoot.setAttribute("aria-labelledby", "identite-modal-title");

    var backdrop = document.createElement("div");
    backdrop.className = "identite-modal__backdrop";
    if (!firstRun) {
      backdrop.addEventListener("click", closeModal);
    }

    var box = document.createElement("div");
    box.className = "identite-modal__box";
    box.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    var title = document.createElement("h2");
    title.id = "identite-modal-title";
    title.className = "identite-modal__title";
    title.textContent = firstRun ? "Crée ton identité 👋" : "Modifier ton identité ✏️";

    var sub = document.createElement("p");
    sub.className = "identite-modal__sub";
    sub.textContent = firstRun
      ? "Elle sera utilisée dans le quiz et la galerie."
      : "Emoji et prénom (comme pour une nouvelle création).";

    var grid = document.createElement("div");
    grid.className = "identite-modal__emoji-grid";
    EMOJIS.forEach(function (em) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "identite-modal__emoji-btn";
      b.setAttribute("aria-label", "Choisir " + em);
      b.textContent = em;
      b.dataset.emoji = em;
      if (em === selectedEmoji) b.classList.add("is-selected");
      b.addEventListener("click", function () {
        selectedEmoji = em;
        grid.querySelectorAll(".identite-modal__emoji-btn").forEach(function (x) {
          x.classList.toggle("is-selected", x.dataset.emoji === em);
        });
      });
      grid.appendChild(b);
    });

    var label = document.createElement("label");
    label.className = "identite-modal__label";
    label.setAttribute("for", "identite-modal-prenom");
    label.textContent = "Ton prénom";

    var input = document.createElement("input");
    input.type = "text";
    input.id = "identite-modal-prenom";
    input.className = "identite-modal__input";
    input.maxLength = MAX_NAME;
    input.autocomplete = "nickname";
    input.placeholder = "Ex. Ali";
    input.value = firstRun ? "" : parsed.name;

    var actions = document.createElement("div");
    actions.className = "identite-modal__actions";

    if (!firstRun) {
      var btnCancel = document.createElement("button");
      btnCancel.type = "button";
      btnCancel.className = "btn-muted identite-modal__btn-half";
      btnCancel.textContent = "Annuler";
      btnCancel.addEventListener("click", closeModal);
      actions.appendChild(btnCancel);
    }

    var btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.className = "btn-primary identite-modal__btn-main";
    btnOk.textContent = firstRun ? "C'est parti !" : "Enregistrer";
    btnOk.addEventListener("click", function () {
      var name = input.value.trim();
      if (!selectedEmoji || !name) {
        input.focus();
        return;
      }
      set(buildIdentite(selectedEmoji, name));
      closeModal();
      mountAllSlots();
    });
    actions.appendChild(btnOk);

    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(grid);
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(actions);

    modalRoot.appendChild(backdrop);
    modalRoot.appendChild(box);
    document.body.appendChild(modalRoot);
    document.body.style.overflow = "hidden";
    input.focus();

    escapeHandler = function (ev) {
      if (ev.key === "Escape" && !firstRun) closeModal();
    };
    document.addEventListener("keydown", escapeHandler);
  }

  function renderAvatarSlot(el) {
    if (!el) return;
    el.innerHTML = "";
    el.classList.add("identite-bar-wrap");
    var id = get();
    if (!id) {
      var a = document.createElement("a");
      a.className = "identite-bar__link";
      a.href = "home.html";
      a.textContent = "Identité";
      el.appendChild(a);
      return;
    }
    var span = document.createElement("span");
    span.className = "identite-bar__label";
    span.textContent = id;
    span.title = id;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "identite-bar__edit";
    btn.setAttribute("aria-label", "Modifier mon identité");
    btn.textContent = "✏️";
    btn.addEventListener("click", function () {
      showIdentiteModal({ firstRun: false });
    });
    el.appendChild(span);
    el.appendChild(btn);
  }

  function mountAllSlots() {
    document.querySelectorAll("[data-identite-slot]").forEach(renderAvatarSlot);
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountAllSlots();
    window.addEventListener("wimax-identite-change", mountAllSlots);
    if (document.body.classList.contains("page-home") && needsSetup()) {
      showIdentiteModal({ firstRun: true });
    }
  });

  window.WiMAXIdentite = {
    KEY: KEY,
    get: get,
    set: set,
    needsSetup: needsSetup,
    refresh: mountAllSlots,
    openEditor: function () {
      showIdentiteModal({ firstRun: false });
    },
  };
})();
