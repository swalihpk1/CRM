const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const MONGO_URL = required('MONGO_URL');
const DB_NAME = required('DB_NAME');

// Matches Python: JWT_SECRET falls back to this exact literal string if unset.
// Kept identical on purpose so tokens minted by the old Python backend remain
// valid against this server during a cutover.
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Python hardcoded this as a module constant and ignored the JWT_ALGORITHM
// env var despite it existing in .env — replicate that (do not read env var).
const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRATION_HOURS = 24;

const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',');

// SMTP_* are intentionally NOT read here — utils/email.js re-reads
// process.env on every call, matching Python's behavior exactly.

// Python's `if __name__ == "__main__"` block hardcoded uvicorn to 0.0.0.0:8000
// and ignored HOST/PORT despite them being present in .env. This port
// deliberately honors HOST/PORT (documented as the one intentional deviation).
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8000', 10);

// Testing-only override for the follow-up alert scheduler interval.
const FOLLOWUP_INTERVAL_MS = parseInt(process.env.FOLLOWUP_INTERVAL_MS || String(5 * 60 * 1000), 10);

module.exports = {
  MONGO_URL,
  DB_NAME,
  JWT_SECRET,
  JWT_ALGORITHM,
  JWT_EXPIRATION_HOURS,
  CORS_ORIGINS,
  HOST,
  PORT,
  FOLLOWUP_INTERVAL_MS,
};
