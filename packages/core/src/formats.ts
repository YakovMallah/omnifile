export type FormatCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'font'
  | 'email'
  | 'archive'
  | 'binary';

export interface FormatInfo {
  id: string;
  label: string;
  category: FormatCategory;
  /** Canonical MIME type. */
  mime: string;
  /** Other MIME types seen in the wild for this format. */
  mimeAliases?: readonly string[];
  /** Lowercase, without the dot. */
  extensions: readonly string[];
}

const f = (
  id: string,
  label: string,
  category: FormatCategory,
  mime: string,
  extensions: string[],
  mimeAliases?: string[],
): FormatInfo => ({ id, label, category, mime, extensions, mimeAliases });

const OOXML = 'application/vnd.openxmlformats-officedocument';

export const FORMATS: readonly FormatInfo[] = [
  f('pdf', 'PDF', 'document', 'application/pdf', ['pdf']),

  f('docx', 'Word document', 'document', `${OOXML}.wordprocessingml.document`, ['docx']),
  f('xlsx', 'Excel workbook', 'spreadsheet', `${OOXML}.spreadsheetml.sheet`, ['xlsx']),
  f('pptx', 'PowerPoint presentation', 'presentation', `${OOXML}.presentationml.presentation`, ['pptx']),
  f('doc', 'Word 97-2003 document', 'document', 'application/msword', ['doc']),
  f('xls', 'Excel 97-2003 workbook', 'spreadsheet', 'application/vnd.ms-excel', ['xls']),
  f('ppt', 'PowerPoint 97-2003 presentation', 'presentation', 'application/vnd.ms-powerpoint', ['ppt']),

  f('png', 'PNG image', 'image', 'image/png', ['png']),
  f('jpeg', 'JPEG image', 'image', 'image/jpeg', ['jpg', 'jpeg', 'jfif'], ['image/jpg', 'image/pjpeg']),
  f('gif', 'GIF image', 'image', 'image/gif', ['gif']),
  f('webp', 'WebP image', 'image', 'image/webp', ['webp']),
  f('avif', 'AVIF image', 'image', 'image/avif', ['avif']),
  f('bmp', 'BMP image', 'image', 'image/bmp', ['bmp'], ['image/x-ms-bmp']),
  f('ico', 'Icon', 'image', 'image/x-icon', ['ico'], ['image/vnd.microsoft.icon']),
  f('svg', 'SVG image', 'image', 'image/svg+xml', ['svg']),
  f('heic', 'HEIC image', 'image', 'image/heic', ['heic', 'heif'], ['image/heif']),
  f('tiff', 'TIFF image', 'image', 'image/tiff', ['tif', 'tiff']),

  f('mp4', 'MP4 video', 'video', 'video/mp4', ['mp4', 'm4v']),
  f('webm', 'WebM video', 'video', 'video/webm', ['webm']),
  f('mov', 'QuickTime video', 'video', 'video/quicktime', ['mov']),
  f('mkv', 'Matroska video', 'video', 'video/x-matroska', ['mkv']),
  f('ogv', 'Ogg video', 'video', 'video/ogg', ['ogv']),

  f('mp3', 'MP3 audio', 'audio', 'audio/mpeg', ['mp3'], ['audio/mp3']),
  f('wav', 'WAV audio', 'audio', 'audio/wav', ['wav'], ['audio/x-wav', 'audio/wave']),
  f('ogg', 'Ogg audio', 'audio', 'audio/ogg', ['ogg', 'oga', 'opus'], ['application/ogg']),
  f('m4a', 'M4A audio', 'audio', 'audio/mp4', ['m4a'], ['audio/x-m4a']),
  f('flac', 'FLAC audio', 'audio', 'audio/flac', ['flac'], ['audio/x-flac']),

  f('markdown', 'Markdown', 'text', 'text/markdown', ['md', 'markdown', 'mdx'], ['text/x-markdown']),
  f('json', 'JSON', 'text', 'application/json', ['json', 'jsonc', 'json5', 'geojson', 'ndjson']),
  f('csv', 'CSV', 'text', 'text/csv', ['csv']),
  f('tsv', 'TSV', 'text', 'text/tab-separated-values', ['tsv']),
  f('html', 'HTML', 'text', 'text/html', ['html', 'htm']),
  f('xml', 'XML', 'text', 'application/xml', ['xml', 'xsl', 'xsd', 'plist'], ['text/xml']),
  f('yaml', 'YAML', 'text', 'application/yaml', ['yaml', 'yml'], ['text/yaml', 'application/x-yaml']),
  f('css', 'CSS', 'text', 'text/css', ['css', 'scss', 'sass', 'less']),
  f('javascript', 'JavaScript', 'text', 'text/javascript', ['js', 'mjs', 'cjs', 'jsx'], ['application/javascript']),
  f('typescript', 'TypeScript', 'text', 'text/typescript', ['ts', 'mts', 'cts', 'tsx'], ['application/typescript']),
  f(
    'code',
    'Source code',
    'text',
    'text/x-source',
    [
      'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'php',
      'sh', 'bash', 'zsh', 'ps1', 'sql', 'lua', 'r', 'dart', 'scala', 'vue', 'svelte', 'toml',
      'ini', 'conf', 'env', 'gradle', 'dockerfile', 'makefile', 'graphql', 'proto',
    ],
  ),
  f('text', 'Plain text', 'text', 'text/plain', ['txt', 'text', 'log']),

  f('ipynb', 'Jupyter notebook', 'text', 'application/x-ipynb+json', ['ipynb']),
  f('rtf', 'Rich Text document', 'document', 'application/rtf', ['rtf'], ['text/rtf']),
  f('odt', 'OpenDocument text', 'document', 'application/vnd.oasis.opendocument.text', ['odt']),
  f('ods', 'OpenDocument spreadsheet', 'spreadsheet', 'application/vnd.oasis.opendocument.spreadsheet', ['ods']),
  f('odp', 'OpenDocument presentation', 'presentation', 'application/vnd.oasis.opendocument.presentation', ['odp']),
  f('epub', 'EPUB book', 'document', 'application/epub+zip', ['epub']),
  f('eml', 'Email message', 'email', 'message/rfc822', ['eml']),

  f('ttf', 'TrueType font', 'font', 'font/ttf', ['ttf'], ['application/x-font-ttf', 'font/sfnt']),
  f('otf', 'OpenType font', 'font', 'font/otf', ['otf'], ['application/x-font-otf']),
  f('woff', 'WOFF font', 'font', 'font/woff', ['woff'], ['application/font-woff']),
  f('woff2', 'WOFF2 font', 'font', 'font/woff2', ['woff2']),

  f('gzip', 'Gzip archive', 'archive', 'application/gzip', ['gz', 'tgz'], ['application/x-gzip']),
  f('tar', 'Tar archive', 'archive', 'application/x-tar', ['tar']),
  f('7z', '7-Zip archive', 'archive', 'application/x-7z-compressed', ['7z']),
  f('rar', 'RAR archive', 'archive', 'application/vnd.rar', ['rar'], ['application/x-rar-compressed']),
  f('zip', 'ZIP archive', 'archive', 'application/zip', ['zip'], ['application/x-zip-compressed']),
  f('binary', 'Unknown file', 'binary', 'application/octet-stream', []),
];

const byId = new Map(FORMATS.map((format) => [format.id, format]));
const byExtension = new Map<string, FormatInfo>();
const byMime = new Map<string, FormatInfo>();
for (const format of FORMATS) {
  for (const ext of format.extensions) if (!byExtension.has(ext)) byExtension.set(ext, format);
  for (const mime of [format.mime, ...(format.mimeAliases ?? [])]) {
    if (!byMime.has(mime)) byMime.set(mime, format);
  }
}

export function getFormat(id: string): FormatInfo {
  const format = byId.get(id);
  if (!format) throw new Error(`omnifile: unknown format id "${id}"`);
  return format;
}

export function formatFromExtension(name: string | undefined): FormatInfo | undefined {
  if (!name) return undefined;
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf('.');
  // Extensionless names such as "Dockerfile" or "Makefile" match as a whole.
  const ext = (dot === -1 ? base : base.slice(dot + 1)).toLowerCase();
  return byExtension.get(ext);
}

export function formatFromMime(mime: string | undefined): FormatInfo | undefined {
  if (!mime) return undefined;
  const clean = mime.split(';')[0]!.trim().toLowerCase();
  return byMime.get(clean);
}
