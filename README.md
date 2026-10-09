# omnifile

View any file in the browser, entirely on the client. No upload, no server,
no third-party viewer.

**[See it running: yakovmallah.github.io/omnifile](https://yakovmallah.github.io/omnifile/)**

> **Status: early.** Viewing is the focus; editing is deliberately parked.
> Nothing is published to npm yet. See the [plan](docs/PLAN.md).

## What it opens

| Kind | File types | Package | Notes |
|---|---|---|---|
| PDF | pdf | `@omnifile/pdf` | pdf.js; pages drawn as you scroll |
| Word | docx | `@omnifile/docx` | docx-preview; laid out as pages |
| Spreadsheets | xlsx, csv, tsv | `@omnifile/sheet` | Own reader and virtualised grid; values, dates and number formats |
| PowerPoint | pptx | `@omnifile/pptx` | PptxViewJS; text, shapes, images, tables, charts |
| Images | png, jpeg, gif, webp, avif, bmp, ico, svg | `@omnifile/image` | Native decoding. SVG is shown through `<img>`, so its scripts never run |
| Video, audio | mp4, webm, mov, mkv, mp3, wav, ogg, m4a, flac | `@omnifile/media` | Native player; codec support depends on the browser |
| Markdown | md | `@omnifile/markdown` | Rendered and sanitised, with a switch to the source |
| Code | js, ts, py, go, rs, json, yaml, css, ... | `@omnifile/code` | highlight.js colours, line numbers |
| HTML | html | `@omnifile/html` | Previewed with scripts off and the network blocked; switch to source |
| Email | eml | `@omnifile/email` | Headers, body, attachments; remote images blocked |
| ZIP | zip | `@omnifile/archive` | Folder tree like a file explorer; nothing is extracted |
| Fonts | ttf, otf, woff, woff2 | `@omnifile/font` | A specimen you can type into |
| Text | txt, log, anything text-like | `@omnifile/text` | Plain text with line numbers |
| Anything else | any | `@omnifile/hex` | Hex view of the raw bytes |

Known limits: Office files are drawn by JavaScript libraries, so complex
layouts can differ from the desktop apps. Spreadsheets show values, not cell
colours, fonts, charts or images. Legacy `.doc`/`.xls`/`.ppt`, OpenDocument,
EPUB, HEIC and TIFF are recognised but have no renderer yet (they open in the
hex view).

## Usage

```tsx
import { OmniFile } from '@omnifile/react';
import { allPlugins } from '@omnifile/all';
import { sandboxed } from '@omnifile/sandbox';

// Every format, each drawn inside an isolated frame.
const plugins = sandboxed(allPlugins());

export function Preview({ file }: { file: File }) {
  return <OmniFile source={file} plugins={plugins} style={{ height: 600 }} />;
}
```

`source` can be a URL, `File`, `Blob`, `ArrayBuffer` or `Uint8Array`. The
viewer fills its container, so give it a height.

Without React:

```ts
import { mount } from '@omnifile/core';

const viewer = mount(document.getElementById('viewer')!, { source: url, plugins });
viewer.destroy();
```

To ship fewer formats, list plugins yourself instead of `allPlugins()`. Each
plugin's code is downloaded only when a file of its format is opened. Later
plugins win, so order decides who handles a format they share:

```ts
import { text } from '@omnifile/text';
import { code } from '@omnifile/code';
import { pdf } from '@omnifile/pdf';

const plugins = [text(), code(), pdf()];
```

### How a file is identified

By content first: magic bytes, then the declared MIME type, then the file
extension. A PDF named `report.txt` opens as a PDF, and a text file named
`fake.pdf` opens as text.

## Isolation

Parsers have bugs, and a crafted file can turn one into code running in your
page. `sandboxed()` wraps plugins so that every file is parsed and drawn
inside an `<iframe sandbox="allow-scripts">`:

- The frame has an origin of its own, so code in it cannot read your page's
  DOM, cookies or storage.
- Its Content Security Policy allows no network connections, so there is
  nowhere to send a file to, and only scripts carrying a one-time nonce run,
  so markup injected through a file does not execute.
- It cannot open windows, start downloads, submit forms or navigate your page.
  Links and attachment downloads are passed to the host, which acts on them
  only during a real user click.
- Only the toolbar lives in your page. The two sides talk over a private
  `MessageChannel`.

What it does not cover:

- Bugs in the browser itself.
- Loading the file and identifying its type, which still happen in your page
  (a few hundred lines that only inspect bytes).
- Leaking by navigation: a compromised frame can still navigate *itself* to
  another site, with data in the URL. The browser offers no way to forbid
  that. The file's own contents are the most it could leak this way; your
  page's data stays out of reach.
- A page with a strict Content Security Policy of its own applies it to the
  frame too, and may need to allow inline scripts by nonce and `blob:`.

Each plugin ships a self-contained `dist/frame.js` for this, located with
`new URL('./frame.js', import.meta.url)`. Vite resolves that at build time
(this project's site is built that way); other bundlers are untested so far.
If yours does not, copy the files somewhere public and pass
`sandboxed(plugins, { frameUrls: { 'omnifile/pdf': '/frames/pdf.js', ... } })`.

Without `sandboxed()`, plugins run directly in your page. That is fine for
files you trust, and saves one frame per viewer.

### PDF worker (unsandboxed use)

`pdf()` works with no configuration by parsing on the main thread. To parse in
a Web Worker, pass the worker URL. With Vite:

```ts
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdf({ workerSrc });
```

The plugin uses pdf.js's *legacy* build on purpose: the modern build relies on
JavaScript features that only the newest browsers have. Inside the sandbox the
frame is already separate from your page, and no worker is needed.

### Theming

The shell is styled through CSS custom properties on `.omnifile`
(`--omnifile-bg`, `--omnifile-surface`, `--omnifile-text`, `--omnifile-accent`
and so on) and follows the system light or dark setting unless you pass
`theme="light"` or `theme="dark"`. The values are passed into the sandbox
frame as well.

## Writing a plugin

A plugin is a small descriptor plus a lazily loaded implementation.

```ts
import { definePlugin } from '@omnifile/core';

export const notes = () =>
  definePlugin({
    id: 'my/notes',
    formats: ['text'],
    load: () => import('./notes-impl').then((m) => m.implementation),
  });
```

The implementation has `parse` (bytes to a model) and `render` (model to DOM).
`render` may return a `zoom` control and a `views` control (for example
rendered and source); the toolbar shows them. A plugin that lists `'*'` as a
format is a fallback, used only when nothing else names the format. To make a
plugin sandboxable, give it a `frame` entry pointing at a self-contained
module whose default export returns the implementation.

## Development

```sh
pnpm install
pnpm dev         # playground at http://localhost:5173, sources with hot reload
pnpm test
pnpm typecheck
pnpm build
pnpm site        # builds the packages, then runs the project site
```

The playground runs plugins directly from source. The site uses the built
packages with the sandbox on, the way an installing app would.

## License

MIT. The plugins depend on third-party libraries under their own licences
(pdf.js and docx-preview: Apache-2.0; highlight.js: BSD-3-Clause; DOMPurify:
MPL-2.0 or Apache-2.0; the rest MIT or similar).
