const sgMail = require('../config/mailer');

const FROM = process.env.EMAIL_FROM || 'tonsalon@gmail.com'; // doit être l'adresse vérifiée sur SendGrid

async function sendMail({ to, subject, html }) {
  try {
    await sgMail.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[mailer] échec envoi e-mail:', err.response?.body || err.message);
  }
}

function formatDateFr(date) {
  return new Date(date).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

// Notifie l'admin qu'une nouvelle demande de RDV est arrivée
async function notifyAdminNouvelleDemande(adminEmail, rdv) {
  const lieuLigne =
    rdv.lieuPrestation === 'DOMICILE'
      ? `<li><strong>Lieu :</strong> À domicile — ${rdv.adresseDomicile}</li>`
      : `<li><strong>Lieu :</strong> Au salon</li>`;
  const praticienLigne = rdv.assistant
    ? `<li><strong>Praticien souhaité :</strong> ${rdv.assistant.prenom} ${rdv.assistant.nom}</li>`
    : `<li><strong>Praticien souhaité :</strong> Vous (coiffeur)</li>`;

  await sendMail({
    to: adminEmail,
    subject: `Nouvelle demande de rendez-vous — ${rdv.client.prenom} ${rdv.client.nom}`,
    html: `
      <p>Nouvelle demande de rendez-vous reçue :</p>
      <ul>
        <li><strong>Client :</strong> ${rdv.client.prenom} ${rdv.client.nom} (${rdv.client.telephone})</li>
        <li><strong>Coupe :</strong> ${rdv.coupe.nom}</li>
        ${praticienLigne}
        ${lieuLigne}
        <li><strong>Date :</strong> ${formatDateFr(rdv.dateHeureDebut)}</li>
        <li><strong>Tarif :</strong> ${rdv.tarifApplique} FCFA</li>
      </ul>
      <p>Connectez-vous à l'espace admin pour valider ou refuser.</p>
    `,
  });
}

// Notifie le client de l'accusé de réception de sa demande
async function notifyClientAccuseReception(rdv) {
  await sendMail({
    to: rdv.client.email,
    subject: 'Votre demande de rendez-vous a bien été reçue',
    html: `
      <p>Bonjour ${rdv.client.prenom},</p>
      <p>Nous avons bien reçu votre demande de rendez-vous pour <strong>${rdv.coupe.nom}</strong>
      le <strong>${formatDateFr(rdv.dateHeureDebut)}</strong>.</p>
      <p>Vous recevrez un e-mail dès que le coiffeur aura validé ou refusé votre demande.</p>
    `,
  });
}

// Notifie le client de l'acceptation
async function notifyClientAcceptation(rdv) {
  const lieuTexte = rdv.lieuPrestation === 'DOMICILE' ? `à votre domicile (${rdv.adresseDomicile})` : 'au salon';
  await sendMail({
    to: rdv.client.email,
    subject: 'Votre rendez-vous a été accepté',
    html: `
      <p>Bonjour ${rdv.client.prenom},</p>
      <p>Votre rendez-vous a été <strong>accepté</strong> pour le
      <strong>${formatDateFr(rdv.dateHeureDebut)}</strong> (${rdv.coupe.nom}), ${lieuTexte}.</p>
      <p>À bientôt !</p>
    `,
  });
}

// Notifie le client du refus
async function notifyClientRefus(rdv) {
  await sendMail({
    to: rdv.client.email,
    subject: 'Votre demande de rendez-vous a été refusée',
    html: `
      <p>Bonjour ${rdv.client.prenom},</p>
      <p>Nous sommes désolés, votre demande de rendez-vous du
      ${formatDateFr(rdv.dateHeureDebut)} n'a pas pu être acceptée.</p>
      <p>N'hésitez pas à choisir un autre créneau.</p>
    `,
  });
}

// Notifie le client de l'annulation
async function notifyClientAnnulation(rdv) {
  await sendMail({
    to: rdv.client.email,
    subject: 'Votre rendez-vous a été annulé',
    html: `
      <p>Bonjour ${rdv.client.prenom},</p>
      <p>Votre rendez-vous du ${formatDateFr(rdv.dateHeureDebut)} a été annulé.</p>
    `,
  });
}

module.exports = {
  notifyAdminNouvelleDemande,
  notifyClientAccuseReception,
  notifyClientAcceptation,
  notifyClientRefus,
  notifyClientAnnulation,
};
