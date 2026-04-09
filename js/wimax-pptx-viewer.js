(function () {
  var pptPath = "assets/supports/ppt_WiMAX.pptx";
  var statusEl = document.getElementById("wimax-pptx-status");
  var canvasWrap = document.getElementById("wimax-pptx-canvas-wrap");
  var canvas = document.getElementById("wimax-pptx-canvas");
  var toolbar = document.getElementById("wimax-pptx-toolbar");
  var prevBtn = document.getElementById("wimax-pptx-prev");
  var nextBtn = document.getElementById("wimax-pptx-next");
  var counterEl = document.getElementById("wimax-pptx-counter");

  if (!statusEl || !canvas || !canvasWrap || !toolbar || !prevBtn || !nextBtn || !counterEl) return;

  function setError(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add("wimax-pptx-status--error");
    canvasWrap.hidden = true;
    toolbar.hidden = true;
  }

  if (window.location.protocol === "file:") {
    setError(
      "Pour voir les diapositives ici, ouvrez la page avec un serveur local (ex. extension « Live Server »), pas en double-cliquant sur le fichier HTML — le navigateur bloque alors la lecture du .pptx."
    );
    return;
  }

  if (!window.PptxViewJS || !window.PptxViewJS.PPTXViewer) {
    setError(
      "La visionneuse n’a pas pu se charger (connexion ou script bloqué). Vérifiez l’accès à Internet pour les bibliothèques."
    );
    return;
  }

  statusEl.textContent = "Chargement de la présentation…";
  statusEl.classList.remove("wimax-pptx-status--error");

  var viewer = new window.PptxViewJS.PPTXViewer({
    canvas: canvas,
    slideSizeMode: "fit",
  });

  function updateCounter() {
    var n = viewer.getSlideCount();
    var i = viewer.getCurrentSlideIndex();
    counterEl.textContent = n ? i + 1 + " / " + n : "";
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = n === 0 || i >= n - 1;
  }

  prevBtn.addEventListener("click", function () {
    viewer.previousSlide(canvas).then(updateCounter).catch(function () {});
  });
  nextBtn.addEventListener("click", function () {
    viewer.nextSlide(canvas).then(updateCounter).catch(function () {});
  });

  document.addEventListener("keydown", function (e) {
    if (toolbar.hidden) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      viewer.previousSlide(canvas).then(updateCounter).catch(function () {});
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      viewer.nextSlide(canvas).then(updateCounter).catch(function () {});
    }
  });

  fetch(pptPath)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    })
    .then(function (buf) {
      return viewer.loadFile(buf);
    })
    .then(function () {
      return viewer.render();
    })
    .then(function () {
      statusEl.textContent = "";
      canvasWrap.hidden = false;
      toolbar.hidden = false;
      updateCounter();
    })
    .catch(function () {
      setError(
        "Impossible de charger ou d’afficher ppt_WiMAX.pptx. Vérifiez qu’il est bien dans assets/supports/."
      );
    });
})();
