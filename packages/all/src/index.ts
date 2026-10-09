import { archive } from '@omnifile/archive';
import { code } from '@omnifile/code';
import type { AnyPlugin } from '@omnifile/core';
import { docx } from '@omnifile/docx';
import { email } from '@omnifile/email';
import { font } from '@omnifile/font';
import { hex } from '@omnifile/hex';
import { html, type HtmlOptions } from '@omnifile/html';
import { image } from '@omnifile/image';
import { markdown, type MarkdownOptions } from '@omnifile/markdown';
import { media } from '@omnifile/media';
import { pdf, type PdfOptions } from '@omnifile/pdf';
import { pptx } from '@omnifile/pptx';
import { sheet } from '@omnifile/sheet';
import { text } from '@omnifile/text';

export interface AllPluginsOptions {
  pdf?: PdfOptions;
  markdown?: MarkdownOptions;
  html?: HtmlOptions;
  /**
   * Show a hex dump for files nothing else can open, instead of the
   * "no preview" state. On by default.
   */
  hexFallback?: boolean;
}

/**
 * Every official plugin, ordered so the most specific renderer wins. Each
 * plugin's code is still loaded only when a file of its format is opened.
 */
export function allPlugins(options: AllPluginsOptions = {}): AnyPlugin[] {
  return [
    ...(options.hexFallback === false ? [] : [hex()]),
    text(),
    code(),
    html(options.html),
    markdown(options.markdown),
    image(),
    media(),
    pdf(options.pdf),
    docx(),
    sheet(),
    pptx(),
    archive(),
    font(),
    email(),
  ];
}
