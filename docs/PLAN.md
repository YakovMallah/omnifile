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

### Safety

- File contents are never interpreted as markup: text is set with
  `textContent`, SVG is shown through `<img>`.
- Planned: HTML preview in a sandboxed iframe, sanitising of any HTML a
  renderer generates.

## Format strategy

| Format | Approach | Difficulty | Status |
|---|---|---|---|
| PDF | pdf.js | Easy | Done (no text layer or search yet) |
| Images | Native elements | Easy | Done |
| HEIC, TIFF | WASM/JS decoders | Easy | Planned |
| Video, audio | Native elements | Easy | Done |
| Text, code, JSON, CSV | Plain text | Easy | Done (no highlighting yet) |
| Markdown | Rendered view | Easy | Planned (shown as source today) |
| DOCX | docx-preview (layout) or mammoth (clean HTML) | Medium | Phase 2 |
| XLSX, XLS, CSV grid | SheetJS + our own virtualised grid | Medium | Phase 2 |
| PPTX | No solid library; our own renderer | Hard | Phase 3 |
| Legacy DOC, PPT | LibreOffice compiled to WASM | Hard | Phase 4 |

The library picks for phase 2 onward are from memory. Check each one's
maintenance status and licence before committing to it.

### Office fidelity

1. **Light JS libraries**: small and fast, imperfect on complex layouts, weak
   on PPTX and legacy formats.
2. **LibreOffice WASM**: near-desktop fidelity and real editing for every
   Office format, at the cost of a download in the tens of megabytes.

The plan is to build on 1 and offer 2 as an optional heavy plugin. It is also
the realistic route to full Office editing.

## Phases

1. **Core, detection, plugin API, shell, PDF, images, media, text.** Done.
2. DOCX and spreadsheets.
3. PPTX.
4. Optional LibreOffice WASM plugin, search, theming and accessibility polish.

### Left over from phase 1

- PDF text layer (selection, search), page navigation in the toolbar,
  password-protected PDFs.
- Syntax highlighting and rendered Markdown.
- Virtualised rendering for very large text files (currently truncated at
  2 million characters).
- Parsing in Web Workers for formats that need it. Only PDF parses off the
  main thread today, and only when `workerSrc` is given.
- Toolbar extension points for plugins.
- Tests for the DOM side (mount, plugins). Today's unit tests cover detection
  and plugin selection; rendering was checked by hand in Chromium, and the
  media plugin has not been exercised with a real video or audio file.

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
