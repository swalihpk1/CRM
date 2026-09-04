const { collections } = require('../config/db');
const { toPythonIso } = require('../utils/dates');
const { sendEmailNotification } = require('../utils/email');
const logger = require('../utils/logger');
const { FOLLOWUP_INTERVAL_MS } = require('../config/env');

let running = false;
let intervalHandle = null;

/**
 * Mirrors Python's check_followup_alerts(): finds pending, not-yet-notified
 * followups due within 30 minutes, emails each user, and unconditionally
 * marks them notified regardless of send success (sendEmailNotification
 * never throws). Entire body wrapped in try/catch that only logs, matching
 * the source's `except Exception as e: logging.error(...)`.
 */
async function checkFollowupAlerts() {
  try {
    const now = new Date();
    const alertWindow = new Date(now.getTime() + 30 * 60 * 1000);
    const alertWindowIso = toPythonIso(alertWindow);

    const followups = await collections.followups().find(
      {
        status: 'pending',
        notified: false,
        follow_up_date: { $lte: alertWindowIso },
      },
      { projection: { _id: 0 } }
    ).toArray();

    for (const followup of followups) {
      const contact = await collections.contacts().findOne(
        { id: followup.contact_id },
        { projection: { _id: 0 } }
      );
      if (!contact) continue;

      const contactName = (contact.data && contact.data.name) || contact.phone;

      const subject = `Follow-up Reminder: ${contactName}`;
      const body = `Hello,

This is a reminder for your follow-up with:

Contact: ${contactName}
Phone: ${contact.phone}
Scheduled: ${followup.follow_up_date}
Notes: ${followup.notes || 'N/A'}

Best regards,
SmartCRM`;

      await sendEmailNotification(followup.user_email, subject, body);

      await collections.followups().updateOne({ id: followup.id }, { $set: { notified: true } });

      logger.info(`Sent follow-up alert for contact ${contactName}`);
    }
  } catch (err) {
    logger.error(`Error in follow-up alert check: ${err && err.message ? err.message : err}`);
  }
}

async function tick() {
  if (running) return; // re-entrancy guard, mirrors APScheduler's non-overlap default
  running = true;
  try {
    await checkFollowupAlerts();
  } finally {
    running = false;
  }
}

function start() {
  intervalHandle = setInterval(tick, FOLLOWUP_INTERVAL_MS);
  logger.info('Follow-up alert scheduler started');
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
}

module.exports = { checkFollowupAlerts, start, stop };
