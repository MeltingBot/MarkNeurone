# Documentation MarkNeurone

Documentation utilisateur générée avec [Hugo](https://gohugo.io/) et le thème [hugo-book](https://github.com/alex-shpak/hugo-book), sur le modèle de celle de ZeroNeurone. Publiée sur https://mark.zeroneurone.com/.

Les pages sont dans `content/fr/`. Elles se lient entre elles par leur nom de fichier (`[Réglages](reglages.md)`), ce qui fonctionne aussi sur GitHub. Un lien vers une page absente fait échouer le build.

## Développement

```bash
mkdir -p themes
git clone --depth 1 --branch v13 https://github.com/alex-shpak/hugo-book.git themes/hugo-book
docker compose --profile dev up
```

Ouvrir http://localhost:1317.

## Image de production

Depuis la racine de MarkNeurone :

```bash
npm run doc:build
```

L'image est nommée `${DOCKER_REGISTRY}-doc:latest`, `DOCKER_REGISTRY` étant lu dans `.env` (non versionné), ou `markneurone-doc:latest` sans `.env`. Le `docker-compose.yml` lance le serveur nginx derrière Traefik (service `docs`, domaine `mark.zeroneurone.com`).
