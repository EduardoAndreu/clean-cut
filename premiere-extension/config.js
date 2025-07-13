/**
 * Configuration constants for the Clean-Cut Premiere Pro extension
 * These values should be kept in sync with src/shared/config.ts
 */

// WebSocket configuration
const WEBSOCKET_CONFIG = {
  PORT: 8085
}

// Export for use in other extension files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WEBSOCKET_CONFIG }
}
