/**
 * The page that runs inside the sandbox frame.
 *
 * The frame is created with `sandbox="allow-scripts"` and no
 * `allow-same-origin`, which gives it an origin of its own: code in it cannot
 * read the host page's DOM, cookies or storage. The policy below then removes
 * its network access, so a compromised renderer has nowhere to send a file.
 *
 * Scripts need the per-frame nonce, so markup injected by a parsing bug does
 * not execute. `blob:` is allowed because plugin code arrives as text over
 * the message channel and is imported from a blob.
 */
export function contentPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' blob:`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    'media-src data: blob:',
    'font-src data: blob:',
    'connect-src data: blob:',
    'worker-src blob:',
    'frame-src about: blob: data:',
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

/**
 * The script that runs inside the frame. It is kept as text, not as a
 * function, so no bundler or minifier in the host app can rewrite it into
 * something that depends on code outside the frame. Plain JavaScript only.
 */
export const FRAME_SCRIPT = String.raw`(function () {
  'use strict';
  var port;
  var handle;

  function send(message, transfer) {
    if (port) port.postMessage(message, transfer || []);
  }
  function zoomState() {
    var zoom = handle && handle.zoom;
    return zoom ? { min: zoom.min, max: zoom.max, value: zoom.get() } : undefined;
  }
  function viewState() {
    var views = handle && handle.views;
    return views ? { options: views.options, value: views.get() } : undefined;
  }
  function fail(cause) {
    send({ type: 'error', message: cause && cause.message ? String(cause.message) : String(cause) });
  }

  async function render(message) {
    var style = document.createElement('style');
    style.textContent = message.css;
    document.head.append(style);

    var root = document.createElement('div');
    root.className = 'omnifile';
    if (message.theme) root.dataset.theme = message.theme;
    Object.keys(message.variables).forEach(function (name) {
      root.style.setProperty(name, message.variables[name]);
    });
    var viewport = document.createElement('div');
    viewport.className = 'omnifile-viewport';
    root.append(viewport);
    document.body.append(root);

    // Plugin code arrives as text and is imported from a blob, because a
    // frame with an origin of its own cannot import the host's script files.
    var url = URL.createObjectURL(new Blob([message.code], { type: 'text/javascript' }));
    var module;
    try {
      module = await import(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    var implementation = module.default(message.options);
    var signal = new AbortController().signal;
    var model = await implementation.parse(message.file, { mode: message.mode, signal: signal });
    handle = await implementation.render(model, {
      mode: message.mode,
      signal: signal,
      container: viewport,
      file: message.file,
    });
    send({ type: 'rendered', zoom: zoomState(), views: viewState() });
  }

  function onMessage(event) {
    var message = event.data;
    try {
      if (message.type === 'render') {
        render(message).catch(fail);
      } else if (message.type === 'zoom') {
        if (handle && handle.zoom) handle.zoom.set(message.value);
        send({ type: 'state', zoom: zoomState(), views: viewState() });
      } else if (message.type === 'view') {
        if (handle && handle.views) handle.views.set(message.id);
        send({ type: 'state', zoom: zoomState(), views: viewState() });
      }
    } catch (cause) {
      fail(cause);
    }
  }

  // The host hands over one end of a private channel as soon as the frame
  // has loaded. Nothing else is listened to.
  addEventListener('message', function (event) {
    if (port || !event.data || event.data.type !== 'omnifile:init' || !event.ports[0]) return;
    port = event.ports[0];
    port.onmessage = onMessage;
    send({ type: 'ready' });
  });

  // The frame may not open windows or start downloads. Clicks on links and
  // download links are passed to the host, which decides what to allow.
  document.addEventListener(
    'click',
    function (event) {
      var target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!target) return;
      event.preventDefault();
      if (target.hasAttribute('download')) {
        fetch(target.href)
          .then(function (response) {
            return response.arrayBuffer();
          })
          .then(function (buffer) {
            send({ type: 'download', name: target.download || 'download', bytes: buffer }, [buffer]);
          })
          .catch(function () {});
      } else if (target.getAttribute('href').charAt(0) !== '#') {
        send({ type: 'open-link', href: target.href });
      }
    },
    true
  );
})();`;

/** The frame's whole document, as a string for `srcdoc`. */
export function frameDocument(nonce: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${contentPolicy(nonce)}">` +
    '<meta name="referrer" content="no-referrer">' +
    '<style>html,body{height:100%;margin:0}body{overflow:hidden}</style>' +
    `</head><body><script nonce="${nonce}">${FRAME_SCRIPT}</script></body></html>`
  );
}
