const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true pour le port 465, false pour 587 (STARTTLS)
  auth: {
    user: process.env.BREVO_SMTP_USER, // ton login SMTP Brevo (souvent ton email de compte)
    pass: process.env.BREVO_SMTP_KEY,  // ta clé SMTP Brevo (pas ton mot de passe de compte)
  },
});

// Optionnel mais recommandé : vérifie la connexion au démarrage
transporter.verify((err, success) => {
  if (err) {
    console.error('[mailer] connexion SMTP Brevo échouée:', err.message);
  } else {
    console.log('[mailer] connecté à Brevo SMTP ✅');
  }
});

module.exports = transporter;