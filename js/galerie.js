/**
 * Galerie — souvenirs dans Firebase Realtime Database (souvenirs/).
 * identite / monID depuis localStorage (WiMAXIdentite + __WIMAX_getMonID).
 */
(function () {
  var REF_SOUVENIRS = "souvenirs";
  var KEY_ADMIN_UNTIL = "galerieAdminUntil";
  var LONG_PRESS_MS = 600;
  /** Après ouverture du menu, ignorer le clic « fantôme » (touchend/mouseup → click) qui refermait tout de suite. */
  var menuOpenGuardUntil = 0;
  var MENU_OPEN_GUARD_MS = 550;
  var ADMIN_PIN = "wimax2025";
  var MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  var COMPRESS_THRESHOLD_BYTES = 500 * 1024;
  var COMPRESS_JPEG_QUALITY = 0.6;

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

  /** Dernière liste depuis Firebase (tri nouveau → ancien). */
  var currentSouvenirItems = [];

  function getDb() {
    return window.__WIMAX_FB_DB || null;
  }

  function getMyMonID() {
    if (typeof window.__WIMAX_getMonID === "function") {
      return window.__WIMAX_getMonID();
    }
    return (localStorage.getItem("monID") || "").trim();
  }

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
    return (localStorage.getItem("monIdentite") || "").trim();
  }

  function displayIdentiteForItem(item) {
    return item.identite || "—";
  }

  /** Même appareil = même monID (stocké avec la photo). */
  function isMyPhoto(item) {
    var mine = getMyMonID();
    if (!mine || !item || !item.monID) return false;
    return String(item.monID) === String(mine);
  }

  function estimateDataUrlBytes(dataUrl) {
    if (typeof dataUrl !== "string") return 0;
    var i = dataUrl.indexOf(",");
    if (i === -1) return 0;
    var b64 = dataUrl.slice(i + 1);
    var padding = 0;
    if (b64.endsWith("==")) padding = 2;
    else if (b64.endsWith("=")) padding = 1;
    return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
  }

  function compressDataUrlToJpeg(dataUrl, quality, callback) {
    var img = new Image();
    img.onload = function () {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          callback(new Error("Canvas indisponible sur cet appareil."));
          return;
        }
        ctx.drawImage(img, 0, 0);
        var out = canvas.toDataURL("image/jpeg", quality);
        callback(null, out);
      } catch (e) {
        callback(e);
      }
    };
    img.onerror = function () {
      callback(new Error("Impossible de décoder l’image pour la compression."));
    };
    img.src = dataUrl;
  }

  function maybeCompressBase64(dataUrl, callback) {
    try {
      if (estimateDataUrlBytes(dataUrl) <= COMPRESS_THRESHOLD_BYTES) {
        callback(null, dataUrl);
        return;
      }
      compressDataUrlToJpeg(dataUrl, COMPRESS_JPEG_QUALITY, callback);
    } catch (e) {
      callback(e);
    }
  }

  function readFileAsDataURL(file, callback) {
    var reader = new FileReader();
    reader.onerror = function () {
      callback(new Error("Impossible de lire ce fichier. Réessaie avec une photo JPG ou PNG."));
    };
    reader.onload = function () {
      var dataUrl = reader.result;
      if (typeof dataUrl !== "string" || dataUrl.length < 32) {
        callback(new Error("Import incomplet. Réessaie avec une autre photo."));
        return;
      }
      callback(null, dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function snapshotToItems(snap) {
    var val = snap.val();
    if (!val || typeof val !== "object") return [];
    return Object.keys(val)
      .map(function (key) {
        var o = val[key];
        if (!o || typeof o !== "object") return null;
        return Object.assign({ id: key }, o);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
      });
  }

  function removeSouvenir(photoId, callback) {
    var db = getDb();
    if (!db || !photoId) {
      if (callback) callback(new Error("Suppression impossible."));
      return;
    }
    db.ref(REF_SOUVENIRS + "/" + photoId).remove(function (err) {
      if (callback) callback(err || null);
    });
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

  function blockImageContextAndDrag(img) {
    if (!img) return;
    img.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    img.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
  }

  function formatMetaDateTime(item) {
    var d = item.date || "";
    var h = item.heure || "";
    if (d && h) return d + " · " + h;
    return d || h || "";
  }

  function render() {
    updateAdminUI();
    if (!grid) return;

    var items = currentSouvenirItems;
    var admin = isAdmin();

    grid.innerHTML = "";

    items.forEach(function (item) {
      var myPhoto = isMyPhoto(item);

      var wrap = document.createElement("div");
      wrap.className = "souvenir-item" + (myPhoto ? "" : " souvenir-item--locked");
      wrap.dataset.id = String(item.id);

      var thumb = document.createElement("div");
      thumb.className = "souvenir-item__thumb";

      var img = document.createElement("img");
      img.src = item.image || "";
      img.alt = displayIdentiteForItem(item) ? "Souvenir — " + displayIdentiteForItem(item) : "Souvenir";
      img.setAttribute("draggable", "false");
      blockImageContextAndDrag(img);

      thumb.appendChild(img);

      if (admin) {
        var adminDel = document.createElement("button");
        adminDel.type = "button";
        adminDel.className = "souvenir-item__admin-del";
        adminDel.textContent = "🗑️";
        adminDel.setAttribute("aria-label", "Supprimer cette photo (organisateur)");
        adminDel.addEventListener("touchstart", function (e) {
          e.stopPropagation();
        });
        adminDel.addEventListener("mousedown", function (e) {
          e.stopPropagation();
        });
        adminDel.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!window.confirm("Supprimer cette photo (organisateur) ?")) return;
          removeSouvenir(item.id, function (err) {
            if (err) alert(err.message || "Erreur lors de la suppression.");
          });
        });
        thumb.appendChild(adminDel);
      }

      var menu = document.createElement("div");
      menu.className = "souvenir-item__menu";
      menu.setAttribute("aria-hidden", "true");

      if (myPhoto) {
        var menuTitle = document.createElement("div");
        menuTitle.className = "souvenir-item__menu-title";
        menuTitle.textContent = "🗑️ Supprimer ma photo ?";

        var menuRow = document.createElement("div");
        menuRow.className = "souvenir-item__menu-row";

        var btnCancelMenu = document.createElement("button");
        btnCancelMenu.type = "button";
        btnCancelMenu.className = "souvenir-item__menu-btn souvenir-item__menu-btn--secondary";
        btnCancelMenu.textContent = "Annuler";

        var btnConfirmMenu = document.createElement("button");
        btnConfirmMenu.type = "button";
        btnConfirmMenu.className = "souvenir-item__menu-btn souvenir-item__menu-btn--danger";
        btnConfirmMenu.textContent = "Confirmer";

        menu.addEventListener("touchstart", function (e) {
          e.stopPropagation();
        });
        menu.addEventListener("mousedown", function (e) {
          e.stopPropagation();
        });

        btnCancelMenu.addEventListener("click", function (e) {
          e.stopPropagation();
          wrap.classList.remove("show-menu");
          menu.setAttribute("aria-hidden", "true");
        });

        btnConfirmMenu.addEventListener("click", function (e) {
          e.stopPropagation();
          removeSouvenir(item.id, function (err) {
            if (err) {
              alert(err.message || "Erreur lors de la suppression.");
              return;
            }
            clearLongPressState();
          });
        });

        menuRow.appendChild(btnCancelMenu);
        menuRow.appendChild(btnConfirmMenu);
        menu.appendChild(menuTitle);
        menu.appendChild(menuRow);
        thumb.appendChild(menu);
      }

      var meta = document.createElement("div");
      meta.className = "souvenir-item__meta";
      meta.innerHTML =
        '<div class="souvenir-item__identite-row"><span class="souvenir-item__prenom"></span></div><div class="souvenir-item__date"></div>';
      var idRow = meta.querySelector(".souvenir-item__identite-row");
      idRow.querySelector(".souvenir-item__prenom").textContent = displayIdentiteForItem(item);
      if (myPhoto) {
        idRow.classList.add("souvenir-item__identite-row--mine");
        var moiBadge = document.createElement("span");
        moiBadge.className = "souvenir-item__moi-badge";
        moiBadge.textContent = "📍 Moi";
        idRow.appendChild(moiBadge);
      }
      meta.querySelector(".souvenir-item__date").textContent = formatMetaDateTime(item);

      wrap.appendChild(thumb);
      wrap.appendChild(meta);

      var pressTimer = null;

      function startPress() {
        if (!myPhoto) return;
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

      thumb.addEventListener("contextmenu", function (e) {
        e.preventDefault();
      });
      thumb.addEventListener(
        "touchstart",
        function (e) {
          e.preventDefault();
          if (myPhoto) startPress();
        },
        { passive: false }
      );

      if (myPhoto) {
        thumb.addEventListener("mousedown", function (e) {
          if (e.button !== 0) return;
          startPress();
        });
        thumb.addEventListener("mouseup", cancelPress);
        thumb.addEventListener("mouseleave", cancelPress);
        thumb.addEventListener("touchend", cancelPress);
        thumb.addEventListener("touchcancel", cancelPress);
      }

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

  function attachFirebaseListener() {
    var db = getDb();
    if (!db) {
      if (grid) {
        grid.innerHTML = "";
        var p = document.createElement("p");
        p.style.gridColumn = "1 / -1";
        p.style.textAlign = "center";
        p.style.color = "var(--sous-texte)";
        p.style.fontSize = "0.85rem";
        p.textContent = "Galerie indisponible : Firebase n’est pas chargé. Vérifie la connexion.";
        grid.appendChild(p);
      }
      return;
    }
    db.ref(REF_SOUVENIRS).on(
      "value",
      function (snap) {
        currentSouvenirItems = snapshotToItems(snap);
        render();
      },
      function (err) {
        alert("Erreur de lecture Firebase : " + ((err && err.message) || String(err)));
      }
    );
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
    try {
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
      var identite = localStorage.getItem("monIdentite");
      if (!identite || !String(identite).trim()) {
        alert("Identité manquante. Retourne sur l’accueil pour te créer un profil.");
        return;
      }

      var monID = getMyMonID();
      if (!monID) {
        alert("Identifiant appareil manquant. Recharge la page et réessaie.");
        return;
      }

      var db = getDb();
      if (!db) {
        alert("Firebase indisponible. Vérifie la connexion et recharge la page.");
        return;
      }

      readFileAsDataURL(file, function (readErr, dataUrl) {
        if (readErr) {
          alert(readErr.message || "Erreur de lecture du fichier.");
          return;
        }
        try {
          maybeCompressBase64(dataUrl, function (compErr, finalUrl) {
            if (compErr) {
              alert(compErr.message || "Erreur lors de la compression de l’image.");
              return;
            }
            try {
              var now = new Date();
              var payload = {
                identite: String(identite).trim(),
                monID: monID,
                image: finalUrl,
                date: now.toLocaleDateString("fr-FR"),
                heure: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
              };
              db.ref(REF_SOUVENIRS).push(payload, function (err) {
                if (err) {
                  alert(
                    "Impossible d’enregistrer la photo : " +
                      ((err && err.message) || "erreur Firebase. Réessaie plus tard.")
                  );
                  return;
                }
                try {
                  closeModal();
                  inputCamera.value = "";
                  inputGallery.value = "";
                  alert("Photo ajoutée ! ✅");
                } catch (e2) {
                  alert("Photo enregistrée, mais une erreur d’interface s’est produite. Recharge si besoin.");
                }
              });
            } catch (e) {
              alert(e.message || "Erreur inattendue lors de l’envoi.");
            }
          });
        } catch (e) {
          alert(e.message || "Erreur lors du traitement de l’image.");
        }
      });
    } catch (e) {
      alert(e.message || "Erreur lors de l’ajout de la photo. Réessaie.");
    }
  }

  if (fab) {
    fab.addEventListener("click", function () {
      clearLongPressState();
      openModal();
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
  }
  if (modalInner) {
    modalInner.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  if (btnAddCancel) {
    btnAddCancel.addEventListener("click", closeModal);
  }

  if (btnSourceCamera && inputCamera) {
    btnSourceCamera.addEventListener("click", function () {
      inputCamera.click();
    });
  }

  if (btnSourceGallery && inputGallery) {
    btnSourceGallery.addEventListener("click", function () {
      inputGallery.click();
    });
  }

  if (inputCamera) {
    inputCamera.addEventListener("change", function () {
      var f = inputCamera.files && inputCamera.files[0];
      if (f) handleFile(f);
    });
  }

  if (inputGallery) {
    inputGallery.addEventListener("change", function () {
      var f = inputGallery.files && inputGallery.files[0];
      if (f) handleFile(f);
    });
  }

  document.addEventListener("click", function (e) {
    if (Date.now() < menuOpenGuardUntil) return;
    if (e.target.closest(".souvenir-item__menu-btn")) return;
    if (e.target.closest(".souvenir-item__admin-del")) return;
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
      var imgEl = av.querySelector("img");
      if (imgEl && imgEl.getAttribute("src")) openLightbox(imgEl.src);
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
      if (e.target.closest(".souvenir-item__admin-del")) return;
      var cell = e.target.closest(".souvenir-item");
      if (!cell || cell.classList.contains("show-menu")) return;
      var imgEl = cell.querySelector(".souvenir-item__thumb img");
      if (!imgEl || e.target !== imgEl) return;
      if (imgEl.getAttribute("src")) openLightbox(imgEl.src);
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

  attachFirebaseListener();

  document.body.classList.add("page-enter");
  requestAnimationFrame(function () {
    document.body.classList.add("page-enter-active");
  });
})();
