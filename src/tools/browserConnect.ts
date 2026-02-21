import { z } from 'zod';
import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';

export const browserConnectSchema = {
  debugUrl: z
    .string()
    .url()
    .optional()
    .default('http://localhost:9222')
    .describe(
      'Chrome remote debugging URL. Default: http://localhost:9222. ' +
      'Start Chrome with --remote-debugging-port=9222.'
    ),
};

export async function browserConnectHandler(
  args: { debugUrl?: string }
): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const url = args.debugUrl ?? 'http://localhost:9222';
    await browserManager.connect(url);

    const { page } = browserManager.requireConnection();
    const currentUrl = page.url();
    const title = await page.title().catch(() => '');

    return toolSuccess({
      connected: true,
      debugUrl: url,
      currentUrl,
      pageTitle: title,
      message: `Connected to Chrome at ${url}. Active page: "${title || currentUrl}"`,
    });
  } catch (error) {
    return toolError(error);
  }
}
