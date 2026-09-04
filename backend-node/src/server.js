const { HOST, PORT } = require('./config/env');
const db = require('./config/db');
const app = require('./app');
const followupAlerts = require('./jobs/followupAlerts');
const logger = require('./utils/logger');

let server = null;

async function main() {
  await db.connect();
  await db.ensureIndexes();

  server = app.listen(PORT, HOST, () => {
    logger.info(`SmartCRM Node backend listening on ${HOST}:${PORT}`);
  });

  followupAlerts.start();
}

async function shutdown() {
  logger.info('Shutting down...');
  followupAlerts.stop();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  logger.error(`Fatal startup error: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
