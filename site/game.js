(() => {
  // Reglas por dificultad:
  // extra/min = tamaño del banco de letras (palabra + distractores), hint = costo de pista,
  // win = monedas por acierto, penalty = monedas que se pierden al fallar, free = letras regaladas al inicio.
  const DIFFICULTY = {
    easy:   { label: "Fácil",   min: 8,  extra: 2, hint: 3,  win: 3, penalty: 0, free: 1, info: "Pocas letras de más, pistas baratas y la primera letra gratis." },
    medium: { label: "Medio",   min: 12, extra: 3, hint: 5,  win: 4, penalty: 0, free: 0, info: "Equilibrado: 12 letras o más y pistas a 5 monedas." },
    hard:   { label: "Difícil", min: 18, extra: 8, hint: 10, win: 6, penalty: 1, free: 0, info: "Muchas letras de más, pistas a 10 monedas y cada fallo cuesta 1 moneda." },
  };
  const STORE_KEY = "cuatro-palabras-v1";
  const API = "https://es.wikipedia.org/w/api.php";

  const $ = (id) => document.getElementById(id);
  const el = {
    level: $("level"), coins: $("coins"), mode: $("mode"), images: $("images"), slots: $("slots"), pool: $("pool"),
    hint: $("hint"), skip: $("skip"), menuBtn: $("menu-btn"), msg: $("msg"),
    overlay: $("overlay"), ovTitle: $("ov-title"), ovWord: $("ov-word"), ovText: $("ov-text"), ovBtn: $("ov-btn"),
    menu: $("menu"), books: $("books"), booksInfo: $("books-info"), generalCount: $("general-count"),
    modeGeneral: $("mode-general"), modeBooks: $("mode-books"),
    difficulty: $("difficulty"), diffInfo: $("diff-info"), hintCost: $("hint-cost"),
    pptCount: $("ppt-count"), pptAnswers: $("ppt-answers"), pptGeneral: $("ppt-general"),
    pptBooks: $("ppt-books"), pptStatus: $("ppt-status"),
    menuBack: $("menu-back"), resetAll: $("reset-all"),
  };

  // ---------- Estado persistente (localStorage, sin login) ----------
  // mode: null (aún no eligió) | "general" | "books"
  // solved: niveles resueltos en modo general; bookSolved: los de la partida actual por libros.
  let state = { coins: 10, solved: [], pointer: 0, mode: null, books: [], bookSolved: [], difficulty: "medium" };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) state = { ...state, ...saved };
  } catch (_) {}
  if (!DIFFICULTY[state.difficulty]) state.difficulty = "medium";
  const cfg = () => DIFFICULTY[state.difficulty];
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {} };

  // ---------- Imágenes desde Wikipedia ----------
  const imageCache = new Map(); // word -> Promise<Array<url|null>>

  function fetchImages(puzzle) {
    if (imageCache.has(puzzle.word)) return imageCache.get(puzzle.word);
    const titles = puzzle.clues.map((c) => c[0]);
    const url = `${API}?action=query&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json&origin=*&titles=${encodeURIComponent(titles.join("|"))}`;
    const p = fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const q = data.query || {};
        // Los títulos pueden normalizarse o redirigirse: seguimos esa cadena.
        const alias = new Map();
        (q.normalized || []).forEach((n) => alias.set(n.from, n.to));
        (q.redirects || []).forEach((n) => alias.set(n.from, n.to));
        const byTitle = new Map(Object.values(q.pages || {}).map((pg) => [pg.title, pg.thumbnail && pg.thumbnail.source]));
        return titles.map((t) => {
          let cur = t;
          for (let i = 0; i < 3 && alias.has(cur); i++) cur = alias.get(cur);
          return byTitle.get(cur) || null;
        });
      })
      .catch(() => titles.map(() => null));
    imageCache.set(puzzle.word, p);
    // Precarga los archivos de imagen en el navegador.
    p.then((urls) => urls.forEach((u) => { if (u) new Image().src = u; }));
    return p;
  }

  // ---------- Selección de nivel según el modo ----------
  const inBooks = () => state.mode === "books";
  const solvedList = () => (inBooks() ? state.bookSolved : state.solved);
  function pool() {
    if (inBooks()) return PUZZLES.filter((p) => p.books.some((b) => state.books.includes(b)));
    return PUZZLES;
  }
  function unsolved() { return pool().filter((p) => !solvedList().includes(p.word)); }
  function current() {
    const list = unsolved();
    return list.length ? list[state.pointer % list.length] : null;
  }

  // ---------- Menú de modos ----------
  let selected = new Set(state.books);

  function bookCount(name) { return PUZZLES.filter((p) => p.books.includes(name)).length; }
  function selectedCount() { return PUZZLES.filter((p) => p.books.some((b) => selected.has(b))).length; }

  function renderDifficulty() {
    el.difficulty.innerHTML = "";
    Object.entries(DIFFICULTY).forEach(([key, d]) => {
      const c = document.createElement("button");
      c.className = "chip" + (state.difficulty === key ? " on" : "");
      c.textContent = d.label;
      c.onclick = () => { state.difficulty = key; save(); renderDifficulty(); };
      el.difficulty.appendChild(c);
    });
    el.diffInfo.textContent = cfg().info;
  }

  function renderMenu() {
    renderDifficulty();
    el.generalCount.textContent = `(${PUZZLES.length} niveles)`;
    el.books.innerHTML = "";
    [["AT", "Antiguo Testamento"], ["NT", "Nuevo Testamento"]].forEach(([t, label]) => {
      const names = BOOKS.filter(([, tt]) => tt === t).map(([n]) => n);
      const h = document.createElement("div");
      h.className = "testament";
      h.textContent = label;
      const chips = document.createElement("div");
      chips.className = "chips";
      names.forEach((n) => {
        const c = document.createElement("button");
        c.className = "chip" + (selected.has(n) ? " on" : "");
        c.innerHTML = `${n} <small>${bookCount(n)}</small>`;
        c.onclick = () => { selected.has(n) ? selected.delete(n) : selected.add(n); renderMenu(); };
        chips.appendChild(c);
      });
      el.books.append(h, chips);
    });
    const n = selectedCount();
    el.modeBooks.disabled = n === 0;
    el.pptBooks.disabled = n === 0 || exporting;
    el.booksInfo.textContent = n ? `${n} nivel${n === 1 ? "" : "es"} con los libros elegidos` : "Elige al menos un libro";
  }

  function showMenu() {
    el.overlay.hidden = true;
    selected = new Set(state.books);
    el.menuBack.hidden = !(state.mode && puzzle); // solo si hay una partida en curso
    renderMenu();
    el.menu.hidden = false;
  }

  el.menuBack.onclick = () => { el.menu.hidden = true; };

  // Borra todo lo guardado (niveles, monedas, modo y libros). La dificultad elegida se conserva.
  el.resetAll.onclick = () => {
    if (!confirm("¿Cerrar la partida y empezar de cero? Se borrarán tus niveles resueltos y tus monedas.")) return;
    state = { coins: 10, solved: [], pointer: 0, mode: null, books: [], bookSolved: [], difficulty: state.difficulty };
    save();
    puzzle = null;
    el.pptStatus.textContent = "";
    showMenu();
  };

  // ---------- Exportar partida a PowerPoint ----------
  let exporting = false;

  async function exportPpt(list, subtitle, fileTag) {
    if (exporting) return;
    const wanted = Number(el.pptCount.value);
    const chosen = shuffle(list.slice()).slice(0, wanted > 0 ? wanted : list.length);
    exporting = true;
    el.pptGeneral.disabled = true;
    el.pptBooks.disabled = true;
    try {
      await window.buildPpt({
        puzzles: chosen,
        difficulty: state.difficulty,
        difficultyLabel: cfg().label,
        subtitle,
        answers: el.pptAnswers.value,
        showBooks: fileTag.startsWith("libros"),
        fileTag: `${fileTag}-${state.difficulty}`,
        fetchImages,
        onProgress: (i, n) => {
          el.pptStatus.textContent = i < n ? `Preparando imágenes… ${i + 1}/${n}` : "Creando archivo…";
        },
      });
      el.pptStatus.textContent = `✅ Listo: ${chosen.length} preguntas descargadas`;
    } catch (e) {
      console.error(e);
      el.pptStatus.textContent = `No se pudo generar la presentación (${e && e.message ? e.message : e}). Intenta de nuevo.`;
    } finally {
      exporting = false;
      el.pptGeneral.disabled = false;
      renderMenu();
    }
  }

  el.pptGeneral.onclick = () => exportPpt(PUZZLES, "Modo general", "general");
  el.pptBooks.onclick = () => {
    const names = BOOKS.map(([n]) => n).filter((n) => selected.has(n));
    const list = PUZZLES.filter((p) => p.books.some((b) => selected.has(b)));
    exportPpt(list, "Libros: " + names.join(", "), "libros");
  };

  el.modeGeneral.onclick = () => {
    state.mode = "general"; state.pointer = 0; save();
    el.menu.hidden = true; startLevel();
  };
  el.modeBooks.onclick = () => {
    // Cada vez que se elige "por libros" comienza una partida nueva.
    state.mode = "books";
    state.books = BOOKS.map(([n]) => n).filter((n) => selected.has(n));
    state.bookSolved = []; state.pointer = 0; save();
    el.menu.hidden = true; startLevel();
  };
  el.menuBtn.onclick = showMenu;

  // ---------- Juego ----------
  let puzzle, tiles, slots, hinted, busy;
  const rand = (n) => Math.floor(Math.random() * n);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function startLevel() {
    puzzle = current();
    if (!puzzle) return showFinished();
    busy = false;
    el.msg.textContent = "";
    el.mode.textContent = (inBooks() ? `📚 ${state.books.join(" · ")} · ` : "") + cfg().label;
    el.level.textContent = `${solvedList().length + 1}/${pool().length}`;
    el.coins.textContent = state.coins;
    el.hintCost.textContent = cfg().hint;

    // Letras: las de la palabra + distractores según la dificultad.
    const total = Math.max(cfg().min, puzzle.word.length + cfg().extra);
    const letters = puzzle.word.split("");
    const abc = "ABCDEFGHIJLMNOPQRSTUVZ";
    while (letters.length < total) letters.push(abc[rand(abc.length)]);
    tiles = shuffle(letters).map((ch) => ({ ch, used: false }));
    slots = Array(puzzle.word.length).fill(null); // índice de tile
    hinted = Array(puzzle.word.length).fill(false);
    // Letras regaladas al inicio (modo fácil).
    for (let i = 0; i < Math.min(cfg().free, puzzle.word.length - 1); i++) {
      const ti = tiles.findIndex((t) => !t.used && t.ch === puzzle.word[i]);
      tiles[ti].used = true; slots[i] = ti; hinted[i] = true;
    }

    renderImages();
    render();

    // Precarga el siguiente nivel.
    const list = unsolved();
    if (list.length > 1) fetchImages(list[(state.pointer + 1) % list.length]);
  }

  function renderImages() {
    el.images.innerHTML = "";
    const boxes = puzzle.clues.map(([title, emoji]) => {
      const box = document.createElement("div");
      box.className = "img loading";
      const fb = document.createElement("span");
      fb.className = "fallback";
      fb.textContent = "";
      box.appendChild(fb);
      el.images.appendChild(box);
      return { box, fb, emoji, title };
    });
    const mine = puzzle;
    fetchImages(puzzle).then((urls) => {
      if (mine !== puzzle) return; // el jugador ya cambió de nivel
      boxes.forEach((b, i) => {
        const url = urls[i];
        if (!url) { b.box.classList.remove("loading"); b.fb.textContent = b.emoji; return; }
        const img = new Image();
        img.alt = "";
        img.onload = () => { b.box.classList.remove("loading"); img.classList.add("loaded"); };
        img.onerror = () => { img.remove(); b.box.classList.remove("loading"); b.fb.textContent = b.emoji; };
        img.src = url;
        b.box.appendChild(img);
      });
    });
  }

  function render() {
    el.slots.innerHTML = "";
    slots.forEach((ti, i) => {
      const b = document.createElement("button");
      b.className = "tile slot" + (ti !== null ? " filled" : "") + (hinted[i] ? " hinted" : "");
      b.textContent = ti !== null ? tiles[ti].ch : "";
      b.onclick = () => removeAt(i);
      el.slots.appendChild(b);
    });
    el.pool.innerHTML = "";
    tiles.forEach((t, i) => {
      const b = document.createElement("button");
      b.className = "tile" + (t.used ? " used" : "");
      b.textContent = t.ch;
      b.onclick = () => place(i);
      el.pool.appendChild(b);
    });
    el.hint.disabled = state.coins < cfg().hint;
  }

  function place(ti) {
    if (busy || tiles[ti].used) return;
    const i = slots.indexOf(null);
    if (i === -1) return;
    slots[i] = ti;
    tiles[ti].used = true;
    render();
    if (!slots.includes(null)) check();
  }

  function removeAt(i) {
    if (busy || hinted[i] || slots[i] === null) return;
    tiles[slots[i]].used = false;
    slots[i] = null;
    render();
  }

  function check() {
    const attempt = slots.map((ti) => tiles[ti].ch).join("");
    if (attempt === puzzle.word) return win();
    el.slots.classList.add("bad");
    setTimeout(() => el.slots.classList.remove("bad"), 450);
    const pen = Math.min(cfg().penalty, state.coins);
    if (pen) { state.coins -= pen; el.coins.textContent = state.coins; save(); render(); }
    el.msg.textContent = "Casi... intenta de nuevo" + (pen ? ` (-${pen}🪙)` : "");
  }

  function win() {
    busy = true;
    el.slots.classList.add("ok");
    solvedList().push(puzzle.word);
    state.coins += cfg().win;
    state.pointer = 0;
    save();
    setTimeout(() => {
      el.slots.classList.remove("ok");
      el.ovTitle.textContent = "¡Correcto! 🎉";
      el.ovWord.textContent = puzzle.word;
      el.ovText.textContent = `+${cfg().win} monedas`;
      el.ovBtn.textContent = "Siguiente";
      el.ovBtn.onclick = () => { el.overlay.hidden = true; startLevel(); };
      el.overlay.hidden = false;
      el.ovBtn.focus();
    }, 600);
  }

  function showFinished() {
    el.coins.textContent = state.coins;
    el.ovWord.textContent = "";
    if (inBooks()) {
      el.ovTitle.textContent = "¡Completaste los libros elegidos! 🙌";
      el.ovText.textContent = `Resolviste ${state.bookSolved.length} niveles.`;
      el.ovBtn.textContent = "Elegir otros libros";
      el.ovBtn.onclick = showMenu;
    } else {
      el.ovTitle.textContent = "¡Terminaste todos los niveles! 🙌";
      el.ovText.textContent = "Pronto habrá más. ¿Quieres volver a empezar?";
      el.ovBtn.textContent = "Reiniciar";
      el.ovBtn.onclick = () => {
        state.solved = []; state.pointer = 0; save();
        el.overlay.hidden = true; startLevel();
      };
    }
    el.overlay.hidden = false;
  }

  el.hint.onclick = () => {
    if (busy || state.coins < cfg().hint) return;
    // Libera todo lo que no sea una pista y revela la siguiente letra.
    slots.forEach((ti, i) => { if (ti !== null && !hinted[i]) { tiles[ti].used = false; slots[i] = null; } });
    const i = hinted.indexOf(false);
    if (i === -1) return;
    const ti = tiles.findIndex((t) => !t.used && t.ch === puzzle.word[i]);
    if (ti === -1) return;
    tiles[ti].used = true;
    slots[i] = ti;
    hinted[i] = true;
    state.coins -= cfg().hint;
    el.coins.textContent = state.coins;
    save();
    render();
    if (!slots.includes(null)) check();
  };

  el.skip.onclick = () => {
    if (busy) return;
    state.pointer++;
    save();
    startLevel();
  };

  // Primera visita: elegir modo. Si ya había partida, se retoma.
  if (!state.mode || (inBooks() && !pool().length)) showMenu();
  else startLevel();
})();
