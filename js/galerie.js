/**
 * Galerie — souvenirs : { id, identite, image, date } (identite = localStorage monIdentite).
 * Appui long : supprimer si identite correspond, ou mode organisateur.
 */
(function () {
  var KEY_SOUVENIRS = "souvenirs";
  var KEY_ADMIN_UNTIL = "galerieAdminUntil";
  var LONG_PRESS_MS = 600;
  /** Après ouverture du menu, ignorer le clic « fantôme » (touchend/mouseup → click) qui refermait tout de suite. */
  var menuOpenGuardUntil = 0;
  var MENU_OPEN_GUARD_MS = 550;
  /** Changez ce code (et gardez-le secret côté encadrant — il reste lisible dans le fichier, pas de serveur ici). */
  var ADMIN_PIN = "wimax";
  /** Au-delà, certains navigateurs échouent ou figent la page (data URL en mémoire). */
  var MAX_IMAGE_BYTES = 12 * 1024 * 1024;

  var grid = document.getElementById("souvenirs-grid");
  var fab = document.getElementById("fab-galerie");
  var overlay = document.getElementById("modal-overlay");
  var stepSource = document.getElementById("modal-step-source");
  var elModalIdentiteDisplay = document.getElementById("galerie-modal-identite-display");
  var btnAddCancel = document.getElementById("btn-add-cancel");
  var btnSourceCamera = document.getElementById("btn-source-camera");
  var btnSourceGallery = document.getElementById("btn-source-gallery");
  var inputCamera = document.getElementById("input-camera");
  var inputGallery = document.getElementById("input-gallery");
  var modalInner = document.getElementById("modal-box-inner");

  var adminOverlay = document.getElementById("modal-admin-overlay");
  var adminBox = document.getElementById("modal-admin-box");
  var inputAdminPin = document.getElementById("input-admin-pin");
  var btnOpenAdmin = document.getElementById("btn-open-admin");
  var btnAdminLogin = document.getElementById("btn-admin-login");
  var btnAdminCancel = document.getElementById("btn-admin-cancel");
  var btnAdminLogout = document.getElementById("btn-admin-logout");
  var adminBadge = document.getElementById("admin-badge");

  var lightbox = document.getElementById("galerie-lightbox");
  var lightboxImg = document.getElementById("galerie-lightbox-img");
  var lightboxClose = document.getElementById("galerie-lightbox-close");

  function openLightbox(src) {
    if (!lightbox || !lightboxImg || !src) return;
    clearLongPressState();
    lightboxImg.src = src;
    lightboxImg.alt = "Photo en grand";
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.remove("is-open");
    lightboxImg.removeAttribute("src");
    lightboxImg.alt = "";
    document.body.style.overflow = "";
  }

  function normPrenom(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function isAdmin() {
    var t = parseInt(localStorage.getItem(KEY_ADMIN_UNTIL), 10);
    return Boolean(t && Date.now() < t);
  }

  function setAdminSession(hours) {
    var h = typeof hours === "number" ? hours : 8;
    localStorage.setItem(KEY_ADMIN_UNTIL, String(Date.now() + h * 3600000));
  }

  function clearAdminSession() {
    localStorage.removeItem(KEY_ADMIN_UNTIL);
  }

  function updateAdminUI() {
    var admin = isAdmin();
    if (adminBadge) {
      adminBadge.classList.toggle("is-visible", admin);
    }
    if (btnOpenAdmin) {
      btnOpenAdmin.style.display = admin ? "none" : "";
    }
  }

  function getMonIdentite() {
    if (window.WiMAXIdentite && typeof window.WiMAXIdentite.get === "function") {
      return window.WiMAXIdentite.get() || "";
    }
    return "";
  }

  function displayIdentiteForItem(item) {
    return item.identite || item.prenom || "—";
  }

  function namePartAfterEmoji(full) {
    full = String(full || "").trim();
    var i = full.indexOf(" ");
    return i === -1 ? full : full.slice(i + 1).trim();
  }

  function isOwnerPhoto(item) {
    var mine = getMonIdentite();
    if (!mine) return false;
    if (item.identite === mine) return true;
    if (item.identite) return false;
    var legacy = (item.prenom || "").trim();
    if (!legacy) return false;
    return normPrenom(legacy) === normPrenom(namePartAfterEmoji(mine));
  }

  /** Menu appui long : propriétaire (dernierPrenom) ou organisateur. */
  function canOpenDeleteMenu(item) {
    return isOwnerPhoto(item) || isAdmin();
  }

  function canDeleteSouvenir(item) {
    return isOwnerPhoto(item) || isAdmin();
  }

  function blockImageContextAndDrag(img) {
    if (!img) return;
    img.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    img.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
  }

  function loadSouvenirs() {
    try {
      var raw = localStorage.getItem(KEY_SOUVENIRS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveSouvenirs(arr) {
    localStorage.setItem(KEY_SOUVENIRS, JSON.stringify(arr));
  }

  function formatDate(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function clearLongPressState() {
    document.querySelectorAll(".souvenir-item.show-menu").forEach(function (el) {
      el.classList.remove("show-menu");
      var m = el.querySelector(".souvenir-item__menu");
      if (m) m.setAttribute("aria-hidden", "true");
    });
  }

  function openAdminModal() {
    if (!adminOverlay) return;
    adminOverlay.classList.add("is-open");
    if (inputAdminPin) {
      inputAdminPin.value = "";
      inputAdminPin.focus();
    }
  }

  function closeAdminModal() {
    if (adminOverlay) adminOverlay.classList.remove("is-open");
    if (inputAdminPin) inputAdminPin.value = "";
  }

  function render() {
    updateAdminUI();
    var items = loadSouvenirs();
    grid.innerHTML = "";
    items
      .slice()
      .reverse()
      .forEach(function (item) {
        var menuAllowed = canOpenDeleteMenu(item);
        var owner = isOwnerPhoto(item);

        var wrap = document.createElement("div");
        wrap.className = "souvenir-item" + (menuAllowed ? "" : " souvenir-item--locked");
        wrap.dataset.id = String(item.id);

        var thumb = document.createElement("div");
        thumb.className = "souvenir-item__thumb";

        var img = document.createElement("img");
        img.src = item.image;
        img.alt = displayIdentiteForItem(item) ? "Souvenir — " + displayIdentiteForItem(item) : "Souvenir";
        img.setAttribute("draggable", "false");
        blockImageContextAndDrag(img);

        thumb.appendChild(img);

        var menu = document.createElement("div");
        menu.className = "souvenir-item__menu";
        menu.setAttribute("aria-hidden", "true");
        var menuBtn = document.createElement("button");
        menuBtn.type = "button";
        menuBtn.className = "souvenir-item__menu-btn";
        menuBtn.textContent = owner ? "🗑️ Supprimer ma photo" : "🗑️ Supprimer (organisateur)";
        menuBtn.setAttribute("aria-label", owner ? "Supprimer ma photo" : "Supprimer cette photo en tant qu’organisateur");
        menu.appendChild(menuBtn);
        thumb.appendChild(menu);

        menuBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!canDeleteSouvenir(item)) return;
          var msg = owner
            ? "🗑️ Supprimer ma photo ?"
            : "Supprimer cette photo (organisateur) ?";
          if (!window.confirm(msg)) return;
          var id = Number(wrap.dataset.id);
          var next = loadSouvenirs().filter(function (x) {
            return x.id !== id;
          });
          saveSouvenirs(next);
          clearLongPressState();
          render();
        });

        var meta = document.createElement("div");
        meta.className = "souvenir-item__meta";
        meta.innerHTML = '<div class="souvenir-item__prenom"></div><div class="souvenir-item__date"></div>';
        meta.querySelector(".souvenir-item__prenom").textContent = displayIdentiteForItem(item);
        meta.querySelector(".souvenir-item__date").textContent = item.date || "";

        wrap.appendChild(thumb);
        wrap.appendChild(meta);

        var pressTimer = null;

        function startPress() {
          if (!menuAllowed) return;
          clearTimeout(pressTimer);
          pressTimer = setTimeout(function () {
            clearLongPressState();
            wrap.classList.add("show-menu");
            menu.setAttribute("aria-hidden", "false");
            pressTimer = null;
            menuOpenGuardUntil = Date.now() + MENU_OPEN_GUARD_MS;
          }, LONG_PRESS_MS);
        }

        function cancelPress() {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        }

        if (menuAllowed) {
          thumb.addEventListener("touchstart", startPress, { passive: true });
          thumb.addEventListener("touchend", cancelPress);
          thumb.addEventListener("touchcancel", cancelPress);
          thumb.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;
            startPress();
          });
          thumb.addEventListener("mouseup", cancelPress);
        }

        thumb.addEventListener("contextmenu", function (e) {
          e.preventDefault();
        });

        grid.appendChild(wrap);
      });

    if (items.length === 0) {
      var empty = document.createElement("p");
      empty.style.gridColumn = "1 / -1";
      empty.style.textAlign = "center";
      empty.style.color = "var(--sous-texte)";
      empty.style.fontSize = "0.85rem";
      empty.textContent = "Aucun souvenir pour le moment. Appuyez sur + pour en ajouter.";
      grid.appendChild(empty);
    }
  }

  function openModal() {
    var id = getMonIdentite();
    if (!id) {
      alert("Crée d’abord ton identité depuis l’accueil du portail (home).");
      return;
    }
    if (elModalIdentiteDisplay) elModalIdentiteDisplay.textContent = id;
    overlay.classList.add("is-open");
    if (stepSource) stepSource.classList.remove("hidden");
    inputCamera.value = "";
    inputGallery.value = "";
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    if (stepSource) stepSource.classList.remove("hidden");
    inputCamera.value = "";
    inputGallery.value = "";
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type || !file.type.match(/^image\//)) {
      alert(
        "Ce fichier n’est pas reconnu comme une image (types acceptés : JPG, PNG, GIF, WebP, etc.). Les PDF ou documents sont refusés."
      );
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      alert(
        "Photo trop lourde (max. environ 12 Mo). Réduis la taille ou choisis une autre image."
      );
      return;
    }
    var identite = getMonIdentite();
    if (!identite) {
      alert("Identité manquante. Retourne sur l’accueil pour te créer un profil.");
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () {
      alert("Impossible de lire ce fichier. Réessaie avec une photo JPG ou PNG.");
    };
    reader.onload = function () {
      var dataUrl = reader.result;
      if (typeof dataUrl !== "string" || dataUrl.length < 32) {
        alert("Import incomplet. Réessaie avec une autre photo.");
        return;
      }
      var arr = loadSouvenirs();
      arr.push({
        id: Date.now(),
        identite: identite,
        image: dataUrl,
        date: formatDate(new Date()),
      });
      saveSouvenirs(arr);
      closeModal();
      inputCamera.value = "";
      inputGallery.value = "";
      render();
    };
    reader.readAsDataURL(file);
  }

  fab.addEventListener("click", function () {
    clearLongPressState();
    openModal();
  });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  if (modalInner) {
    modalInner.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  if (btnAddCancel) {
    btnAddCancel.addEventListener("click", closeModal);
  }

  btnSourceCamera.addEventListener("click", function () {
    inputCamera.click();
  });

  btnSourceGallery.addEventListener("click", function () {
    inputGallery.click();
  });

  inputCamera.addEventListener("change", function () {
    var f = inputCamera.files && inputCamera.files[0];
    if (f) handleFile(f);
  });

  inputGallery.addEventListener("change", function () {
    var f = inputGallery.files && inputGallery.files[0];
    if (f) handleFile(f);
  });

  document.addEventListener("click", function (e) {
    if (Date.now() < menuOpenGuardUntil) return;
    if (e.target.closest(".souvenir-item__menu-btn")) return;
    clearLongPressState();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      clearLongPressState();
      if (lightbox && lightbox.classList.contains("is-open")) {
        closeLightbox();
      }
    }
  });

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }
  if (lightboxClose) {
    lightboxClose.addEventListener("click", function (e) {
      e.stopPropagation();
      closeLightbox();
    });
  }

  if (lightboxImg) {
    lightboxImg.setAttribute("draggable", "false");
    blockImageContextAndDrag(lightboxImg);
  }

  var teamRow = document.querySelector(".team-row");
  if (teamRow) {
    teamRow.addEventListener("click", function (e) {
      var av = e.target.closest(".team-member__avatar");
      if (!av) return;
      var img = av.querySelector("img");
      if (img && img.getAttribute("src")) openLightbox(img.src);
    });
  }

  var encadreurBlock = document.querySelector(".encadreur-block");
  if (encadreurBlock) {
    encadreurBlock.addEventListener("click", function (e) {
      if (e.target.tagName !== "IMG") return;
      var im = e.target;
      if (im.getAttribute("src")) openLightbox(im.src);
    });
  }

  if (grid) {
    grid.addEventListener("click", function (e) {
      if (e.target.closest(".souvenir-item__menu")) return;
      var cell = e.target.closest(".souvenir-item");
      if (!cell || cell.classList.contains("show-menu")) return;
      var img = cell.querySelector(".souvenir-item__thumb img");
      if (!img || e.target !== img) return;
      if (img.getAttribute("src")) openLightbox(img.src);
    });
  }

  if (btnOpenAdmin) {
    btnOpenAdmin.addEventListener("click", function () {
      clearLongPressState();
      openAdminModal();
    });
  }

  if (btnAdminCancel) {
    btnAdminCancel.addEventListener("click", closeAdminModal);
  }

  if (adminOverlay) {
    adminOverlay.addEventListener("click", function (e) {
      if (e.target === adminOverlay) closeAdminModal();
    });
  }

  if (adminBox) {
    adminBox.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  if (btnAdminLogin) {
    btnAdminLogin.addEventListener("click", function () {
      var pin = (inputAdminPin && inputAdminPin.value) || "";
      if (pin === ADMIN_PIN) {
        setAdminSession(8);
        closeAdminModal();
        render();
      } else {
        alert("Code incorrect.");
        if (inputAdminPin) inputAdminPin.focus();
      }
    });
  }

  if (inputAdminPin) {
    inputAdminPin.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (btnAdminLogin) btnAdminLogin.click();
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener("click", function () {
      clearAdminSession();
      clearLongPressState();
      render();
    });
  }

  render();

  document.body.classList.add("page-enter");
  requestAnimationFrame(function () {
    document.body.classList.add("page-enter-active");
  });
})();
