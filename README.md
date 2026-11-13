# Kirei 綺麗

Plateforme de réservation en ligne pour un salon de coiffure (Cotonou, Bénin). Les clients choisissent une coupe, un praticien et un créneau ; le coiffeur valide les demandes, suit son chiffre d'affaires et gère son équipe depuis un back-office.

## Fonctionnalités

**Côté client (public)**
- Catalogue des coupes avec photos et prix (au salon, ou à domicile pour certaines coupes)
- Prise de rendez-vous en plusieurs étapes : coupe → praticien → date/créneau → coordonnées
- Créneaux calculés en temps réel (horaires, congés, rendez-vous déjà pris)
- E-mails automatiques : accusé de réception, puis acceptation / refus / annulation

**Back-office coiffeur (admin)**
- Validation, refus, annulation et clôture des rendez-vous
- Gestion des coupes (3 photos max), des assistants, des clients
- Horaires d'ouverture hebdomadaires et congés
- Tableau de bord du chiffre d'affaires (jour / semaine / mois / année / total) et coupes populaires
- Export des rapports financiers en PDF et Excel

**Espace assistant**
- Connexion dédiée, consultation de ses propres rendez-vous

## Stack

| Partie | Technologies |
|---|---|
| Backend | Node.js 22, Express 4, Prisma 5, PostgreSQL 16 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Fichiers / exports | Multer (photos), PDFKit, ExcelJS |
| E-mails | SendGrid |
| Sécurité | Helmet, CORS, express-rate-limit |
| Frontend | React 19, Vite, Tailwind CSS 3, React Router 7, Axios |
| Déploiement | Docker, Docker Compose, Nginx |

## Structure du projet

```
kirei/
├── docker-compose.yml        # postgres + backend + frontend
├── coiffure-backend/         # API REST
│   ├── prisma/               # schema.prisma, migrations, seed.js
│   └── src/
│       ├── app.js / server.js
│       ├── routes/           # public, auth, assistant, admin
│       ├── controllers/
│       ├── middleware/       # auth JWT, upload, gestion d'erreurs
│       ├── services/         # disponibilités, e-mails
│       └── utils/            # templates d'e-mails
├── kirei-frontend/           # application React
│   └── src/
│       ├── pages/            # public/, admin/, assistant/
│       ├── layouts/, components/, context/
│       └── api/              # appels à l'API
└── docs/
    └── API.md                # documentation complète de l'API
```

## Prérequis

