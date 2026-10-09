import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { mount } from '@omnifile/core';
import { OmniFile, type LoadedFile, type OmniSource } from '@omnifile/react';
import { Code } from './Code';
import { explain } from './explain';
import { plugins, REPO_URL, sampleUrl } from './plugins';
import { PROBE_SOURCE, probePlugins } from './probe';

export function App() {
  return (
    <>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="omnifile, back to top">
          <span className="wordmark-ring" aria-hidden="true" />
          omnifile
        </a>
        <nav aria-label="Sections">
          <a href="#usage">Usage</a>
          <a href="#formats">Formats</a>
          <a href="#isolation">Isolation</a>
          <a href="#design">Design</a>
          <a href="#install">Install</a>
          <a href={REPO_URL}>GitHub</a>
        </nav>
      </header>
      <main id="top">
        <Hero />
        <Usage />
        <Formats />
        <Isolation />
        <Design />
        <Install />
      </main>
      <footer className="footer">
        <span>omnifile is open source under the MIT licence.</span>
        <a href={REPO_URL}>Source on GitHub</a>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------------ hero */

interface Sample {
  label: string;
  file: string;
  /** Present the file under a different name than the one it is stored as. */
  name?: string;
}

const SAMPLES: Sample[] = [
  { label: 'PDF', file: 'sample.pdf' },
  { label: 'Word', file: 'sample.docx' },
  { label: 'Excel', file: 'sample.xlsx' },
  { label: 'PowerPoint', file: 'sample.pptx' },
  { label: 'CSV', file: 'sample.csv' },
  { label: 'Markdown', file: 'sample.md' },
  { label: 'Python', file: 'sample.py' },
  { label: 'HTML', file: 'sample.html' },
  { label: 'Image', file: 'sample.png' },
  { label: 'Email', file: 'sample.eml' },
  { label: 'ZIP', file: 'sample.zip' },
  { label: 'Font', file: 'sample.woff2' },
  { label: 'Unknown binary', file: 'sample.bin' },
  { label: 'A PDF named report.txt', file: 'sample.pdf', name: 'report.txt' },
];

function Hero() {
  const [sample, setSample] = useState<Sample | undefined>(SAMPLES[0]);
  const [dropped, setDropped] = useState<File>();
  const [loaded, setLoaded] = useState<LoadedFile>();
  const [dragging, setDragging] = useState(false);

  const source: OmniSource = dropped ?? sampleUrl(sample!.file);
  const open = (file: File | undefined) => {
    if (!file) return;
    setDropped(file);
    setSample(undefined);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    open(event.dataTransfer.files[0]);
  };

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>Open any file in the browser. Send it nowhere.</h1>
        <p className="lede">
          omnifile is a file viewer that runs entirely in the page. PDFs, Word, Excel and
          PowerPoint files, images, video, email, code and more render from a URL or a dropped
          file, with nothing uploaded to anyone&rsquo;s server. Use it from React or from plain
          HTML.
        </p>
        <div className="actions">
          <a className="button button-solid" href="#install">
            Get started
          </a>
          <a className="button" href={REPO_URL}>
            View on GitHub
          </a>
        </div>
      </div>

      <div className="stage">
        <div
          className="window"
          data-dragging={dragging || undefined}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <ByteStrip file={loaded} />
          <div className="window-body">
            <OmniFile
              source={source}
              name={dropped ? undefined : sample?.name}
              plugins={plugins}
              theme="light"
              onLoad={({ file }) => setLoaded(file)}
              onError={() => setLoaded(undefined)}
            />
          </div>
        </div>

        <div className="samples">
          <label className="button button-solid file-button">
            Open your own file
            <input type="file" onChange={(event) => open(event.target.files?.[0])} />
          </label>
          <span className="samples-hint">or drop one on the viewer, or try a sample:</span>
          <div className="chips" role="group" aria-label="Sample files">
            {SAMPLES.map((item) => (
              <button
                key={item.label}
                type="button"
                className="chip"
                aria-pressed={sample === item}
                onClick={() => {
                  setSample(item);
                  setDropped(undefined);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const STRIP_BYTES = 16;

/** The first bytes of the open file, with the ones that identified it lit. */
function ByteStrip({ file }: { file: LoadedFile | undefined }) {
  if (!file) {
    return (
      <div className="bytes" aria-live="polite">
        <p className="bytes-verdict">Reading the file&hellip;</p>
      </div>
    );
  }
  const { start, length, text } = explain(file);
  // Show the window of bytes that contains the signature.
  const from = Math.min(start, Math.max(0, file.bytes.length - STRIP_BYTES));
  const shown = [...file.bytes.subarray(from, from + STRIP_BYTES)];
  const lit = (index: number) => index + from >= start && index + from < start + length;

  return (
    // Keyed so the reveal replays for each new file.
    <div className="bytes" key={`${file.name}:${file.size}`} aria-live="polite">
      <div className="bytes-dump" aria-hidden="true">
        {shown.map((byte, index) => (
          <span
            key={index}
            className="byte"
            data-lit={lit(index) || undefined}
            style={{ animationDelay: `${index * 28}ms` }}
          >
            <span className="byte-hex">{byte.toString(16).padStart(2, '0').toUpperCase()}</span>
            <span className="byte-char">{byte >= 0x21 && byte < 0x7f ? String.fromCharCode(byte) : '.'}</span>
          </span>
        ))}
      </div>
      <p className="bytes-verdict">
        <strong>{file.format.label}.</strong> {text}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- usage */

type Flavour = 'react' | 'html';
type Theme = 'light' | 'dark';

const DEMO_FILES = [
  { label: 'PDF', file: 'sample.pdf' },
  { label: 'Excel', file: 'sample.xlsx' },
  { label: 'Slides', file: 'sample.pptx' },
  { label: 'Markdown', file: 'sample.md' },
];

const reactSnippet = (file: string, theme: Theme) => `import { OmniFile } from '@omnifile/react';
import { allPlugins } from '@omnifile/all';
import { sandboxed } from '@omnifile/sandbox';

// Every format, each drawn inside an isolated frame.
const plugins = sandboxed(allPlugins());

export function Preview() {
  return (
    <OmniFile
      source="/files/${file}"
      plugins={plugins}
      theme="${theme}"
      style={{ height: 440 }}
    />
  );
}`;

const htmlSnippet = (file: string, theme: Theme) => `<div id="viewer" style="height: 440px"></div>

<script type="module">
  import { mount } from '@omnifile/core';
  import { allPlugins } from '@omnifile/all';
  import { sandboxed } from '@omnifile/sandbox';

  const viewer = mount(document.getElementById('viewer'), {
    source: '/files/${file}',
    plugins: sandboxed(allPlugins()),
    theme: '${theme}',
  });

  // When the viewer is no longer needed:
  // viewer.destroy();
</script>`;

function Usage() {
  const [flavour, setFlavour] = useState<Flavour>('react');
  const [theme, setTheme] = useState<Theme>('light');
  const [file, setFile] = useState(DEMO_FILES[0]!.file);
  const source = sampleUrl(file);

  return (
    <section className="section" id="usage">
      <div className="section-head">
        <h2>The same viewer, with or without React</h2>
        <p>
          The core has no framework in it. The React package is a thin component over the same{' '}
          <code>mount()</code> call you would write by hand. Switch between them: the panel on the
          right is rendered by whichever code is showing.
        </p>
      </div>

      <div className="usage-controls">
        <Segmented<Flavour>
          label="API"
          value={flavour}
          onChange={setFlavour}
          options={[
            { value: 'react', label: 'React' },
            { value: 'html', label: 'Plain HTML' },
          ]}
        />
        <Segmented
          label="File"
          value={file}
          onChange={setFile}
          options={DEMO_FILES.map((item) => ({ value: item.file, label: item.label }))}
        />
        <Segmented<Theme>
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>

      <div className="usage-grid">
        <Code label={flavour === 'react' ? 'React example' : 'Plain HTML example'}>
          {flavour === 'react' ? reactSnippet(file, theme) : htmlSnippet(file, theme)}
        </Code>
        <div className="usage-live" data-theme={theme}>
          {flavour === 'react' ? (
            <OmniFile source={source} plugins={plugins} theme={theme} />
          ) : (
            <VanillaViewer source={source} theme={theme} />
          )}
        </div>
      </div>
      <p className="footnote">
        The plain HTML example imports packages by name, so it needs a bundler such as Vite or an
        import map. To ship fewer formats, list the plugins you want in place of{' '}
        <code>allPlugins()</code>.
      </p>
    </section>
  );
}

/** The plain-HTML path: no React component, just the core's `mount()`. */
function VanillaViewer({ source, theme }: { source: string; theme: Theme }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewer = mount(host.current!, { source, plugins, theme });
    return () => viewer.destroy();
  }, [source, theme]);
  return <div ref={host} style={{ height: '100%' }} />;
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  onChange(value: T): void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      <span className="segmented-label">{props.label}</span>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={props.value === option.value}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- formats */

const FORMAT_ROWS: { family: string; types: string; how: string; ready: boolean }[] = [
  { family: 'PDF', types: 'pdf', how: 'pdf.js, pages drawn as you scroll, zoom', ready: true },
  { family: 'Word', types: 'docx', how: 'Laid out as pages, with tables, lists, images, headers and footers', ready: true },
  { family: 'Spreadsheets', types: 'xlsx, csv, tsv', how: 'A scrolling grid with sheet tabs, dates and number formats', ready: true },
  { family: 'PowerPoint', types: 'pptx', how: 'Each slide drawn with its text, shapes, images, tables and charts', ready: true },
  { family: 'Images', types: 'png, jpeg, gif, webp, avif, bmp, ico, svg', how: 'The browser’s own decoders, zoom', ready: true },
  { family: 'Video and audio', types: 'mp4, webm, mov, mkv, mp3, wav, ogg, m4a, flac', how: 'The browser’s own player', ready: true },
  { family: 'Markdown', types: 'md', how: 'Rendered, with a switch to the source', ready: true },
  { family: 'Code', types: 'js, ts, py, go, rs, java, json, yaml, css and more', how: 'Syntax colours and line numbers', ready: true },
  { family: 'HTML', types: 'html', how: 'Previewed with scripts off, with a switch to the source', ready: true },
  { family: 'Email', types: 'eml', how: 'Headers, body and attachments; remote images blocked', ready: true },
  { family: 'ZIP archives', types: 'zip', how: 'A folder tree you can expand, like a file explorer', ready: true },
  { family: 'Fonts', types: 'ttf, otf, woff, woff2', how: 'A specimen you can type into', ready: true },
  { family: 'Plain text', types: 'txt, log and anything text-like', how: 'Text with line numbers', ready: true },
  { family: 'Everything else', types: 'any file', how: 'A hex view of the raw bytes', ready: true },
  { family: 'HEIC and TIFF images', types: 'heic, tif', how: 'Decoded in the page', ready: false },
  { family: 'OpenDocument and EPUB', types: 'odt, ods, odp, epub', how: 'Recognised today, shown as hex until they have renderers', ready: false },
  { family: 'Legacy Office', types: 'doc, xls, ppt', how: 'LibreOffice compiled to WebAssembly, as an opt-in plugin', ready: false },
];

function Formats() {
  return (
    <section className="section" id="formats">
      <div className="section-head">
        <h2>What it opens</h2>
        <p>
          Each kind is its own small package, loaded only when a file of that kind is opened. Office
          files are drawn by open-source libraries in the page, so complex layouts can differ from
          the desktop apps. Anything without a renderer still opens, as a hex view.
        </p>
      </div>
      <div className="table-wrap">
        <table className="formats">
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">File types</th>
              <th scope="col">How it is shown</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {FORMAT_ROWS.map((row) => (
              <tr key={row.family} data-ready={row.ready || undefined}>
                <th scope="row">{row.family}</th>
                <td className="types">{row.types}</td>
                <td>{row.how}</td>
                <td>
                  <span className="status">
                    <span className="status-dot" aria-hidden="true" />
                    {row.ready ? 'Works today' : 'Planned'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- isolation */

function Isolation() {
  const plugins = useMemo(probePlugins, []);

  return (
    <section className="section" id="isolation">
      <div className="section-head">
        <h2>A hostile file stays in its box</h2>
        <p>
          Parsers have bugs, and a crafted file can turn one into code running in your page. With{' '}
          <code>sandboxed()</code>, every file is parsed and drawn inside a frame that has an origin
          of its own and no network access. Only the toolbar lives in your page; the two talk over
          a private message channel.
        </p>
      </div>

      <div className="isolation-grid">
        <figure className="probe">
          <div className="probe-live">
            <OmniFile source={PROBE_SOURCE} name="probe.txt" plugins={plugins} toolbar={false} theme="light" />
          </div>
          <figcaption>
            This panel is live. It is a sandboxed viewer running a test renderer that tries each of
            these when it loads, the way code smuggled in through a file would. In an ordinary
            page, every one of them succeeds.
          </figcaption>
        </figure>

        <dl className="principles isolation-notes">
          <div>
            <dt>How it is enforced</dt>
            <dd>
              The frame is sandboxed with scripts as its only permission, and carries a Content
              Security Policy that allows no connections and only scripts bearing a one-time
              token. Links and attachment downloads are passed to your page, which acts on them
              only after a real click.
            </dd>
          </div>
          <div>
            <dt>What it does not cover</dt>
            <dd>
              It contains bugs in the libraries that read files, not bugs in the browser itself.
              Loading a file from a URL and identifying its type still happen in your page, in a
              few hundred lines that only look at bytes. A page with its own strict Content
              Security Policy may need to allow the frame.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- design */

const pluginSnippet = `import { definePlugin } from '@omnifile/core';

export const hex = () =>
  definePlugin({
    id: 'my/hex',
    formats: ['binary'],
    // Downloaded only when a matching file is opened.
    load: () => import('./hex-impl').then((m) => m.implementation),
  });`;

function Design() {
  return (
    <section className="section" id="design">
      <div className="section-head">
        <h2>How it is put together</h2>
      </div>
      <dl className="principles">
        <div>
          <dt>Nothing is uploaded</dt>
          <dd>
            Files are read and drawn in the visitor&rsquo;s own tab. No conversion service, no
            third-party viewer in an iframe, and no copy of the document on a server you would
            have to secure.
          </dd>
        </div>
        <div>
          <dt>It reads the file, not the label</dt>
          <dd>
            A file is identified by its opening bytes first, then its declared type, then its
            extension. A PDF saved as <code>report.txt</code> still opens as a PDF; the strip above
            the viewer at the top of this page shows that decision for whatever you open.
          </dd>
        </div>
        <div>
          <dt>You ship only the formats you use</dt>
          <dd>
            Each format is its own package, and its code sits behind a dynamic import. Someone who
            only ever opens images never downloads the PDF or PowerPoint engines.
          </dd>
        </div>
        <div>
          <dt>Editing can follow later</dt>
          <dd>
            Every plugin turns bytes into a model and the model into the page, and keeps the
            original bytes untouched. Saving a model back to a file is a reserved step in the
            plugin interface, so a format can gain editing without breaking the ones that view.
          </dd>
        </div>
      </dl>
      <div className="plugin-example">
        <div>
          <h3>Add a format of your own</h3>
          <p>
            A plugin is a short description plus an implementation that loads on demand. Plugins
            later in the list win, so you can also replace a built-in renderer with yours.
          </p>
        </div>
        <Code label="Plugin example">{pluginSnippet}</Code>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- install */

const installSnippet = `git clone ${REPO_URL}.git
cd omnifile
pnpm install
pnpm dev`;

const npmSnippet = `npm install @omnifile/react @omnifile/all @omnifile/sandbox`;

function Install() {
  return (
    <section className="section" id="install">
      <div className="section-head">
        <h2>Install</h2>
        <p>
          The packages are not on npm yet. Until the first release, clone the repository and run
          the playground to try your own files.
        </p>
      </div>
      <div className="install-grid">
        <div>
          <h3>Today</h3>
          <Code label="Commands to run the playground">{installSnippet}</Code>
        </div>
        <div>
          <h3>After the first release</h3>
          <Code label="npm install command">{npmSnippet}</Code>
          <p className="footnote">
            Plain HTML projects install <code>@omnifile/core</code> in place of{' '}
            <code>@omnifile/react</code>.
          </p>
        </div>
      </div>
    </section>
  );
}
