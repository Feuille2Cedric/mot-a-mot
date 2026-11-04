# Mot à mot

Carnet personnel de vocabulaire et de curiosité, en français. Un mot, une expression et une donnée à découvrir chaque jour, avec une bibliothèque privée et un jeu de définitions.

**Site prévu : https://feuille2cedric.github.io/mot-a-mot/**

## Utilisation

- Chercher un mot français, lire ses définitions puis l’ajouter à sa bibliothèque.
- Garder le mot et l’expression du jour, écrire une note personnelle et indiquer ce qui est acquis ou reste à revoir.
- Lire une capsule statistique issue d’une publication officielle, ouvrir sa source, rédiger un résumé ou un commentaire et la conserver dans ses lectures.
- Lancer un quiz de cinq définitions. Les mots enregistrés sont proposés en priorité ; les accents et la ponctuation ne pénalisent pas la réponse.
- Suivre son taux de réussite, son nombre de réponses et sa série de jours actifs.

L’application fonctionne sans compte. Les données restent alors dans le navigateur utilisé.

## Compte et sauvegarde

Même Supabase et même système d’authentification que Curio, Mes Apps et Tsugi : e-mail/mot de passe, inscription, récupération, changement du mot de passe et session partagée sur l’origine GitHub Pages. Aucun nouveau compte n’est nécessaire si un compte existe déjà.

Les données utilisent le document privé `mot-a-mot` dans `personal_app_state`, isolé par les règles RLS existantes. Le document contient les mots, les expressions, les notes de lecture et l’historique des réponses. Il ne contient jamais le mot de passe.

Chaque modification est d’abord enregistrée sous la clé locale `mot-a-mot-v1`, puis envoyée au serveur après connexion. Les ajouts indépendants réalisés sur plusieurs appareils sont fusionnés par identifiant. Si deux appareils modifient en même temps le même champ, l’application demande de choisir une version après avoir permis l’export des deux sauvegardes. Une déconnexion masque les données rattachées au compte ; pour changer de compte dans un même navigateur, utiliser un profil séparé.

Attendre **✓ Synchronisé** avant de changer d’appareil ou d’effacer les données du navigateur.

## Définitions et lectures

- Le [Wiktionnaire](https://fr.wiktionary.org/) fournit les définitions recherchées en ligne. Le texte est converti en contenu brut avant affichage ; aucun HTML distant n’est injecté dans la page.
- Un petit lexique intégré permet de continuer à consulter les mots du jeu lorsque le réseau ou le Wiktionnaire est indisponible.
- Les capsules quotidiennes sont un corpus éditorial local. Chaque carte indique sa date, son thème et un lien direct vers la publication [INSEE](https://www.insee.fr/) utilisée.
- Le choix quotidien est déterministe selon la date locale : un même appareil affiche le même contenu pendant toute la journée.

Mot à mot n’aspire pas automatiquement de nouveaux articles et ne présente pas ses résumés comme des publications de l’INSEE. La source primaire reste accessible depuis chaque carte.

## Développement

```powershell
python -m http.server 3360 --bind 127.0.0.1 --directory site
node --test tests/*.test.cjs
```

`scripts/test_ui.py` utilise Playwright avec Edge et simule l’indisponibilité du Wiktionnaire et de Supabase. Il vérifie le rituel quotidien, la recherche de secours, la bibliothèque, le quiz, la persistance après rechargement et les affichages ordinateur/mobile.

`site/` est le seul dossier publié. GitHub Actions exécute les tests de domaine, contrôle la syntaxe JavaScript puis déploie ce dossier sur GitHub Pages. Le SDK Supabase est livré localement avec sa licence et son fichier de provenance.

## Backend

La migration `supabase/migrations/202611040001_mot_a_mot.sql` a été appliquée au projet Supabase partagé. Elle étend uniquement la liste des documents autorisés avec `mot-a-mot`, sans modifier les documents `curio`, `mes-apps` ou `tsugi`. Ne pas la rejouer aveuglément sur une installation dont le schéma diffère.

Avant la première publication — ou pour une nouvelle installation — ajouter sans retirer les URL existantes :

```text
https://feuille2cedric.github.io/mot-a-mot/
```

dans **Authentication → URL Configuration → Redirect URLs**. La clé publique du projet peut rester dans `site/sync/config.js` ; les droits d’accès sont imposés côté serveur par l’authentification et les politiques RLS. Aucune clé de service ne doit être ajoutée au dépôt.

## Structure

```text
mot-a-mot/
├── site/                         Site statique publié
│   ├── index.html                Structure et navigation
│   ├── style.css                 Interface responsive
│   ├── content.js                Mots, expressions et capsules sourcées
│   ├── domain.js                 Validation, normalisation et calculs purs
│   ├── app.js                    État local, rendu et interactions
│   └── sync/                     Authentification et synchronisation partagées
├── tests/
│   └── domain.test.cjs           Tests unitaires sans navigateur
├── scripts/
│   └── test_ui.py                Parcours Playwright desktop/mobile
├── supabase/
│   ├── config.toml               Configuration locale de la CLI
│   └── migrations/               Évolution du schéma partagé
└── .github/workflows/pages.yml   Tests et déploiement GitHub Pages
```

Le domaine ne dépend pas du DOM et peut être testé directement avec Node. `content.js` contient uniquement le corpus éditorial. `app.js` orchestre l’interface et persiste un document validé par `domain.js`. L’adaptateur `site/sync/adapter.js` est la seule jonction entre ce document et le moteur de synchronisation commun aux autres applications.
