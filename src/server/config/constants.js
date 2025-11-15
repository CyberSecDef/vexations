/**
 * Server configuration
 */

module.exports = {
  HOST: process.env.HOST || "0.0.0.0",
  PORT: Number(process.env.PORT) || 5000,
  PING_INTERVAL_MS: 20_000,
  NODE_ENV: process.env.NODE_ENV || 'production',
};
