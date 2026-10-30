# Social App

Three incremental releases of a centered dark social feed. The existing working application is reused here with a fresh GitHub, Jenkins and Docker Hub workflow.

| Release | Features | Localhost |
| --- | --- | --- |
| v1 | Create and read posts | http://localhost:30001 |
| v2 | Posts and likes | http://localhost:30002 |
| v3 | Posts, likes and comments | http://localhost:30003 |

This checkout contains **v3**. Select another release with `git switch --detach v1` (or v2/v3), or the corresponding `release/v1` branch. Each release has a separate commit, branch, Git tag, image tag, Kubernetes deployment, service and SQLite persistent volume.

## Run locally

Requires Node.js 24 or newer. Run `npm ci`, `npm run check`, `npm test`, and `npm start`. Open http://localhost:3000. SQLite is provided by Node.js; no external database server is needed. Runtime files are ignored under data/.

## Delivery

GitHub: https://github.com/VAIBHAV11464/SOCIAL-APP

Jenkins: http://localhost:8080/job/social-app/ (VERSION chooses v1/v2/v3)

Docker Hub: https://hub.docker.com/r/vaibhav11464/social-app/tags

The root Jenkinsfile checks out the selected tag, runs checks and tests, builds the Docker image, tests the container, pushes to Docker Hub, applies Kubernetes resources and verifies health and feature flags. Jenkins credentials `social-dockerhub` and `social-kubeconfig` are reused. Their values do not belong in GitHub or screenshots.

Example manual commands:

```powershell
docker build -t vaibhav11464/social-app:v3 .
docker push vaibhav11464/social-app:v3
.\scripts\deploy.ps1 -Version v3 -Image vaibhav11464/social-app:v3
.\scripts\verify.ps1 -Version v3
.\scripts\start-demo.ps1
```

Kubernetes context: docker-desktop. Namespace: social-app-course. Keep Docker Desktop and Kubernetes running. The startup helper forwards the three services to Windows localhost and can be rerun after a restart. The original project remains in its separate namespace and image repository.

## Application

Plain HTML, CSS and browser JavaScript, Node HTTP server and SQLite. Display names identify posts and comments; account registration is outside the course scope. Limits: name 40, post 500, comment 250 characters. Likes are identified by a browser identifier, and can be removed. Text is safely rendered using textContent. Each Kubernetes version uses one non-root container and its own 1 GiB persistent volume. Recreate rollout keeps a single SQLite writer.

## Source layout

```text
SOCIAL-APP/
  .vscode/launch.json
  public/             HTML CSS JavaScript favicon
  test/app.test.mjs    Version-specific API and persistence tests
  k8s/app.yaml        Namespace PVC deployment service template
  scripts/            Deploy verify and localhost startup helpers
  server.mjs          Node HTTP server and SQLite API
  release.json        Version and feature flags
  package.json
  package-lock.json
  Dockerfile
  Jenkinsfile
  README.md
```
