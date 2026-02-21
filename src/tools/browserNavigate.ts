import { z } from 'zod';
import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';

export const browserNavigateSchema = {
  url: z.string().url().describe('URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2'])
    .optional()
    .default('load')
    .describe('When to consider navigation complete. Default: load'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(30000)
    .describe('Navigation timeout in milliseconds. Default: 30000'),
};

export async function browserNavigateHandler(args: {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    const { page } = browserManager.requireConnection();

    const response = await page.goto(args.url, {
      waitUntil: args.waitUntil ?? 'load',
      timeout: args.timeout ?? 30000,
    });

    const title = await page.title().catch(() => '');
    const finalUrl = page.url();
    const status = response?.status() ?? null;

    return toolSuccess({
      navigated: true,
      url: args.url,
      finalUrl,
      title,
      status,
      message: `Navigated to "${title || finalUrl}" (HTTP ${status})`,
    });
  } catch (error) {
    return toolError(error);
  }
}
