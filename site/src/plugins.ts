import { image } from '@omnifile/image';
import { media } from '@omnifile/media';
import { pdf } from '@omnifile/pdf';
import { text } from '@omnifile/text';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/** One shared list, so every viewer on the page reuses the same plugins. */
export const plugins = [image(), media(), text(), pdf({ workerSrc })];

export const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}samples/${file}`;

export const REPO_URL = 'https://github.com/YakovMallah/omnifile';
