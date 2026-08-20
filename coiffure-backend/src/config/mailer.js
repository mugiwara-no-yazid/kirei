const sgMail = require('@sendgrid/mail');

if (!process.env.SENDGRID_API_KEY) {
  console.warn('[mailer] SENDGRID_API_KEY manquant — les e-mails ne partiront pas.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

module.exports = sgMail;