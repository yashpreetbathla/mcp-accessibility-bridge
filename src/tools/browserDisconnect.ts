import { browserManager } from '../browser/BrowserManager.js';
import { toolError, toolSuccess } from '../utils/errors.js';

export const browserDisconnectSchema = {};

export async function browserDisconnectHandler(
  _args: Record<string, never>
): Promise<ReturnType<typeof toolSuccess | typeof toolError>> {
  try {
    if (!browserManager.isConnected()) {
      return toolSuccess({
        disconnected: true,
        message: 'Already disconnected (no active connection).',
      });
    }

    await browserManager.disconnect();

    return toolSuccess({
      disconnected: true,
      message: 'Disconnected from Chrome (browser process is still running).',
    });
  } catch (error) {
    return toolError(error);
  }
}
