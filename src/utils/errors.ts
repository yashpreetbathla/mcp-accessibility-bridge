export class BrowserNotConnectedError extends Error {
  constructor() {
    super(
      'Browser is not connected. Use browser_connect first. ' +
      'Make sure Chrome is running with --remote-debugging-port=9222.'
    );
    this.name = 'BrowserNotConnectedError';
  }
}

export function toolSuccess(data: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: false;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

export function toolError(error: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  const message =
    error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
