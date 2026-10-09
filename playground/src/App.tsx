import { useMemo, useState, type DragEvent } from 'react';
import { OmniFile, type OmniSource } from '@omnifile/react';
import { allPlugins } from '@omnifile/all';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

const SAMPLES = [
  'sample.pdf', 'sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.csv', 'sample.md',
  'sample.py', 'sample.json', 'sample.html', 'sample.png', 'sample.svg', 'sample.eml',
  'sample.zip', 'sample.woff2', 'sample.bin',
];

// `?mainthread` exercises the PDF plugin's zero-configuration fallback.
const useWorker = !new URLSearchParams(location.search).has('mainthread');

export function App() {
  const [source, setSource] = useState<OmniSource>(`/samples/${SAMPLES[0]}`);
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);
  const plugins = useMemo(
    () => allPlugins({ pdf: useWorker ? { workerSrc } : {} }),
    [],
  );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) setSource(file);
  };

  return (
    <div
      className="app"
      data-dragging={dragging || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header>
        <h1>omnifile</h1>
        <label className="pick">
          Open a file
          <input
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setSource(file);
            }}
          />
        </label>
        <span className="hint">or drop one anywhere</span>
        <nav>
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              aria-pressed={source === `/samples/${sample}`}
              onClick={() => setSource(`/samples/${sample}`)}
            >
              {sample}
            </button>
          ))}
        </nav>
        <output data-testid="status">{status}</output>
      </header>
      <main>
        <OmniFile
          source={source}
          plugins={plugins}
          onLoad={({ file, plugin }) =>
            setStatus(`${file.format.id} via ${plugin?.id ?? 'no plugin'}`)
          }
          onError={(error) => setStatus(`error: ${error.message}`)}
        />
      </main>
    </div>
  );
}
