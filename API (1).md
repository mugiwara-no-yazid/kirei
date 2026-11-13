# Documentation de l'API Kirei

API REST (Node.js / Express / Prisma) de la plateforme de réservation du salon Kirei.

- **URL de base** : `http://localhost:4000/api` en local (`http://localhost:3000/api` avec Docker, voir le README)
- **Format** : JSON (`Content-Type: application/json`), sauf upload de photo (`multipart/form-data`) et exports (PDF / Excel)
- **Fichiers statiques** : les photos des coupes sont servies sur `/uploads/coupes/<fichier>` (hors préfixe `/api`)

## Sommaire

1. [Conventions](#1-conventions)
2. [Authentification](#2-authentification)
3. [Routes publiques](#3-routes-publiques)
4. [Auth admin](#4-auth-admin)
5. [Auth assistant](#5-auth-assistant)
6. [Routes admin](#6-routes-admin)
7. [Routes assistant](#7-routes-assistant)
8. [Modèles de données](#8-modèles-de-données)
9. [Cycle de vie d'un rendez-vous](#9-cycle-de-vie-dun-rendez-vous)
10. [Codes d'erreur](#10-codes-derreur)

---

## 1. Conventions

### Identifiants et dates
- Tous les `id` sont des **UUID** (chaînes).
- Les dates sont en **ISO 8601** (`2026-08-10T10:00:00.000Z`). Seul le paramètre `date` de `/creneaux-disponibles` utilise `YYYY-MM-DD`.
- Les montants sont des **entiers en FCFA**.

### Format des erreurs
Toutes les erreurs renvoient le même format :

```json
{ "error": "Message lisible décrivant le problème." }
```

### Rate limiting
| Cible | Limite | Fenêtre |
|---|---|---|
| `POST /api/auth/login` et `POST /api/assistant-auth/login` | 20 requêtes | 15 min |
| `/api/rendez-vous` (création publique) | 30 requêtes | 15 min |

Dépassement → `429` avec `{ "error": "Trop de tentatives, réessayez plus tard." }` (ou `"Trop de demandes, …"` pour les rendez-vous).

### Santé du serveur

```
GET /api/health
```
```json
{ "status": "ok", "date": "2026-08-20T16:36:00.000Z" }
```

---

## 2. Authentification

Deux types de comptes, avec **deux tokens JWT distincts** :

| Compte | Login | Middleware | Payload du token |
|---|---|---|---|
| **Admin** (coiffeur) | `POST /api/auth/login` | routes `/api/admin/*` | `{ id, email }` |
| **Assistant** | `POST /api/assistant-auth/login` | routes `/api/assistant/*` | `{ id, email, role: "assistant" }` |

Le token est valable `JWT_EXPIRES_IN` (par défaut **8h**). Il doit être envoyé dans l'en-tête :

```
Authorization: Bearer <token>
```

Réponses d'erreur d'authentification :

| Statut | Cas |
|---|---|
| `401` | En-tête absent / mal formé : `"Authentification requise."` |
| `401` | Token invalide ou expiré : `"Session invalide ou expirée."` |
| `403` | Token valide mais pas du rôle `assistant` sur une route assistant : `"Accès réservé aux assistants."` |

---

## 3. Routes publiques

Aucune authentification requise.

### `GET /api/salon`
Infos de la vitrine : salon + horaires hebdomadaires.

**Réponse `200`**
```json
{
  "id": "b1c2…",
  "nomEnseigne": "Kirei",
  "adresse": "Cotonou, Bénin",
  "telephone": "+229 00 00 00 00",
  "email": "contact@kirei.bj",
  "logoUrl": null,
  "dureeCreneauMinutes": 30,
  "createdAt": "2026-08-06T09:00:00.000Z",
  "updatedAt": "2026-08-06T09:00:00.000Z",
  "horaires": [
    { "id": "…", "salonId": "…", "jourSemaine": 1, "heureDebut": "08:00", "heureFin": "18:00", "ferme": false }
  ]
}
```
`jourSemaine` : `0` = dimanche … `6` = samedi.
**Erreur** : `404` `"Salon non configuré."`

---

### `GET /api/coupes`
Catalogue des coupes, triées de la plus récente à la plus ancienne, avec leurs photos.

| Query | Type | Description |
|---|---|---|
| `actif` | `true` \| `false` | Optionnel. Filtre sur l'état actif. **Sans ce paramètre, toutes les coupes sont renvoyées, y compris les inactives** — le front public doit envoyer `?actif=true`. |

**Réponse `200`**
```json
[
  {
    "id": "7f3a…",
    "nom": "Dégradé américain",
    "description": "Dégradé net, finition rasoir.",
    "prixFcfa": 3000,
    "domicileDisponible": true,
    "prixDomicileFcfa": 5000,
    "actif": true,
    "createdAt": "2026-08-06T09:00:00.000Z",
    "updatedAt": "2026-08-06T09:00:00.000Z",
    "photos": [
      { "id": "…", "coupeId": "7f3a…", "url": "http://localhost:4000/uploads/coupes/1723…-ab12.jpg", "position": 0, "createdAt": "…" }
    ]
  }
]
```

### `GET /api/coupes/:id`
Détail d'une coupe (même objet que ci-dessus).
**Erreur** : `404` `"Coupe introuvable."`

---

### `GET /api/assistants`
Assistants **actifs**, parmi lesquels le client peut choisir son praticien (tri par prénom).

**Réponse `200`**
```json
[ { "id": "9d1e…", "nom": "Kpadonou", "prenom": "Fabrice" } ]
```

---

### `GET /api/creneaux-disponibles`
Créneaux libres pour une date. Tient compte des horaires du salon, des indisponibilités (congés), des rendez-vous `EN_ATTENTE` / `VALIDE` / `TERMINE` du praticien, et exclut les créneaux déjà passés.

| Query | Obligatoire | Description |
|---|---|---|
| `date` | oui | `YYYY-MM-DD` |
| `assistantId` | non | Créneaux de cet assistant. **Absent = créneaux du coiffeur lui-même.** |

**Exemple**
```bash
curl "http://localhost:4000/api/creneaux-disponibles?date=2026-08-10&assistantId=9d1e…"
```

**Réponse `200`**
```json
[
  { "debut": "2026-08-10T08:00:00.000Z", "fin": "2026-08-10T08:30:00.000Z" },
  { "debut": "2026-08-10T08:30:00.000Z", "fin": "2026-08-10T09:00:00.000Z" }
]
```
Tableau vide si le salon est fermé ce jour-là ou s'il n'y a plus de créneau.
**Erreur** : `400` `"Le paramètre \"date\" (YYYY-MM-DD) est requis."`

---

### `POST /api/rendez-vous`
Création d'une demande de rendez-vous par le client. Le rendez-vous est créé au statut `EN_ATTENTE`. Un e-mail est envoyé à l'admin (si l'e-mail du salon est renseigné) et un accusé de réception au client.

**Corps**

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `nom` | string | oui | |
| `prenom` | string | oui | |
| `email` | string | oui | |
| `telephone` | string | oui | |
| `adresse` | string | non | Adresse du client (fiche client) |
| `coupeId` | uuid | oui | La coupe doit exister et être `actif` |
| `dateHeureDebut` | ISO 8601 | oui | Doit être dans le futur |
| `lieuPrestation` | `SALON` \| `DOMICILE` | non | Défaut `SALON` |
| `adresseDomicile` | string | si `DOMICILE` | Adresse de la prestation |
| `assistantId` | uuid | non | Assistant actif souhaité. Absent = le coiffeur. |

**Règles**
- `dateHeureFin` = début + `dureeCreneauMinutes` du salon.
- En `SALON`, `tarifApplique` = `prixFcfa` de la coupe. En `DOMICILE`, `tarifApplique` = `prixDomicileFcfa` (la coupe doit avoir `domicileDisponible = true`).
- Le prix est **figé** dans `tarifApplique` à la réservation.
- Un nouveau client est créé à chaque demande (pas de dédoublonnage).

**Exemple**
```bash
curl -X POST http://localhost:4000/api/rendez-vous \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Doe", "prenom": "Jean",
    "email": "jean@example.com", "telephone": "+22900000000",
    "coupeId": "7f3a…",
    "dateHeureDebut": "2026-08-10T10:00:00.000Z",
    "lieuPrestation": "DOMICILE",
    "adresseDomicile": "Quartier Haie Vive, Cotonou"
  }'
```

**Réponse `201`**
```json
{
  "id": "c0a8…",
  "clientId": "…",
  "coupeId": "7f3a…",
  "assistantId": null,
  "tarifApplique": 5000,
  "lieuPrestation": "DOMICILE",
  "adresseDomicile": "Quartier Haie Vive, Cotonou",
  "dateHeureDebut": "2026-08-10T10:00:00.000Z",
  "dateHeureFin": "2026-08-10T10:30:00.000Z",
  "statut": "EN_ATTENTE",
  "notesAdmin": null,
  "dateCreation": "2026-08-09T12:00:00.000Z",
  "updatedAt": "2026-08-09T12:00:00.000Z",
  "client": { "id": "…", "nom": "Doe", "prenom": "Jean", "email": "jean@example.com", "telephone": "+22900000000", "adresse": null, "createdAt": "…" },
  "coupe": { "id": "7f3a…", "nom": "Dégradé américain", "prixFcfa": 3000, "…": "…" },
  "assistant": null
}
```

**Erreurs**
| Statut | Message |
|---|---|
| `400` | `nom, prenom, email, telephone, coupeId et dateHeureDebut sont obligatoires.` |
| `400` | `Date de rendez-vous invalide ou déjà passée.` |
| `400` | `Cette coupe n'est pas proposée à domicile actuellement.` |
| `400` | `Une adresse est requise pour une prestation à domicile.` |
| `404` | `Coupe introuvable ou indisponible.` |
| `404` | `Assistant introuvable ou indisponible.` |
| `409` | `Ce créneau vient d'être réservé, merci d'en choisir un autre.` |
| `429` | Rate limit |
| `500` | `Salon non configuré.` |

---

## 4. Auth admin

### `POST /api/auth/login`
**Corps** : `{ "email": "admin@salon.com", "password": "ChangeMoi123!" }`

**Réponse `200`**
```json
{
  "token": "eyJhbGciOi…",
  "admin": { "id": "…", "email": "admin@salon.com", "nom": "Coiffeur Admin" }
}
```
**Erreurs** : `400` `"Email et mot de passe requis."` · `401` `"Identifiants invalides."`

### `GET /api/auth/me` 🔒 admin
```json
{ "id": "…", "email": "admin@salon.com", "nom": "Coiffeur Admin", "createdAt": "…" }
```

### `POST /api/auth/change-password` 🔒 admin
**Corps** : `{ "currentPassword": "…", "newPassword": "…" }` (8 caractères minimum)

**Réponse `200`** : `{ "message": "Mot de passe mis à jour." }`
**Erreurs** : `400` (champ manquant / mot de passe trop court) · `401` `"Mot de passe actuel incorrect."`

---

## 5. Auth assistant

### `POST /api/assistant-auth/login`
**Corps** : `{ "email": "assistant@salon.com", "password": "Assistant123!" }`

**Réponse `200`**
```json
{
  "token": "eyJhbGciOi…",
  "assistant": { "id": "…", "nom": "Kpadonou", "prenom": "Fabrice", "email": "assistant@salon.com" }
}
```
**Erreurs** : `400` · `401` `"Identifiants invalides."` (aussi renvoyé si le compte est désactivé)

### `GET /api/assistant-auth/me` 🔒 assistant
```json
{ "id": "…", "nom": "Kpadonou", "prenom": "Fabrice", "email": "…", "telephone": "+229 00 00 00 01", "createdAt": "…" }
```
**Erreur** : `404` `"Assistant introuvable."`

### `POST /api/assistant-auth/change-password` 🔒 assistant
Identique à la version admin. Réponse `200` : `{ "message": "Mot de passe mis à jour." }`

---

## 6. Routes admin

🔒 Toutes les routes `/api/admin/*` exigent `Authorization: Bearer <token admin>`.

### 6.1 Coupes

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/coupes` | Liste (même format que le public, filtre `?actif=`) |
| GET | `/api/admin/coupes/:id` | Détail |
| POST | `/api/admin/coupes` | Créer (**sans photos**) |
| PUT | `/api/admin/coupes/:id` | Modifier les infos (**sans photos**) |
| DELETE | `/api/admin/coupes/:id` | Supprimer (photos incluses) |

#### `POST /api/admin/coupes`
Corps **JSON** :

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `nom` | string | oui | |
| `prixFcfa` | number | oui | Prix au salon |
| `description` | string | non | |
| `domicileDisponible` | boolean | non | Défaut `false` |
| `prixDomicileFcfa` | number | si `domicileDisponible` | Doit être > 0 |

```bash
curl -X POST http://localhost:4000/api/admin/coupes \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "nom": "Dégradé américain", "prixFcfa": 3000, "domicileDisponible": true, "prixDomicileFcfa": 5000 }'
```
**Réponse `201`** : l'objet coupe avec `"photos": []`.
**Erreurs** : `400` `"Le nom et le prix sont obligatoires."` · `400` `"Un prix à domicile valide est requis si le service à domicile est activé pour cette coupe."`

#### `PUT /api/admin/coupes/:id`
Mêmes champs, tous optionnels, plus `actif` (boolean). Seuls les champs envoyés sont modifiés. Envoyer `prixDomicileFcfa: ""` remet le prix à domicile à `null`.
**Réponse `200`** : la coupe mise à jour. **Erreurs** : `404` · `400` (règle domicile).

#### `DELETE /api/admin/coupes/:id`
**Réponse `200`** : `{ "message": "Coupe supprimée." }`
**Erreurs** : `404` · `409` `"Impossible de supprimer : des rendez-vous en cours utilisent cette coupe. Désactivez-la plutôt."` (rendez-vous `EN_ATTENTE` ou `VALIDE`).
> Une coupe ayant un historique de rendez-vous terminés/annulés ne peut pas non plus être supprimée côté base (clé étrangère) : privilégier `actif: false`.

### 6.2 Photos des coupes

Maximum **3 photos par coupe**, JPG / PNG / WEBP, **5 Mo** max par fichier. Ajout et suppression sont indépendants (une photo à la fois).

#### `POST /api/admin/coupes/:id/photos`
`multipart/form-data`, champ **`photo`** (un seul fichier).

```bash
curl -X POST http://localhost:4000/api/admin/coupes/7f3a…/photos \
  -H "Authorization: Bearer <token>" \
  -F "photo=@photo1.jpg"
```
**Réponse `201`**
```json
{ "id": "…", "coupeId": "7f3a…", "url": "http://localhost:4000/uploads/coupes/1723…-ab12.jpg", "position": 0, "createdAt": "…" }
```
**Erreurs** : `404` `"Coupe introuvable."` · `400` `"Aucun fichier reçu (champ \"photo\" attendu)."` · `409` `"Maximum 3 photos par coupe. Supprimez-en une d'abord."`
Un format non autorisé (ou un fichier trop gros) est refusé par le middleware d'upload et renvoie une erreur `500` avec le message de Multer.

#### `DELETE /api/admin/coupes/:id/photos/:photoId`
**Réponse `200`** : `{ "message": "Photo supprimée." }` · **Erreur** : `404` `"Photo introuvable pour cette coupe."`

### 6.3 Rendez-vous

#### `GET /api/admin/rendez-vous`
Liste triée par date de début croissante, avec `client`, `coupe` et `assistant` (`id`, `nom`, `prenom`).

| Query | Description |
|---|---|
| `statut` | `EN_ATTENTE`, `VALIDE`, `TERMINE`, `REFUSE` ou `ANNULE` |
| `from` | Date de début minimale (ISO 8601) |
| `to` | Date de début maximale (ISO 8601) |

#### `GET /api/admin/rendez-vous/:id`
Un rendez-vous (même objet que la création). **Erreur** : `404` `"Rendez-vous introuvable."`

#### Transitions de statut
Toutes en `PATCH`, corps optionnel `{ "notesAdmin": "…" }` (conservé si absent). Réponse `200` : le rendez-vous mis à jour.

| Route | Transition | E-mail au client |
|---|---|---|
| `/api/admin/rendez-vous/:id/valider` | `EN_ATTENTE` → `VALIDE` | acceptation |
| `/api/admin/rendez-vous/:id/refuser` | `EN_ATTENTE` → `REFUSE` | refus |
| `/api/admin/rendez-vous/:id/terminer` | `VALIDE` → `TERMINE` (compte dans le CA) | non |
| `/api/admin/rendez-vous/:id/annuler` | `EN_ATTENTE` ou `VALIDE` → `ANNULE` | annulation |

**Erreurs** : `404` `"Rendez-vous introuvable."` · `409` si la transition est interdite, par exemple `"Impossible de valider un RDV au statut VALIDE."` ou `"Seul un RDV validé peut être marqué comme terminé."`

```bash
curl -X PATCH http://localhost:4000/api/admin/rendez-vous/c0a8…/valider \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{ "notesAdmin": "Client confirmé par téléphone" }'
```

#### `PATCH /api/admin/rendez-vous/:id/assistant`
Attribue, change ou retire l'assistant d'un rendez-vous (impossible si `TERMINE`, `ANNULE` ou `REFUSE`).

**Corps** : `{ "assistantId": "9d1e…" }` ou `{ "assistantId": null }` (retour au coiffeur)

**Erreurs** : `404` (rendez-vous ou assistant introuvable/inactif) · `409` `"Cet assistant a déjà un rendez-vous sur ce créneau."` · `409` statut final.

### 6.4 Assistants

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/assistants` | Liste complète (actifs et inactifs) |
| POST | `/api/admin/assistants` | Créer |
| PUT | `/api/admin/assistants/:id` | Modifier |
| DELETE | `/api/admin/assistants/:id` | Supprimer |

Objet renvoyé (le hash du mot de passe n'est jamais exposé) :
```json
{ "id": "…", "nom": "Kpadonou", "prenom": "Fabrice", "email": "assistant@salon.com", "telephone": "+229 00 00 00 01", "actif": true, "createdAt": "…" }
```

#### `POST /api/admin/assistants`
Corps : `nom`, `prenom`, `email`, `password` (8 caractères min) obligatoires ; `telephone` optionnel.
**Réponse `201`** : l'assistant. **Erreurs** : `400` · `409` e-mail déjà utilisé (`"Cette valeur existe déjà (conflit d'unicité)."`)

#### `PUT /api/admin/assistants/:id`
Champs optionnels : `nom`, `prenom`, `email`, `telephone`, `actif`, `password` (réinitialise le mot de passe). **Réponse `200`** : l'assistant. **Erreurs** : `404` · `400` mot de passe trop court.

#### `DELETE /api/admin/assistants/:id`
**Réponse `200`** : `{ "message": "Assistant supprimé." }`
**Erreurs** : `404` · `409` `"Impossible de supprimer : cet assistant a des rendez-vous en cours. Désactivez-le plutôt."`

### 6.5 Salon, horaires et indisponibilités

#### `GET /api/admin/salon`
Même réponse que `GET /api/salon`.

#### `PUT /api/admin/salon`
Corps (tous optionnels) : `nomEnseigne`, `adresse`, `telephone`, `email`, `logoUrl`, `dureeCreneauMinutes`. Renvoie le salon mis à jour (sans les horaires).
> L'`email` du salon est l'adresse qui reçoit les notifications de nouvelles demandes.

#### `PUT /api/admin/salon/horaires`
**Remplace** tous les horaires hebdomadaires. Le corps est un **tableau** :

```json
[
  { "jourSemaine": 0, "heureDebut": "08:00", "heureFin": "18:00", "ferme": true },
  { "jourSemaine": 1, "heureDebut": "08:00", "heureFin": "18:00", "ferme": false }
]
```
**Réponse `200`** : le salon avec ses nouveaux `horaires`. **Erreur** : `400` `"Le corps doit être un tableau d'horaires."`

#### `GET /api/admin/indisponibilites`
Liste des congés / pauses, triés par `dateDebut` croissante.
```json
[ { "id": "…", "salonId": "…", "dateDebut": "2026-08-15T00:00:00.000Z", "dateFin": "2026-08-17T23:59:59.000Z", "motif": "Congés", "createdAt": "…" } ]
```

#### `POST /api/admin/indisponibilites`
Corps : `dateDebut`, `dateFin` (obligatoires), `motif` (optionnel). **Réponse `201`** : l'indisponibilité. **Erreur** : `400` `"dateDebut et dateFin sont obligatoires."`

#### `DELETE /api/admin/indisponibilites/:id`
**Réponse `200`** : `{ "message": "Indisponibilité supprimée." }`

### 6.6 Tableau de bord

#### `GET /api/admin/dashboard`
Chiffre d'affaires (rendez-vous `TERMINE` uniquement) sur 5 périodes. La semaine commence le lundi.

```json
{
  "chiffreAffaires": {
    "jour":    { "total": 15000,  "nombreRendezVous": 4 },
    "semaine": { "total": 62000,  "nombreRendezVous": 17 },
    "mois":    { "total": 210000, "nombreRendezVous": 58 },
    "annee":   { "total": 1450000, "nombreRendezVous": 402 },
    "total":   { "total": 1450000, "nombreRendezVous": 402 }
  },
  "rendezVousEnAttente": 3,
  "rendezVousValidesAVenir": 7
}
```
> `rendezVousValidesAVenir` compte tous les rendez-vous au statut `VALIDE`, y compris ceux dont la date est dépassée mais qui n'ont pas encore été marqués terminés.

#### `GET /api/admin/dashboard/coupes-populaires`
Top 10 des coupes par nombre de rendez-vous terminés.
```json
[
  { "coupe": { "id": "7f3a…", "nom": "Dégradé américain", "prixFcfa": 3000, "…": "…" }, "nombreVentes": 120, "chiffreAffaires": 380000 }
]
```

### 6.7 Clients

#### `GET /api/admin/clients`
```json
[
  { "id": "…", "nom": "Doe", "prenom": "Jean", "email": "jean@example.com", "telephone": "+22900000000", "nombreRendezVous": 3, "totalPaye": 9000, "createdAt": "…" }
]
```
`totalPaye` = somme des `tarifApplique` des rendez-vous `TERMINE`.

#### `GET /api/admin/clients/:id`
Fiche client avec l'historique complet (plus récent d'abord) :
```json
{
  "id": "…", "nom": "Doe", "prenom": "Jean", "email": "…", "telephone": "…", "adresse": null, "createdAt": "…",
  "totalPaye": 9000,
  "rendezVous": [ { "id": "…", "statut": "TERMINE", "tarifApplique": 3000, "dateHeureDebut": "…", "coupe": { "nom": "…" }, "…": "…" } ]
}
```
**Erreur** : `404` `"Client introuvable."`

### 6.8 Rapports exportables

| Route | Content-Type | Fichier |
|---|---|---|
| `GET /api/admin/rapports/pdf` | `application/pdf` | `rapport-financier.pdf` |
| `GET /api/admin/rapports/excel` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `rapport-financier.xlsx` |

Query optionnelles : `from`, `to` (ISO 8601, filtre sur `dateHeureDebut`). Ne contiennent que les rendez-vous `TERMINE`, avec un total en bas.

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/admin/rapports/pdf?from=2026-08-01&to=2026-08-31" \
  -o rapport-aout.pdf
```

---

## 7. Routes assistant

🔒 Exigent `Authorization: Bearer <token assistant>`.

### `GET /api/assistant/rendez-vous`
Les rendez-vous **assignés à l'assistant connecté uniquement**, par date croissante, avec `client` et `coupe`.

| Query | Description |
|---|---|
| `statut` | Filtre sur le statut |
| `from` / `to` | Plage sur `dateHeureDebut` (ISO 8601) |

L'assistant ne peut pas valider, refuser ni modifier un rendez-vous : ces actions sont réservées à l'admin.

---

## 8. Modèles de données

| Modèle | Champs principaux |
|---|---|
| **Salon** | `nomEnseigne`, `adresse`, `telephone`, `email`, `logoUrl`, `dureeCreneauMinutes` (défaut 30) |
| **HoraireOuverture** | `jourSemaine` (0–6), `heureDebut`, `heureFin` (`"HH:mm"`), `ferme` |
| **Indisponibilite** | `dateDebut`, `dateFin`, `motif` |
| **Admin** | `email` (unique), `passwordHash`, `nom` |
| **Assistant** | `nom`, `prenom`, `email` (unique), `telephone`, `passwordHash`, `actif` |
| **Client** | `nom`, `prenom`, `email`, `telephone`, `adresse` |
| **Coupe** | `nom`, `description`, `prixFcfa`, `domicileDisponible`, `prixDomicileFcfa`, `actif` |
| **Photo** | `coupeId`, `url`, `position` (3 max par coupe) |
| **RendezVous** | `clientId`, `coupeId`, `assistantId?`, `tarifApplique`, `lieuPrestation`, `adresseDomicile?`, `dateHeureDebut`, `dateHeureFin`, `statut`, `notesAdmin?` |

Énumérations : `StatutRendezVous` = `EN_ATTENTE` · `VALIDE` · `TERMINE` · `REFUSE` · `ANNULE` ; `LieuPrestation` = `SALON` · `DOMICILE`.

---

## 9. Cycle de vie d'un rendez-vous

```
EN_ATTENTE ──valider──▶ VALIDE ──terminer──▶ TERMINE   (compte dans le CA)
    │                     │
    ├──refuser──▶ REFUSE  └──annuler──▶ ANNULE
    └──annuler──▶ ANNULE
```

- `TERMINE`, `REFUSE` et `ANNULE` sont des états finaux.
- Les créneaux `EN_ATTENTE`, `VALIDE` et `TERMINE` sont **bloqués** (un rendez-vous refusé ou annulé libère le créneau).
- Chaque praticien (le coiffeur ou chaque assistant) a son propre agenda : deux rendez-vous peuvent avoir la même heure s'ils ne sont pas pour le même praticien.

---

## 10. Codes d'erreur

| Statut | Signification |
|---|---|
| `200` | Succès |
| `201` | Ressource créée |
| `400` | Données manquantes ou invalides |
| `401` | Non authentifié / identifiants invalides / token expiré |
| `403` | Rôle insuffisant |
| `404` | Ressource ou route introuvable (`"Route introuvable."` pour une URL inconnue) |
| `409` | Conflit : créneau pris, transition de statut interdite, suppression bloquée, valeur déjà existante, limite de photos atteinte |
| `429` | Trop de requêtes |
| `500` | Erreur serveur |
