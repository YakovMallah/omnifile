import { definePlugin, type OmniPlugin } from '@omnifile/core';
import type { EmailModel } from './impl';

export type { EmailModel } from './impl';

/**
 * Email messages (.eml): headers, body and attachments. HTML bodies are
 * sanitised and shown in a sandboxed frame that cannot load remote content,
 * so tracking pixels are never fetched.
 */
export function email(): OmniPlugin<EmailModel> {
  return definePlugin({
    id: 'omnifile/email',
    formats: ['eml'],
    load: () => import('./impl').then((module) => module.implementation),
    frame: { url: () => new URL('./frame.js', import.meta.url).href },
  });
}
