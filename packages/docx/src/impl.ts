import { ensureStyle, toBlob, type PluginImplementation } from '@omnifile/core';
import { parseAsync, renderDocument } from 'docx-preview';

export interface DocxModel {
  /** docx-preview's parsed document. */
  document: Awaited<ReturnType<typeof parseAsync>>;
}

const CSS = `
.omnifile-docx-host { min-height: 100%; min-width: max-content; }
.omnifile-docx-host .omnifile-docx-wrapper { background: transparent; padding: 16px; display: flex; flex-flow: column; align-items: center; gap: 16px; }
.omnifile-docx-host .omnifile-docx-wrapper > section.omnifile-docx { background: #fff; color: #000; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25); margin-bottom: 0; flex: none; }
`;

const OPTIONS = {
  className: 'omnifile-docx',
  inWrapper: true,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  // Images become blob: URLs, released when the viewer is destroyed.
  useBase64URL: false,
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export const implementation: PluginImplementation<DocxModel> = {
  async parse(file) {
    try {
      return { document: await parseAsync(toBlob(file), OPTIONS) };
    } catch {
      throw new Error('This Word document is damaged, or protected with a password.');
    }
  },

  async render(model, { container }) {
    const doc = container.ownerDocument;
    ensureStyle(doc, 'omnifile-docx-styles', CSS);
    const host = doc.createElement('div');
    host.className = 'omnifile-docx-host';
    const nodes = await renderDocument(model.document, OPTIONS);
    host.append(...nodes);
    // Links in a document should not replace the page that hosts the viewer.
    for (const link of host.querySelectorAll('a[href]')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
    container.append(host);

    // Start at a size that fits the first page in the viewport's width.
    const page = host.querySelector<HTMLElement>('section.omnifile-docx');
    const available = container.clientWidth - 32;
    const fit = page && available > 0 ? available / page.offsetWidth : 1;
    let zoom = Math.max(MIN_ZOOM, Math.min(1, fit));
    const apply = () => {
      host.style.setProperty('zoom', String(zoom));
    };
    apply();

    return {
      destroy: () => host.remove(),
      zoom: {
        min: MIN_ZOOM,
        max: MAX_ZOOM,
        get: () => zoom,
        set(value) {
          zoom = value;
          apply();
        },
      },
    };
  },
};
