# Mot à mot

Une app française de vocabulaire et de curiosité quotidienne : recherche de définitions, bibliothèque privée, quiz, expression du jour et lecture statistique issue de l’INSEE.

## Ce qui est inclus

- recherche de mots via l’API publique du Wiktionnaire, avec un lexique hors ligne de secours ;
- mots et expressions sauvegardés, notes personnelles et statut « acquis » ;
- quiz de cinq définitions, alimenté en priorité par la bibliothèque de l’utilisateur ;
- article ou statistique du jour, lien vers la source primaire, résumé et commentaire personnels ;
- historique de lecture et statistiques de révision ;
- fonctionnement local sans compte et synchronisation Supabase facultative ;
- même projet Supabase, même compte et même clé de session que Curio et Tsugi.

## Lancer en local

```bash
python -m http.server 3360 --bind 127.0.0.1
```

Puis ouvrir `http://127.0.0.1:3360/`.

## Activer la synchronisation

La migration `supabase/migrations/202611040001_mot_a_mot.sql` ajoute uniquement l’espace documentaire `mot-a-mot` à la table partagée `personal_app_state`. Elle conserve les documents `curio`, `mes-apps` et `tsugi` ainsi que leurs politiques RLS.

Après application de la migration au projet Supabase partagé, ajouter cette URL aux redirections Auth autorisées :

`https://feuille2cedric.github.io/mot-a-mot/`

La session Supabase utilise la clé locale `personal-app-auth`. Comme Curio, Tsugi et Mot à mot vivent sous la même origine GitHub Pages, une session déjà ouverte est reprise automatiquement. Les mots, notes, commentaires et résultats restent isolés par utilisateur grâce à `auth.uid()` et aux règles RLS existantes.

## Sources éditoriales

Les définitions en ligne renvoient vers le Wiktionnaire. Les capsules statistiques intégrées renvoient vers leur publication INSEE d’origine. Le texte affiché par l’app est un résumé court et chaque carte conserve son lien source.
