# 4 Palabras Bíblicas ✝️

Juego web al estilo "4 imágenes, 1 palabra" con temática cristiana y bíblica. Se muestran 4 imágenes y hay que adivinar la palabra que las une.

🎮 **Juégalo en línea:** https://4fotos1palabrabiblica.parravergara.com/

## Características

- **Modo general** o **por libros**: elige uno o varios de los 66 libros de la Biblia y la partida usa solo palabras relacionadas con ellos.
- **Tres dificultades** (Fácil, Medio, Difícil): cambian la cantidad de letras de distracción, el costo de las pistas y las monedas.
- **Exportar a PowerPoint**: genera en el navegador un `.pptx` con las preguntas de la partida configurada (respuestas al final o tras cada pregunta).
- **Sin login ni base de datos**: el progreso se guarda solo en el navegador (`localStorage`).
- **Imágenes desde Wikipedia**: se cargan en vivo por cada nivel, usando la API pública de Wikipedia en español.

## Tecnología

HTML5, CSS y JavaScript sin frameworks, servido con nginx dentro de Docker. La exportación usa [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) (incluida en `site/vendor/`, licencia MIT).

## Ejecutar con Docker

```bash
docker compose up -d --build
```

El sitio queda en `http://localhost:8080`. Para cambiar el puerto, edita `ports` en `docker-compose.yml`.

## Estructura

```
site/
  index.html      página y menús
  style.css       estilos
  game.js         lógica del juego, modos, dificultad y exportación
  ppt.js          generador de PowerPoint
  puzzles.js      niveles y lista de libros
  vendor/         PptxGenJS
Dockerfile
docker-compose.yml
```

## Agregar niveles

Cada nivel está en `site/puzzles.js`:

```js
{ word: "JONAS", books: ["Jonás"], clues: [["Ballena", "🐋"], ["Nínive", "🏛️"], ...] }
```

- `word`: la palabra, en mayúsculas y sin tildes ni espacios.
- `books`: libros a los que pertenece (vacío = solo modo general).
- `clues`: 4 pistas `[título de un artículo de Wikipedia en español, emoji de respaldo]`. La imagen principal del artículo es la que se muestra.

## Licencia

El código está bajo licencia [MIT](LICENSE): puedes hacer un fork, modificarlo y usarlo libremente, incluso para tu propia iglesia o comunidad.

## Créditos

Imágenes de Wikipedia / Wikimedia Commons, cada una con su propia licencia. La librería PptxGenJS incluida en `site/vendor/` tiene su propia licencia MIT.

Créditos a mi Dios y también a mi bella y amada esposa Nicole Vergara.

Hecho con ❤️ en Cristo ✝️, un montón de líneas de código y un poquito de café ☕
