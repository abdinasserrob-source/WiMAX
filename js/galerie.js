/**
 * Galerie — souvenirs dans localStorage.
 * Ajout : tout le monde. Suppression : propriétaire (même prénom que le dernier saisi) ou organisateur (code).
 */
(function () {
  var KEY_SOUVENIRS = "souvenirs";
  var KEY_PRENOM = "dernierPrenom";
  var KEY_ADMIN_UNTIL = "galerieAdminUntil";
  var LONG_PRESS_MS = 600;
  /** Changez ce code (et gardez-le secret côté encadrant — il reste lisible dans le fichier, pas de serveur ici). */
  var ADMIN_PIN = "wimax";

  var grid = document.getElementById("souvenirs-grid");
  var fab = document.getElementById("fab-galerie");
  var overlay = document.getElementById("modal-overlay");
  var stepPrenom = document.getElementById("modal-step-prenom");
  var stepSource = document.getElementById("modal-step-source");
  var inputPrenom = document.getElementById("input-prenom");
  var btnPrenomOk = document.getElementById("btn-prenom-ok");
  var btnPrenomCancel = document.getElementById("btn-prenom-cancel");
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

  function canDeleteSouvenir(item) {
    if (isAdmin()) return true;
    var sessionName = normPrenom(localStorage.getItem(KEY_PRENOM));
    if (!sessionName) return false;
    return normPrenom(item.prenom) === sessionName;
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
    document.querySelectorAll(".souvenir-item.show-delete").forEach(function (el) {
      el.classList.remove("show-delete");
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
        var deletable = canDeleteSouvenir(item);

        var wrap = document.createElement("div");
        wrap.className = "souvenir-item" + (deletable ? "" : " souvenir-item--locked");
        wrap.dataset.id = String(item.id);

        var img = document.createElement("img");
        img.src = item.image;
        img.alt = "Souvenir";

        var del = document.createElement("button");
        del.type = "button";
        del.className = "souvenir-item__del";
        del.setAttribute("aria-label", "Supprimer la photo");
        del.textContent = "🗑️";

        var meta = document.createElement("div");
        meta.className = "souvenir-item__meta";
        meta.innerHTML = '<div class="prenom"></div><div class="date"></div>';
        meta.querySelector(".prenom").textContent = item.prenom || "—";
        meta.querySelector(".date").textContent = item.date || "";

        wrap.appendChild(del);
        wrap.appendChild(img);
        wrap.appendChild(meta);

        var pressTimer = null;

        function startPress() {
          if (!deletable) return;
          clearTimeout(pressTimer);
          pressTimer = setTimeout(function () {
            clearLongPressState();
            wrap.classList.add("show-delete");
            pressTimer = null;
          }, LONG_PRESS_MS);
        }

        function cancelPress() {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        }

        if (deletable) {
          wrap.addEventListener("touchstart", startPress, { passive: true });
          wrap.addEventListener("touchend", cancelPress);
          wrap.addEventListener("touchcancel", cancelPress);
          wrap.addEventListener("mousedown", startPress);
          wrap.addEventListener("mouseup", cancelPress);
          wrap.addEventListener("mouseleave", cancelPress);
        }

        del.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!canDeleteSouvenir(item)) return;
          var id = Number(wrap.dataset.id);
          var next = loadSouvenirs().filter(function (x) {
            return x.id !== id;
          });
          saveSouvenirs(next);
          render();
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
    overlay.classList.add("is-open");
    stepPrenom.classList.remove("hidden");
    stepSource.classList.add("hidden");
    var last = localStorage.getItem(KEY_PRENOM) || "";
    inputPrenom.value = last;
    inputPrenom.focus();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    stepPrenom.classList.remove("hidden");
    stepSource.classList.add("hidden");
    inputCamera.value = "";
    inputGallery.value = "";
  }

  function goSourceStep() {
    var name = (inputPrenom.value || "").trim();
    if (!name) {
      inputPrenom.focus();
      return;
    }
    stepPrenom.classList.add("hidden");
    stepSource.classList.remove("hidden");
  }

  function handleFile(file) {
    if (!file || !file.type.match(/^image\//)) {
      alert("Veuillez choisir une image.");
      return;
    }
    var prenom = (inputPrenom.value || "").trim();
    if (!prenom) return;

    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      var arr = loadSouvenirs();
      arr.push({
        id: Date.now(),
        prenom: prenom,
        image: dataUrl,
        date: formatDate(new Date()),
      });
      saveSouvenirs(arr);
      localStorage.setItem(KEY_PRENOM, prenom);
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

  btnPrenomOk.addEventListener("click", goSourceStep);
  btnPrenomCancel.addEventListener("click", closeModal);

  inputPrenom.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      goSourceStep();
    }
  });

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
    if (
      !e.target.closest(".souvenir-item") &&
      !e.target.closest("#fab-galerie") &&
      !e.target.closest("#btn-open-admin") &&
      !e.target.closest("#admin-badge") &&
      !e.target.closest("#galerie-lightbox")
    ) {
      clearLongPressState();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lightbox && lightbox.classList.contains("is-open")) {
      closeLightbox();
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
      if (e.target.closest(".souvenir-item__del")) return;
      var cell = e.target.closest(".souvenir-item");
      if (!cell || cell.classList.contains("show-delete")) return;
      if (e.target !== cell.querySelector("img")) return;
      var img = cell.querySelector("img");
      if (img && img.getAttribute("src")) openLightbox(img.src);
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
