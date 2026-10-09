import type { ArchiveEntry } from './zip';

export interface TreeNode {
  /** The last path segment, as shown in the list. */
  name: string;
  /** Full path inside the archive, without a trailing slash. */
  path: string;
  directory: boolean;
  /** For a folder, the total of everything inside it. */
  size: number;
  compressedSize: number;
  modified: Date | undefined;
  encrypted: boolean;
  /** Folders first, then files, each alphabetical. Empty for files. */
  children: TreeNode[];
  /** Number of files anywhere beneath a folder. */
  fileCount: number;
}

/**
 * Turn a flat list of archive paths into a folder tree. Archives often list
 * files without separate entries for their folders, so missing folders are
 * created from the paths.
 */
export function buildTree(entries: readonly ArchiveEntry[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    directory: true,
    size: 0,
    compressedSize: 0,
    modified: undefined,
    encrypted: false,
    children: [],
    fileCount: 0,
  };
  const folders = new Map<string, TreeNode>([['', root]]);

  const folder = (path: string): TreeNode => {
    const existing = folders.get(path);
    if (existing) return existing;
    const cut = path.lastIndexOf('/');
    const node: TreeNode = {
      name: path.slice(cut + 1),
      path,
      directory: true,
      size: 0,
      compressedSize: 0,
      modified: undefined,
      encrypted: false,
      children: [],
      fileCount: 0,
    };
    folders.set(path, node);
    folder(cut === -1 ? '' : path.slice(0, cut)).children.push(node);
    return node;
  };

  for (const entry of entries) {
    // Windows tools write backslashes; "./" and empty segments carry nothing.
    const segments = entry.name.split(/[\\/]+/).filter((segment) => segment !== '' && segment !== '.');
    if (segments.length === 0) continue;
    const path = segments.join('/');
    if (entry.directory) {
      const node = folder(path);
      node.modified = entry.modified;
      continue;
    }
    const parent = folder(segments.slice(0, -1).join('/'));
    parent.children.push({
      name: segments[segments.length - 1]!,
      path,
      directory: false,
      size: entry.size,
      compressedSize: entry.compressedSize,
      modified: entry.modified,
      encrypted: entry.encrypted,
      children: [],
      fileCount: 0,
    });
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const finish = (node: TreeNode) => {
    for (const child of node.children) {
      if (child.directory) finish(child);
      node.size += child.size;
      node.compressedSize += child.compressedSize;
      node.fileCount += child.directory ? child.fileCount : 1;
    }
    node.children.sort(
      (a, b) => Number(b.directory) - Number(a.directory) || collator.compare(a.name, b.name),
    );
  };
  finish(root);
  return root;
}
