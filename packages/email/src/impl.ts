import { ensureStyle, formatSize, type PluginImplementation } from '@omnifile/core';
import DOMPurify from 'dompurify';
import PostalMime, { type Address, type Email } from 'postal-mime';

export interface EmailModel {
  email: Email;
}

const CSS = `
.omnifile-email { min-height: 100%; background: var(--omnifile-surface); }
.omnifile-email-head { padding: 18px 20px 14px; border-bottom: 1px solid var(--omnifile-border); }
.omnifile-email-subject { font-size: 19px; font-weight: 650; margin: 0 0 12px; line-height: 1.3; overflow-wrap: anywhere; }
.omnifile-email-fields { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 3px 12px; margin: 0; }
.omnifile-email-fields dt { color: var(--omnifile-muted); }
.omnifile-email-fields dd { margin: 0; overflow-wrap: anywhere; }
.omnifile-email-files { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--omnifile-border); }
.omnifile-email-file { display: inline-flex; gap: 8px; align-items: baseline; padding: 5px 10px; border: 1px solid var(--omnifile-border); border-radius: 6px; color: inherit; text-decoration: none; max-width: 100%; }
.omnifile-email-file:hover { background: var(--omnifile-bg); }
.omnifile-email-file:focus-visible { outline: 2px solid var(--omnifile-accent); outline-offset: 1px; }
.omnifile-email-file span { color: var(--omnifile-muted); font-size: 12px; white-space: nowrap; }
.omnifile-email-frame { display: block; width: 100%; border: 0; background: #fff; }
.omnifile-email-text { margin: 0; padding: 18px 20px; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.55; }
`;

const POLICY =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";

const formatAddress = (address: Address): string => {
  if ('group' in address && address.group) {
    return `${address.name}: ${address.group.map(formatAddress).join(', ')}`;
  }
  const mailbox = 'address' in address ? address.address : undefined;
  if (address.name && mailbox) return `${address.name} <${mailbox}>`;
  return address.name || mailbox || '';
};

function toBase64(content: ArrayBuffer | Uint8Array | string): string {
  if (typeof content === 'string') return btoa(unescape(encodeURIComponent(content)));
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export const implementation: PluginImplementation<EmailModel> = {
  async parse(file) {
    return { email: await PostalMime.parse(file.bytes) };
  },

  render(model, { container }) {
    const doc = container.ownerDocument;
    ensureStyle(doc, 'omnifile-email-styles', CSS);
    const { email } = model;
    const urls: string[] = [];
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
      const node = doc.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    const wrapper = el('div', 'omnifile-email');
    const head = el('div', 'omnifile-email-head');
    head.append(el('h2', 'omnifile-email-subject', email.subject || '(no subject)'));
    const fields = el('dl', 'omnifile-email-fields');
    const field = (label: string, value: string | undefined) => {
      if (!value) return;
      fields.append(el('dt', '', label), el('dd', '', value));
    };
    field('From', email.from ? formatAddress(email.from) : undefined);
    field('To', email.to?.map(formatAddress).join(', '));
    field('Cc', email.cc?.map(formatAddress).join(', '));
    const date = email.date ? new Date(email.date) : undefined;
    field(
      'Date',
      date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(date)
        : undefined,
    );
    head.append(fields);
    wrapper.append(head);

    // Attachments referenced by the HTML body (cid:) are shown inline, not listed.
    const inline = new Map<string, string>();
    const listed = [];
    for (const attachment of email.attachments) {
      const id = attachment.contentId?.replace(/^<|>$/g, '');
      if (id && attachment.related && attachment.mimeType.startsWith('image/')) {
        inline.set(id, `data:${attachment.mimeType};base64,${toBase64(attachment.content)}`);
      } else {
        listed.push(attachment);
      }
    }
    if (listed.length) {
      const files = el('div', 'omnifile-email-files');
      for (const attachment of listed) {
        const url = URL.createObjectURL(
          new Blob([attachment.content as BlobPart], { type: attachment.mimeType }),
        );
        urls.push(url);
        const link = el('a', 'omnifile-email-file', attachment.filename || 'attachment');
        link.href = url;
        link.download = attachment.filename || 'attachment';
        const size =
          typeof attachment.content === 'string'
            ? attachment.content.length
            : attachment.content.byteLength;
        link.append(el('span', '', formatSize(size)));
        files.append(link);
      }
      wrapper.append(files);
    }

    let observer: ResizeObserver | undefined;
    if (email.html) {
      let html = DOMPurify.sanitize(email.html, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style'], FORCE_BODY: false });
      html = html.replace(/cid:([^"'\s)>]+)/g, (match, id: string) => inline.get(id) ?? match);
      const frame = el('iframe', 'omnifile-email-frame');
      frame.title = 'Message body';
      // No scripts. Same-origin is allowed only so the frame can be sized to
      // its content; without scripts the content cannot use that access.
      frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.srcdoc =
        `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta http-equiv="Content-Security-Policy" content="${POLICY}">` +
        `<base target="_blank"><style>body{margin:16px 20px;font:14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style>` +
        `</head><body>${html}</body></html>`;
      frame.addEventListener('load', () => {
        const inner = frame.contentDocument;
        if (!inner) {
          // Inside the sandbox the body is a separate origin and cannot be
          // measured, so it fills the space left and scrolls by itself.
          frame.style.height = `${Math.max(320, container.clientHeight - frame.offsetTop)}px`;
          return;
        }
        const fit = () => {
          frame.style.height = `${inner.documentElement.scrollHeight}px`;
        };
        fit();
        const view = doc.defaultView;
        if (view) {
          observer = new view.ResizeObserver(fit);
          observer.observe(inner.documentElement);
        }
      });
      wrapper.append(frame);
    } else {
      wrapper.append(el('pre', 'omnifile-email-text', email.text || '(this message has no text)'));
    }

    container.append(wrapper);
    return {
      destroy() {
        observer?.disconnect();
        wrapper.remove();
        for (const url of urls) URL.revokeObjectURL(url);
      },
    };
  },
};
