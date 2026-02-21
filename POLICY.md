# Usage Policy

## Overview

MCP Accessibility Bridge is a developer tool built to improve software quality, test coverage, and web accessibility. This document defines the intended uses, boundaries, and responsibilities for users and contributors.

---

## Intended Use

MCP Accessibility Bridge is designed for:

- **Test automation development** — generating, migrating, and maintaining E2E test selectors
- **Accessibility auditing** — identifying ARIA issues, missing labels, and focus order problems
- **Developer tooling** — integrating accessibility insights into development workflows
- **Educational purposes** — understanding how browsers compute the Accessibility Object Model

---

## Permitted Use

You may use this tool to:

- Connect to browsers you own or have explicit authorization to inspect
- Generate test selectors for web applications you develop or test professionally
- Audit web pages for WCAG compliance on properties you control or have testing rights to
- Build internal tooling, scripts, and automation pipelines for legitimate software development
- Inspect publicly accessible web pages for accessibility research or competitive analysis, in accordance with the site's Terms of Service

---

## Prohibited Use

You may **not** use this tool to:

- **Scrape or automate actions on sites without authorization** — including bypassing rate limits, CAPTCHAs, or bot protection
- **Extract personal data** from web applications for surveillance, profiling, or unauthorized data collection
- **Automate actions on accounts you do not own** — including login, purchasing, form submission, or any interaction requiring user authentication
- **Conduct denial-of-service attacks** — repeatedly opening connections or firing CDP commands to degrade service
- **Circumvent paywalls or access controls** — using the accessibility tree to extract content behind authentication barriers you are not authorized to access
- **Competitive scraping** in violation of a site's Terms of Service or robots.txt directives
- **Generate selectors to assist in automated attacks** — including credential stuffing, account enumeration, or automated fraud

---

## Chrome Process Ownership

This tool connects to Chrome via the Chrome DevTools Protocol but does **not** control the Chrome process lifecycle. The `browser_disconnect` tool calls `browser.disconnect()`, which closes the WebSocket connection only — it does not kill the Chrome process. Users are responsible for managing their own Chrome instances.

---

## Data Handling

- **No data leaves your machine.** All CDP communication is local (WebSocket to `localhost:9222`).
- **No telemetry.** This server collects no usage data, analytics, or crash reports.
- **No persistence.** The accessibility tree is read at call time and returned to Claude; nothing is stored to disk by this server.
- **Claude Desktop** may log conversation history according to Anthropic's own privacy policy, which is separate from this tool.

---

## Browser Credentials and Sensitive Data

If you connect to a Chrome session that is logged into personal or work accounts, the accessibility tree may contain sensitive information visible on screen (names, emails, account numbers, messages). Be mindful of:

- Which pages are open in the connected Chrome session
- Whether Claude conversation logs are synced or stored
- Whether you are operating on a shared machine

**Recommendation:** Use `--user-data-dir=/tmp/chrome-debug-profile` to connect a clean, isolated Chrome profile without access to your saved passwords or sessions.

---

## Security Considerations

### Remote Debugging Port

Port `9222` with `--remote-debugging-port` grants **full programmatic control** of the Chrome instance — equivalent to having a human at the keyboard. Do not:

- Expose port 9222 to a network interface (bind to localhost only, which is the default)
- Leave a debugging Chrome instance running unattended
- Share your WebSocket debugger URL with untrusted parties

### MCP Server Trust

The MCP server runs as a local Node.js process with the same OS permissions as your user account. It can read the accessibility tree of any page open in the connected browser. Only connect to MCP servers from sources you trust.

---

## Responsible Disclosure

If you discover a security vulnerability in this project, please open a GitHub issue with the label `security` or contact the maintainer directly. Do not publish exploit details publicly before a fix is available.

---

## Contributor Responsibilities

Contributors to this project agree to:

- Not introduce features that facilitate unauthorized access, data harvesting, or automated attacks
- Maintain the principle that the tool operates on user-owned or user-authorized browser sessions only
- Review all pull requests with the above prohibited uses in mind
- Follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

---

## Compliance

Users are responsible for ensuring their use of this tool complies with:

- Applicable local, national, and international laws
- The Terms of Service of any web applications being inspected
- Their organization's security and acceptable use policies
- GDPR, CCPA, and other applicable data protection regulations when handling any data retrieved through the accessibility tree

---

## Disclaimer

This tool is provided "as is" without warranty of any kind. The maintainers are not liable for misuse, damages, or legal consequences arising from use of this software outside its intended purpose. See [LICENSE](LICENSE) for full terms.

---

*Last updated: 2026*
