const { MongoClient } = require('mongodb');
const { MONGO_URL, DB_NAME } = require('./env');
const logger = require('../utils/logger');

let client = null;
let db = null;

async function connect() {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected yet — call connect() first');
  return db;
}

function col(name) {
  return getDb().collection(name);
}

const collections = {
  users: () => col('users'),
  contacts: () => col('contacts'),
  notes: () => col('notes'),
  followups: () => col('followups'),
  meetings: () => col('meetings'),
  activityLogs: () => col('activity_logs'),
  demos: () => col('demos'),
};

/**
 * Adds indexes that are purely internal-implementation-detail and do not
 * change any query filter, response shape, or observable behavior.
 *
 * Deliberately NOT added: a unique index on contacts.phone. The Excel import
 * path synthesizes phones like "contact_7" from a per-run row counter, which
 * collide across separate import runs — a unique index would turn that into
 * a 500 on the second import of a phone-less file.
 */
async function ensureIndexes() {
  const database = getDb();

  await database.collection('users').createIndex({ id: 1 });
  await database.collection('users').createIndex({ email: 1 }); // non-unique on purpose

  await database.collection('contacts').createIndex({ id: 1 });
  await database.collection('contacts').createIndex({ phone: 1 });
  await database.collection('contacts').createIndex({ status: 1 });
  await database.collection('contacts').createIndex({ created_at: -1 });

  await database.collection('notes').createIndex({ id: 1 });
  await database.collection('notes').createIndex({ contact_id: 1 });

  await database.collection('followups').createIndex({ id: 1 });
  await database.collection('followups').createIndex({ user_id: 1, status: 1 });
  await database.collection('followups').createIndex({ follow_up_date: 1 });
  await database.collection('followups').createIndex({ contact_id: 1 });

  await database.collection('demos').createIndex({ id: 1 });
  await database.collection('demos').createIndex({ user_id: 1 });
  await database.collection('demos').createIndex({ contact_id: 1 });
  await database.collection('demos').createIndex({ given_at: 1 });

  await database.collection('activity_logs').createIndex({ id: 1 });
  await database.collection('activity_logs').createIndex({ user_id: 1 });
  await database.collection('activity_logs').createIndex({ timestamp: -1 });

  await database.collection('meetings').createIndex({ id: 1 });
  await database.collection('meetings').createIndex({ user_id: 1 });
  await database.collection('meetings').createIndex({ date: 1 });

  logger.info('MongoDB indexes ensured');
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, getDb, collections, ensureIndexes, close };
