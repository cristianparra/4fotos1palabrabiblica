// Generador de presentaciones (PowerPoint) en el navegador, con PptxGenJS.
// buildPpt({ puzzles, difficulty, subtitle, answers, fileTag, fetchImages, onProgress })
//  - answers: "end" (lista de respuestas al final) | "each" (diapositiva de respuesta tras cada pregunta)
(() => {
  const C = { bg: "1F2A44", card: "2B3A5C", gold: "F5C542", text: "F4F1E8", ok: "3ECF8E" };
  const FONT = "Calibri";
  const BOX = 2.7, GAP = 0.2, GX = 0.6, GY = 1.2; // cuadrícula 2x2 de imágenes (pulgadas, slide 13.33 x 7.5)

  const HINT_TEXT = {
    easy: "Pista: se muestra la primera letra y cuántas letras tiene",
    medium: "Pista: se muestra cuántas letras tiene",
    hard: "Sin pistas de letras",
  };

  function toDataUrl(url) {
    return fetch(url)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then((b) => new Promise((res, rej) => {
        const f = new FileReader();
        f.onload = () => res(f.result);
        f.onerror = rej;
        f.readAsDataURL(b);
      }))
      .catch(() => null);
  }

  function naturalSize(dataUrl) {
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => res([i.naturalWidth, i.naturalHeight]);
      i.onerror = () => res(null);
      i.src = dataUrl;
    });
  }

  // Descarga las 4 imágenes de un nivel; si alguna falla queda null (se dibuja el emoji).
  async function loadImages(puzzle, fetchImages) {
    const urls = await fetchImages(puzzle);
    return Promise.all(urls.map(async (u) => {
      if (!u) return null;
      const data = await toDataUrl(u);
      const size = data && (await naturalSize(data));
      return size ? { data: data.replace(/^data:/, ""), w: size[0], h: size[1] } : null;
    }));
  }

  function blanks(word, difficulty) {
    if (difficulty === "hard") return "";
    return word.split("").map((ch, i) => (difficulty === "easy" && i === 0 ? ch : "_")).join(" ");
  }

  function addImageGrid(slide, puzzle, imgs, box, gx, gy, gap) {
    puzzle.clues.forEach(([, emoji], k) => {
      const x = gx + (k % 2) * (box + gap);
      const y = gy + Math.floor(k / 2) * (box + gap);
      slide.addShape("roundRect", { x, y, w: box, h: box, fill: { color: C.card }, rectRadius: 0.1 });
      const im = imgs[k];
      if (im) {
        const s = Math.min(box / im.w, box / im.h);
        const w = im.w * s, h = im.h * s;
        slide.addImage({ data: im.data, x: x + (box - w) / 2, y: y + (box - h) / 2, w, h });
      } else {
        slide.addText(emoji, { x, y, w: box, h: box, align: "center", valign: "middle", fontSize: 60 });
      }
    });
  }

  function questionSlide(pptx, puzzle, imgs, n, total, opts, reveal) {
    const slide = pptx.addSlide();
    slide.background = { color: C.bg };
    slide.addText(`Pregunta ${n} de ${total}`, { x: 0.6, y: 0.3, w: 8, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: C.gold });
    addImageGrid(slide, puzzle, imgs, BOX, GX, GY, GAP);

    const px = 6.9, pw = 5.9;
    if (reveal) {
      slide.addText("Respuesta", { x: px, y: 2.2, w: pw, h: 0.6, fontFace: FONT, fontSize: 24, color: C.text, align: "center" });
      slide.addText(puzzle.word, { x: px, y: 2.9, w: pw, h: 1.3, fontFace: FONT, fontSize: 60, bold: true, color: C.ok, align: "center", charSpacing: 6 });
    } else {
      slide.addText("¿Qué palabra une estas 4 imágenes?", { x: px, y: 1.6, w: pw, h: 1.2, fontFace: FONT, fontSize: 28, color: C.text, align: "center" });
      const b = blanks(puzzle.word, opts.difficulty);
      if (b) slide.addText(b, { x: px, y: 3.0, w: pw, h: 1.2, fontFace: "Consolas", fontSize: b.length > 22 ? 28 : 40, bold: true, color: C.gold, align: "center" });
      slide.addText(HINT_TEXT[opts.difficulty], { x: px, y: 4.4, w: pw, h: 0.6, fontFace: FONT, fontSize: 16, italic: true, color: C.text, align: "center" });
    }
    if (puzzle.books && puzzle.books.length && opts.showBooks) {
      slide.addText("📚 " + puzzle.books.join(" · "), { x: px, y: 5.6, w: pw, h: 0.6, fontFace: FONT, fontSize: 14, color: C.text, align: "center" });
    }
    slide.addText("4 Palabras Bíblicas", { x: 0.6, y: 7.0, w: 6, h: 0.3, fontFace: FONT, fontSize: 11, color: C.text, transparency: 40 });
    slide.addNotes(`Respuesta: ${puzzle.word}`);
  }

  function titleSlide(pptx, opts, total) {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    s.addText("4 Palabras Bíblicas", { x: 0.8, y: 2.0, w: 11.7, h: 1.2, fontFace: FONT, fontSize: 54, bold: true, color: C.gold, align: "center" });
    s.addText(opts.subtitle, { x: 0.8, y: 3.4, w: 11.7, h: 0.8, fontFace: FONT, fontSize: 26, color: C.text, align: "center" });
    s.addText(`${total} preguntas · Dificultad ${opts.difficultyLabel}`, { x: 0.8, y: 4.3, w: 11.7, h: 0.6, fontFace: FONT, fontSize: 20, color: C.text, align: "center" });
    s.addText("Adivina la palabra que une las 4 imágenes", { x: 0.8, y: 5.1, w: 11.7, h: 0.6, fontFace: FONT, fontSize: 18, italic: true, color: C.text, align: "center" });
  }

  function answersSlides(pptx, puzzles) {
    const PER = 12;
    for (let p = 0; p < puzzles.length; p += PER) {
      const s = pptx.addSlide();
      s.background = { color: C.bg };
      s.addText("Respuestas", { x: 0.6, y: 0.4, w: 8, h: 0.8, fontFace: FONT, fontSize: 32, bold: true, color: C.gold });
      const chunk = puzzles.slice(p, p + PER);
      [chunk.slice(0, 6), chunk.slice(6)].forEach((col, ci) => {
        if (!col.length) return;
        const runs = col.map((pz, i) => ({
          text: `${p + ci * 6 + i + 1}. ${pz.word}`,
          options: { breakLine: true, fontFace: FONT, fontSize: 26, color: C.text },
        }));
        s.addText(runs, { x: 0.8 + ci * 6.2, y: 1.5, w: 5.8, h: 5, valign: "top", paraSpaceAfter: 10 });
      });
    }
  }

  async function buildPpt(opts) {
    const { puzzles, fetchImages, onProgress } = opts;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = "4 Palabras Bíblicas";
    titleSlide(pptx, opts, puzzles.length);

    for (let i = 0; i < puzzles.length; i++) {
      if (onProgress) onProgress(i, puzzles.length);
      const imgs = await loadImages(puzzles[i], fetchImages);
      questionSlide(pptx, puzzles[i], imgs, i + 1, puzzles.length, opts, false);
      if (opts.answers === "each") questionSlide(pptx, puzzles[i], imgs, i + 1, puzzles.length, opts, true);
    }
    if (opts.answers === "end") answersSlides(pptx, puzzles);

    if (onProgress) onProgress(puzzles.length, puzzles.length);
    await pptx.writeFile({ fileName: `4-palabras-biblicas-${opts.fileTag}.pptx` });
  }

  window.buildPpt = buildPpt;
})();
