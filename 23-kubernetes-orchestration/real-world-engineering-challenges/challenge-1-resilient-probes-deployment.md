# Challenge 1: Resilient Microservice Deployment

## The Scenario
Your company runs a critical payment processing microservice. Recently, there have been outages because the application sometimes deadlocks under load. Additionally, when the deployment is updated, users experience a brief 10-second window of `502 Bad Gateway` errors.

## The Objective
You need to create a rock-solid, production-grade Deployment that:
1. Runs exactly 3 replicas of the `payment-processor:v1.2` image.
2. Automatically detects and restarts deadlocked containers using a **Liveness Probe**.
3. Ensures zero downtime during updates using a **Readiness Probe** and a strict **RollingUpdate Strategy**.

## Requirements
*   **Deployment Name:** `payment-processor-deploy`
*   **Labels:** `app: payments`, `tier: backend`
*   **Image:** `nginx:alpine` (We are using Nginx to simulate the payment processor for testing).
*   **Port:** The application listens on port `8080` internally.
*   **Liveness Probe:**
    *   Path: `/healthz`
    *   Port: `8080`
    *   Initial Delay: `15 seconds`
    *   Period: `20 seconds`
*   **Readiness Probe:**
    *   Path: `/ready`
    *   Port: `8080`
    *   Initial Delay: `5 seconds`
    *   Period: `10 seconds`
*   **Strategy:**
    *   Type: `RollingUpdate`
    *   Max Surge: `1`
    *   Max Unavailable: `0` (Strictly ensure no current pods are taken down until new ones are ready).

---

## Starter Template
Create a file named `challenge-1.yaml`. You can start with this structure:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-processor-deploy
# ... complete the rest of the spec
```

---

<details>
<summary>View Full Solution & Walkthrough</summary>

### The Solution (challenge-1.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-processor-deploy
  labels:
    app: payments
    tier: backend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: payments
  template:
    metadata:
      labels:
        app: payments
        tier: backend
    spec:
      containers:
      - name: processor
        image: nginx:alpine
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 20
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Walkthrough & Architecture Notes
1.  **Strict Rolling Update:** By setting `maxUnavailable: 0` and `maxSurge: 1`, we force Kubernetes to be extremely conservative. During an update, it will add 1 new Pod (making 4 total). Only after that 4th Pod passes its Readiness Probe will K8s terminate one of the older 3 Pods. This completely eliminates the 10-second `502` error window.
2.  **Multi-Stage Probes:** The Liveness probe has a longer delay (15s) than the Readiness probe (5s). This is common. We want to know quickly if the app is ready to serve traffic, but we want to give it plenty of time to boot up before deciding to aggressively kill and restart it.
3.  **Applying and Testing:**
    *   `kubectl apply -f challenge-1.yaml`
    *   Verify the strategy: `kubectl describe deployment payment-processor-deploy`
    *   Trigger an update to see the strategy in action: `kubectl set image deployment/payment-processor-deploy processor=nginx:latest`
</details>