- Node.js 22+ et npm
- PostgreSQL 16 (ou Docker)
- Un compte [SendGrid](https://sendgrid.com) pour l'envoi d'e-mails (facultatif en développement : sans clé, les e-mails ne partent pas mais l'API fonctionne)

## Démarrage en local (sans Docker)

### 1. Backend

```bash
cd coiffure-backend
npm install
cp .env.example .env        # puis renseigner les valeurs (voir tableau ci-dessous)

npx prisma migrate deploy   # applique les migrations
npm run seed                # crée le salon, les horaires, l'admin et un assistant de démo
npm run dev                 # http://localhost:4000
```

Vérification : `curl http://localhost:4000/api/health`

### 2. Frontend

```bash
cd kirei-frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm run dev                 # http://localhost:5173
```

## Démarrage avec Docker

```bash
cp coiffure-backend/.env.example coiffure-backend/.env
# Dans ce .env, mettre pour Docker :
#   PORT=3000
#   DATABASE_URL="postgresql://postgres:postgres@postgres:5432/kirei?schema=public"
#   FRONTEND_URL=http://localhost:8080

docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run seed
```

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API | http://localhost:3000/api |
| PostgreSQL | localhost:5432 (`postgres` / `postgres`, base `kirei`) |

> L'URL de l'API est injectée dans le frontend **au moment du build** (`VITE_API_URL`, défaut `http://localhost:3000`). Pour la changer : `VITE_API_URL=https://api.mondomaine.com docker compose build frontend`.

## Variables d'environnement (backend)

| Variable | Description | Exemple |
|---|---|---|
| `PORT` | Port d'écoute (4000 par défaut ; 3000 pour Docker) | `4000` |
| `NODE_ENV` | `development` ou `production` | `development` |
| `FRONTEND_URL` | Origine autorisée par CORS | `http://localhost:5173` |
| `DATABASE_URL` | Connexion PostgreSQL | `postgresql://user:password@localhost:5432/coiffure_db?schema=public` |
| `JWT_SECRET` | Secret de signature des tokens (long et aléatoire) | |
| `JWT_EXPIRES_IN` | Durée de validité des tokens | `8h` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Compte admin créé par le seed | `admin@salon.com` / `ChangeMoi123!` |
| `SENDGRID_API_KEY` | Clé API SendGrid | `SG.xxxx` |
| `EMAIL_FROM` | Expéditeur (adresse vérifiée sur SendGrid) | `"Kirei <no-reply@salon.com>"` |

Les variables `PAYMENT_PROVIDER`, `KKIAPAY_*` et `FEDAPAY_API_KEY` présentes dans `.env.example` sont réservées à un futur paiement Mobile Money : elles ne sont pas encore utilisées.

## Comptes créés par le seed

| Rôle | Identifiants | Connexion |
|---|---|---|
| Admin | `ADMIN_EMAIL` / `ADMIN_PASSWORD` du `.env` | `/admin/login` |
| Assistant (démo) | `assistant@salon.com` / `Assistant123!` | `/assistant/login` |

⚠️ **Changez ces mots de passe avant toute mise en production** (et supprimez l'assistant de démo).

## Pages du frontend

| Route | Accès | Description |
|---|---|---|
| `/` | public | Accueil |
| `/coupes` | public | Catalogue |
| `/reserver` | public | Prise de rendez-vous |
| `/admin/login` | public | Connexion admin |
| `/admin` | admin | Tableau de bord |
| `/admin/rendez-vous` | admin | Gestion des rendez-vous |
| `/admin/coupes` | admin | Coupes et photos |
| `/admin/assistants` | admin | Équipe |
| `/admin/clients` | admin | Clients |
| `/admin/rapports` | admin | Exports PDF / Excel |
| `/admin/parametres` | admin | Salon, horaires, congés |
| `/assistant/login` | public | Connexion assistant |
| `/assistant` | assistant | Mes rendez-vous |

## Cycle de vie d'un rendez-vous

```
EN_ATTENTE ──valider──▶ VALIDE ──terminer──▶ TERMINE   (compte dans le CA)
    │                     │
    ├──refuser──▶ REFUSE  └──annuler──▶ ANNULE
    └──annuler──▶ ANNULE
```

Le chiffre d'affaires est calculé **uniquement** sur les rendez-vous `TERMINE`, à partir du `tarifApplique` figé à la réservation.

## Documentation de l'API

Toutes les routes, leurs paramètres, exemples `curl` et réponses sont décrits dans **[docs/API.md](docs/API.md)**.

## Scripts utiles (backend)

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur avec rechargement (nodemon) |
| `npm start` | Serveur en production |
| `npm run prisma:migrate` | Crée/applique une migration en développement |
| `npm run prisma:studio` | Interface graphique de la base |
| `npm run seed` | Données initiales |

## Notes pour la production

- Définir un `JWT_SECRET` long et aléatoire, et restreindre `FRONTEND_URL` à votre domaine.
- Les photos sont stockées dans `coiffure-backend/uploads/coupes/` : montez ce dossier comme **volume Docker**, sinon elles sont perdues à chaque reconstruction du conteneur.
- Mettre l'API derrière HTTPS (reverse proxy) ; les URLs de photos sont construites avec le protocole de la requête.
- Ne jamais committer le fichier `.env` (déjà dans `.gitignore`).
