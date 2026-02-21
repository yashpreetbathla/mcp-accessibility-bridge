import puppeteer, { Browser, Page, CDPSession } from 'puppeteer-core';
import { BrowserNotConnectedError } from '../utils/errors.js';

interface BrowserState {
  browser: Browser;
  page: Page;
  cdpSession: CDPSession;
  debugUrl: string;
  connectedAt: Date;
}

class BrowserManager {
  private state: BrowserState | null = null;

  async connect(debugUrl = 'http://localhost:9222'): Promise<void> {
    // Disconnect existing connection if any
    if (this.state) {
      await this.disconnect();
    }

    const browser = await puppeteer.connect({
      browserURL: debugUrl,
      defaultViewport: null,
    });

    const pages = await browser.pages();
    if (pages.length === 0) {
      throw new Error('No pages found in the connected browser. Open a tab first.');
    }

    // Use the last (most recently focused) page
    const page = pages[pages.length - 1] ?? pages[0];

    const cdpSession = await page.createCDPSession();

    // Must enable Accessibility domain before any AX CDP calls
    await cdpSession.send('Accessibility.enable');

    this.state = {
      browser,
      page,
      cdpSession,
      debugUrl,
      connectedAt: new Date(),
    };
  }

  async disconnect(): Promise<void> {
    if (!this.state) return;

    try {
      await this.state.cdpSession.detach();
    } catch {
      // Ignore detach errors — session may already be gone
    }

    try {
      // disconnect() NOT close() — we don't own the Chrome process
      this.state.browser.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    this.state = null;
  }

  /**
   * Returns the current connection state or throws BrowserNotConnectedError.
   */
  requireConnection(): BrowserState {
    if (!this.state) {
      throw new BrowserNotConnectedError();
    }
    return this.state;
  }

  isConnected(): boolean {
    return this.state !== null;
  }

  getStatus(): { connected: boolean; debugUrl?: string; connectedAt?: string; currentUrl?: string } {
    if (!this.state) {
      return { connected: false };
    }
    return {
      connected: true,
      debugUrl: this.state.debugUrl,
      connectedAt: this.state.connectedAt.toISOString(),
    };
  }
}

// Singleton instance shared across all tool modules
export const browserManager = new BrowserManager();
