# omnifile plan

A React package (with a framework-agnostic core) for viewing any file on the
client, designed so editing can be added later without a rewrite.

## Why

`react-doc-viewer` is no longer developed, and it opens Office files by
sending them to Microsoft's online viewer. The goal here is that everything
happens in the browser.

## Architecture

- **Core** (`@omnifile/core`): takes a URL, `File`, `Blob` or `ArrayBuffer`,
  identifies it (magic bytes, then MIME type, then extension) and picks a
  plugin. It also owns the shell: toolbar, loading and error states, and the
  "no preview, download instead" fallback. It has no framework dependency.
- **Framework wrappers** (`@omnifile/react`): thin layers over `mount()`.
- **Plugins** (`@omnifile/pdf`, `@omnifile/image`, ...): one package per
  format family. Each exports a small descriptor; the real code is behind a
  dynamic import, so nobody pays for a format they do not open.

### Decisions that keep editing possible

- **Parse to a model, not straight to DOM.** Every plugin goes
  file → model → DOM. Editing adds model → file.
- **Capabilities are separate.** `parse` and `render` are required;
  `serialize` is optional and reserved for editing. A format can ship
  view-only and gain editing later without an API break.
- **Original bytes are kept and never mutated.** Round-tripping Office files
  loses whatever the model does not understand, so an editor should patch the
  original file rather than regenerate it.
- **The shell has a `mode`.** `view` today; `edit` falls back to view when a
  plugin cannot edit.

Editing is parked: the priority is viewing as many formats as possible.

### Safety

- File contents are never interpreted as markup: text is set with
  `textContent`, SVG is shown through `<img>`, generated HTML (Markdown,
  email) goes through DOMPurify.
- HTML files and email bodies are shown in sandboxed frames with scripts off
  and the network blocked.
- **Sandbox mode** (`@omnifile/sandbox`): `sandboxed(plugins)` runs each
  plugin's parse and render inside `<iframe sandbox="allow-scripts">` with an
  origin of its own and a Content Security Policy that allows no connections
  and only nonce-bearing scripts. The toolbar stays in the host; the two talk
  over a `MessageChannel`. Each plugin ships a self-contained `dist/frame.js`
  that the host fetches as text and the frame imports from a blob, because a
  frame with an opaque origin cannot import the host's script files without
  CORS headers.
- Known gaps: source loading and format detection run in the host; a
  compromised frame can still navigate itself (the platform cannot forbid
  it); a host page with a strict CSP must allow the frame.

## Format strategy

| Format | Approach | Status |
|---|---|---|
| PDF | pdf.js (legacy build) | Done (no text layer or search yet) |
| Images | Native elements | Done |
| Video, audio | Native elements | Done (not yet exercised with real media files) |
| Text | Plain text | Done |
| Code | highlight.js | Done |
| Markdown | marked + DOMPurify, rendered/source switch | Done |
| HTML | Sandboxed frame, preview/source switch | Done |
| DOCX | docx-preview | Done |
| XLSX, CSV, TSV | Own reader (fflate + DOMParser) and virtualised grid | Done (values and number formats; no cell styling, charts or images) |
| PPTX | PptxViewJS (canvas) | Done (no animations or video) |
| Email (.eml) | postal-mime | Done |
| ZIP | Own central-directory reader, folder tree | Done (browse only; opening a file inside is not built) |
| Fonts | FontFace API | Done |
| Anything else | Hex view fallback | Done |
| HEIC, TIFF | Decoders | Planned. libheif-js is LGPL-3.0, so HEIC needs a licence decision |
| ODT, ODS, ODP, EPUB, RTF | Own readers or libraries | Planned; recognised today |
| Legacy DOC, XLS, PPT, MSG | LibreOffice compiled to WASM, opt-in | Planned |
| Notebooks (.ipynb), 3D models, PSD | To evaluate | Ideas |

### Library decisions (checked on npm, 2026-10-09)

- **docx-preview** 0.4.1: released September 2026, Apache-2.0. Adopted.
- **SheetJS (`xlsx` on npm)**: last npm release was 2022; current versions
  are only distributed from its own CDN. Not adopted; the spreadsheet reader
  is our own, which also keeps the plugin small (26 KB as a frame bundle).
