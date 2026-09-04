const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Sends an email via SMTP, matching Python's send_email_notification:
 *  - reads SMTP_HOST/PORT/USER/PASS from env on EVERY call (not cached)
 *  - if host or user is unset, logs a warning and returns (no throw)
 *  - start_tls=True equivalent: secure:false + requireTLS:true
 *  - swallows ALL errors — never rethrows, so callers (the scheduler) can
 *    unconditionally mark things as "notified" regardless of send success
 */
async function sendEmailNotification(toEmail, subject, body) {
  try {
    const smtpHost = process.env.SMTP_HOST || '';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';

    if (!smtpHost || !smtpUser) {
      logger.warn('SMTP not configured, skipping email');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      requireTLS: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: smtpUser,
      to: toEmail,
      subject,
      text: body,
    });

    logger.info(`Email sent to ${toEmail}`);
  } catch (err) {
    logger.error(`Failed to send email: ${err && err.message ? err.message : err}`);
  }
}

module.exports = { sendEmailNotification };
