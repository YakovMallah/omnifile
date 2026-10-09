const BY_FORMAT: Record<string, string> = {
  json: 'json',
  ipynb: 'json',
  html: 'xml',
  xml: 'xml',
  yaml: 'yaml',
  css: 'css',
  javascript: 'javascript',
  typescript: 'typescript',
  markdown: 'markdown',
};

const BY_EXTENSION: Record<string, string> = {
  scss: 'scss', sass: 'scss', less: 'less',
  jsx: 'javascript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', cc: 'cpp', cs: 'csharp', php: 'php',
  sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', lua: 'lua', r: 'r',
  toml: 'ini', ini: 'ini', conf: 'ini', env: 'bash', makefile: 'makefile',
  graphql: 'graphql', vue: 'xml', svelte: 'xml', plist: 'xml', xsl: 'xml', xsd: 'xml',
};

/** The highlight.js language for a file, or undefined to leave it plain. */
export function languageFor(formatId: string, fileName: string): string | undefined {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  const extension = (dot === -1 ? base : base.slice(dot + 1)).toLowerCase();
  return BY_EXTENSION[extension] ?? BY_FORMAT[formatId];
}