- **PptxViewJS** 1.1.9: released March 2026, MIT. Adopted, with caveats: it
  needs JSZip and Chart.js, writes globals, and falls back to loading JSZip
  from a CDN unless it finds one (the plugin hands it the bundled copy so
  that never happens). In sandbox mode all of this is confined to the frame.
  Worth revisiting if it stalls; a renderer of our own is the alternative.
- **highlight.js**, **marked**, **DOMPurify**, **postal-mime**, **fflate**:
  all released in 2026.
- Not adopted: heic2any (2023), epub.js (2022), rtf.js (2022), utif (2019).

## Phases

1. Core, detection, plugin API, shell, PDF, images, media, text. **Done.**
2. Word, spreadsheets, PowerPoint, Markdown, code, HTML, email, ZIP, fonts,
   hex fallback, sandbox mode. **Done.**
3. More formats: HEIC/TIFF, OpenDocument, EPUB, RTF, notebooks; optional
   LibreOffice WASM plugin for legacy Office.
4. Depth: PDF text layer and search, page navigation, spreadsheet styling,
   find-in-file, accessibility polish.
5. Editing. Parked until viewing is broad and solid.

### Open items

- Before publishing: check that third-party licence notices survive in the
  minified `frame.js` bundles, and register the `omnifile` npm organisation.
- XLSX and Markdown parse on the frame's (or page's) main thread; very large
  files will stall it. Move to workers or incremental parsing.
- Text files over 2 million characters are truncated; needs virtualisation.
- DOM-level tests. Unit tests cover detection, plugin selection, CSV, number
  formats, the ZIP reader, font metadata and the sandbox's policy; rendering
  is checked by hand in Chromium, in both direct and sandboxed modes. An
  automated browser suite in CI is the next step.
- Toolbar extension points for plugins beyond zoom and views.
- Sandbox: a prebuilt single frame page for hosts whose CSP forbids `srcdoc`
  scripts; fonts from the host page are not available inside the frame.

## LibreOffice WebAssembly spike (2026-10-09)

Tried `@matbee/libreoffice-converter` 2.7.2 (MPL-2.0, 37 releases since
December 2025), a prebuilt headless LibreOffice, converting files to PDF.

- **It works.** A legacy `.doc`, a `.pptx` and an `.xlsx` converted to PDF in
  Node and in headless Chromium. In the browser, with files served locally:
  about 2.5 s to start, 1.3 s for the first conversion, 0.2 s for a repeat.
- **Size.** 147 MB of WebAssembly plus 100 MB of data; about 88 MB with fast
  gzip. Opt-in only, and needs caching and a progress display.
- **Host requirement.** The page must be cross-origin isolated
  (`Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`). Without those headers it
  fails to start. GitHub Pages cannot set headers, so the project site would
  need a service-worker workaround to demo it.
- **Sandbox.** It runs inside our sandbox frame (opaque origin, no network)
  when the frame has `allow="cross-origin-isolated"`, with the files handed in
  as blobs. Two costs: the frame's policy must allow `'unsafe-eval'` and
  `'wasm-unsafe-eval'` for this plugin, and 3 of 8 sandboxed runs hung while
  loading the document (0 of 5 unsandboxed runs did). That hang is unexplained
  and has to be solved before shipping.
- Only tested in Chromium. Fidelity was checked on our small generated
  samples, not on real-world documents.

Not yet done: the plugin itself, the hang, Firefox and Safari, brotli sizes,
fonts beyond the bundled Latin/Arabic/Hebrew set.

## What editing will cost

- Text, code, Markdown, CSV: easy.
- Image crop/rotate/annotate, PDF annotations and form filling: moderate.
- Spreadsheets: hard, because of the formula engine.
- DOCX and PPTX: very hard; this is building a word processor.

## Naming

Packages are `@omnifile/*`. On 2026-10-09 the unscoped `omnifile` name and
`@omnifile/core` were unclaimed on npm, but the scope has not been registered
yet; create the `omnifile` organisation on npm to secure it. The GitHub
repository was first called `filekit`, a name that is taken on npm, and was
renamed to `omnifile` to match.
