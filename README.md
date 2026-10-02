# Mothership Campaign Cartography

Application web locale pour préparer et gérer des cartes de campagne Mothership : Jump Clusters, systèmes stellaires, objets orbitaux et Jump Routes. Les cartes sont schématiques, pas à l’échelle.

## Lancer l’application

Prérequis : Node.js et npm.

```sh
npm install
npm run dev
```

Ouvre ensuite l’adresse locale affichée par Nuxt dans le terminal.

## Utilisation

1. Crée un workspace local en donnant un nom au Jump Cluster et à son premier système.
2. Depuis la carte du Cluster, ajoute d’autres systèmes. Ouvre un système et utilise la palette d’objets, regroupée par type : glisse un type sur la carte ou active son bouton au clavier. Déposer un objet sur un anneau le place dans cette Orbit.
3. Ajoute des Jump Points dans les systèmes, puis crée des Jump Routes depuis la carte du Cluster en choisissant leurs points de départ et d’arrivée.
4. Sélectionne un système, objet, Orbit ou route pour modifier ses détails. Les définitions de champs natifs et personnalisés se trouvent dans les détails du système.
5. Utilise les contrôles de navigation pour zoomer ou ajuster la carte. Déplace les systèmes et objets pour organiser la disposition; glisse un anneau pour en modifier le rayon.
6. Les actions de suppression affichent les éléments dépendants concernés avant confirmation.

Les cartes peuvent être exportées en JSON, PNG ou SVG. L’import JSON affiche un aperçu et ajoute une copie indépendante; il ne fusionne ni ne remplace les données existantes.

## Données et sauvegarde

Le workspace est enregistré dans IndexedDB du navigateur utilisé. Il n’y a ni compte ni stockage distant. Pour sauvegarder ou déplacer les données, exporte le Jump Cluster en JSON. L’import crée une copie; il ne restaure pas par-dessus le workspace existant.

## Vérifications de développement

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
```
