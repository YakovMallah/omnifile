# omnifile

View any file in the browser, entirely on the client. No upload, no server,
no third-party viewer.

**[See it running: yakovmallah.github.io/omnifile](https://yakovmallah.github.io/omnifile/)**

> **Status: early.** Phase 1 of the [plan](docs/PLAN.md) is in place. Nothing
> is published to npm yet.

## What works today

| Format | Package | Notes |
|---|---|---|
| PDF | `@omnifile/pdf` | pdf.js, pages rendered lazily as you scroll, zoom |
| PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, SVG | `@omnifile/image` | Native decoding, zoom. SVG is shown through `<img>`, so its scripts never run |
| MP4, WebM, MOV, MKV, MP3, WAV, OGG, M4A, FLAC | `@omnifile/media` | Native player; codec support depends on the browser |
| Text, Markdown, JSON, CSV, HTML, XML, YAML and source code | `@omnifile/text` | Shown as plain text with line numbers. HTML and Markdown are shown as source |

Word, Excel and PowerPoint files are recognised but have no renderer yet; they
show a "no preview" state with a download button. See the plan for what comes
next.

## Usage

```tsx
import { OmniFile } from '@omnifile/react';
import { pdf } from '@omnifile/pdf';
import { image } from '@omnifile/image';
import { text } from '@omnifile/text';

const plugins = [pdf(), image(), text()];

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

### How a file is identified

By content first: magic bytes, then the declared MIME type, then the file
extension. A PDF named `report.txt` opens as a PDF, and a text file named
`fake.pdf` opens as text.

### PDF worker

`pdf()` works with no configuration by parsing on the main thread. To parse in
a Web Worker, pass the worker URL. With Vite:

```ts
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdf({ workerSrc });
```

The plugin uses pdf.js's *legacy* build on purpose: the modern build relies on
JavaScript features that only the newest browsers have.

### Theming

The shell is styled through CSS custom properties on `.omnifile`
(`--omnifile-bg`, `--omnifile-surface`, `--omnifile-text`, `--omnifile-accent`
and so on) and follows the system light or dark setting unless you pass
`theme="light"` or `theme="dark"`.

## Writing a plugin

A plugin is a small descriptor plus a lazily loaded implementation, so a
format's code is only downloaded when a file of that format is opened.

```ts
import { definePlugin } from '@omnifile/core';

export const hex = () =>
  definePlugin({
    id: 'my/hex',
    formats: ['binary'],
    load: () => import('./hex-impl').then((m) => m.implementation),
  });
```

The implementation has `parse` (bytes to a model) and `render` (model to DOM).
Later plugins in the list win, so you can override a built-in renderer.

## Development

```sh
pnpm install
pnpm dev         # playground at http://localhost:5173
pnpm site        # the project site, deployed to GitHub Pages from main
pnpm test
pnpm typecheck
pnpm build
```

## License

MIT
