# Quarto (version web)

Version navigateur du jeu Quarto : deux joueurs sur le même écran, ou contre
une IA (Monte Carlo Tree Search, 4 niveaux). Aucun serveur nécessaire --
tout tourne dans le navigateur de la personne qui joue.

## Tester en local

Les fichiers JS utilisent des modules ES (`import`/`export`), que les
navigateurs bloquent par sécurité si on ouvre `index.html` directement en
double-cliquant dessus (protocole `file://`). Il faut donc les servir via un
petit serveur local -- une seule commande, aucune installation :

```
python3 -m http.server 8000
```

puis ouvrir `http://localhost:8000` dans le navigateur. (N'importe quel
serveur statique fonctionne : `npx serve`, l'extension VS Code "Live
Server", etc.)

## Héberger sur GitHub Pages (gratuit, permanent)

1. Créer un dépôt GitHub (public) et y pousser tout le contenu de ce
   dossier (`index.html`, `style.css`, `js/`).
2. Dans le dépôt : **Settings → Pages** → choisir la branche à publier
   (`main`, dossier racine).
3. Le jeu est en ligne à `https://<ton-nom>.github.io/<nom-du-depot>/`,
   accessible depuis un ordinateur ou un téléphone.

Aucune configuration supplémentaire n'est nécessaire : GitHub Pages sert
les fichiers avec les bons en-têtes pour que les modules ES et les Web
Workers fonctionnent.

## Structure du projet

```
index.html       structure des deux écrans (configuration / partie)
style.css        thème visuel (mêmes couleurs que la version desktop)
js/
  logic.js       règles du jeu -- port direct de logic.py, aucune dépendance DOM
  mcts.js        IA (Monte Carlo Tree Search) -- port direct de mcts.py
  pieceView.js   dessin d'une pièce sur canvas (le "trou percé" pour hollow)
  theme.js       palette de couleurs utilisée par le dessin canvas
  worker.js      exécute l'IA dans un Web Worker (thread séparé, ne bloque
                 jamais l'interface pendant que l'IA réfléchit)
  app.js         contrôleur : écrans, dessin, clics, communication avec le worker
```

`logic.js` et `mcts.js` sont un port ligne à ligne des fichiers Python
équivalents -- même découpage volontaire : la logique du jeu ne dépend
d'aucun code d'affichage, donc réutilisable telle quelle si un jour on
ajoute un serveur pour du multijoueur en ligne.

## Ce qui n'est pas encore fait

- **PWA** (installation sur écran d'accueil, mode hors-ligne) : pas encore
  ajouté. Il suffirait d'un `manifest.json` + un service worker, en gardant
  tout le reste identique.
- **Affichage responsive fin** : le plateau a une taille fixe en pixels
  plutôt que de s'adapter précisément à chaque taille d'écran. Fonctionne
  sur mobile mais pourrait être affiné.
