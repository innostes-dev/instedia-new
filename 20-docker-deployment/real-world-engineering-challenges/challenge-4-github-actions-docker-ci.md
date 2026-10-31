# Real-World Engineering Challenge 4: GitHub Actions Docker CI

## The Challenge Scenario
You are modernizing a legacy application deployment pipeline. Currently, developers build Docker images on their laptops and manually push them to Docker Hub. This process is insecure, inconsistent, and has led to production outages due to untested images.

Your task is to implement an automated **Continuous Integration (CI)** pipeline using GitHub Actions.

### Strict Requirements
1. **Trigger:** The workflow must run automatically every time code is pushed to the `main` branch.
2. **Build:** It must build a Docker image using the `Dockerfile` located in the root of the repository.
3. **Vulnerability Scan:** Before pushing to any registry, you must use **Trivy** (a popular open-source security scanner) to scan the built image. If Trivy finds any `CRITICAL` vulnerabilities, the pipeline *must* fail and stop immediately.
4. **Authentication:** It must securely authenticate to Docker Hub using GitHub Secrets (`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`).
5. **Registry Push:** If the build and scan succeed, it must push the image to Docker Hub under the repository `yourorg/yourapp`, tagged with the first 7 characters of the git commit SHA (e.g., `yourorg/yourapp:a1b2c3d`).

---

## Starter Template
Create a file at `.github/workflows/docker-ci.yml`. Use this skeleton:

```yaml
name: Docker CI/CD Pipeline

on:
  push:
    branches:
      # TODO: Specify the branch

jobs:
  build-scan-push:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Extract Git Commit SHA
        id: vars
        # TODO: Write a bash command to get the short SHA and save it as an output variable

      - name: Build Docker Image
        # TODO: Run a docker build command, tagging it with the short SHA
        # e.g. docker build -t yourorg/yourapp:<sha> .

      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          # TODO: Configure trivy to scan the image you just built
          # TODO: Set exit-code to 1 to fail the build on CRITICAL severities

      - name: Login to Docker Hub
        # TODO: Use docker/login-action@v2 to login using secrets

      - name: Push Image to Docker Hub
        # TODO: Run a docker push command to push the tagged image
```

---

<details>
<summary><b>Click for Full Production Solution & Walkthrough</b></summary>

### The Complete Production .github/workflows/docker-ci.yml

```yaml
name: Docker CI/CD Pipeline

on:
  push:
    branches:
      - main

jobs:
  build-scan-push:
    runs-on: ubuntu-latest

    # Define environment variables to keep the code DRY
    env:
      IMAGE_NAME: yourorg/yourapp

    steps:
      # 1. Pull the code from the repo
      - name: Checkout code
        uses: actions/checkout@v3

      # 2. Extract the first 7 characters of the commit hash
      - name: Extract Git Commit SHA
        id: git_sha
        run: echo "short_sha=$(git rev-parse --short=7 HEAD)" >> $GITHUB_ENV

      # 3. Build the image locally on the runner
      - name: Build Docker Image
        run: |
          docker build -t ${{ env.IMAGE_NAME }}:${{ env.short_sha }} .

      # 4. Scan the local image before pushing
      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ env.IMAGE_NAME }}:${{ env.short_sha }}'
          format: 'table'
          # Fail the build if CRITICAL vulnerabilities are found
          exit-code: '1'
          ignore-unfixed: true
          vuln-type: 'os,library'
          severity: 'CRITICAL'

      # 5. Authenticate with Docker Hub using secure secrets
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      # 6. Push the verified image to the registry
      - name: Push Image to Docker Hub
        run: |
          docker push ${{ env.IMAGE_NAME }}:${{ env.short_sha }}

          # Optional: Also tag and push as 'latest' for convenience
          docker tag ${{ env.IMAGE_NAME }}:${{ env.short_sha }} ${{ env.IMAGE_NAME }}:latest
          docker push ${{ env.IMAGE_NAME }}:latest
```

### Walkthrough & Architecture Notes

1. **Why Commit SHAs instead of `latest`?** Tagging every build as `latest` is a massive DevOps anti-pattern. If you deploy `latest` and it breaks production, how do you rollback? You don't know which version `latest` was 10 minutes ago! By tagging images with the Git Commit SHA (`a1b2c3d`), you create a 1:1 trace between a compiled Docker image and the exact line of code in Git that generated it. Rolling back is as easy as deploying the previous SHA tag.
2. **The "Fail-Fast" Security Scan:** Notice that the `Trivy` step happens *before* the `Login to Docker Hub` step. If the Dockerfile introduces a massive vulnerability (like using an outdated, compromised base image), the `exit-code: 1` instruction forces the pipeline to crash immediately. The compromised image is thrown away, and it never pollutes your Docker registry.
3. **GitHub Secrets:** Hardcoding passwords in a `.yml` file is catastrophic. We use `${{ secrets.DOCKERHUB_TOKEN }}`. You configure these variables in the GitHub repository's Settings UI. GitHub dynamically injects them into the runner at runtime, and automatically masks them in the build logs so they cannot be leaked.
</details>
