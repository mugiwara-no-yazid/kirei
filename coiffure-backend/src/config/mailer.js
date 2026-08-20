const { Resend } = require('resend');

if (!process.env.RESEND_API_KEY) {
  console.warn('[mailer] RESEND_API_KEY manquant — les e-mails ne partiront pas.');
}

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = resend;