# Challenge 4: Blue-Green Production Deployment Switcher

## The Scenario
While Rolling Updates are great, they mix old and new versions of your application during the rollout phase. For a highly critical database-migration release, your team has decided to use a **Blue-Green Deployment** strategy.

In a Blue-Green deployment, you maintain two completely separate environments (Deployments) at the same time:
- **Blue (v1):** The current stable version, receiving 100% of live user traffic.
- **Green (v2):** The new version, currently receiving 0% of traffic, but fully booted up and available for internal QA testing.

When QA signs off on Green (v2), you want to flip a switch to instantly route 100% of live user traffic to Green, with zero downtime and no version mixing.

## The Objective
You must implement the networking components of a Blue-Green deployment using Kubernetes Services and Label Selectors.

## Requirements
1.  **Blue Deployment:** Create a Deployment named `app-blue` running `nginx:1.24` (2 replicas). Give its pod template the labels `app: store` and `version: v1`.
2.  **Green Deployment:** Create a Deployment named `app-green` running `nginx:1.25` (2 replicas). Give its pod template the labels `app: store` and `version: v2`.
3.  **The Switcher Service:** Create a `NodePort` Service named `store-live-svc` listening on port 80. Configure its `selector` to route traffic *only* to the Blue Deployment.
4.  **The Challenge Question:** Write the exact imperative `kubectl` command you would run to execute the "switch" (changing live traffic from Blue to Green).

---

## Starter Template
Create a file named `challenge-4.yaml`.

```yaml
# 1. Blue Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-blue
# ... finish blue

---
# 2. Green Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-green
# ... finish green

---
# 3. Live Service
apiVersion: v1
kind: Service
metadata:
  name: store-live-svc
# ... finish service routing to blue
```

---

<details>
<summary>View Full Solution & Walkthrough</summary>

### The Solution (challenge-4.yaml)

```yaml
# 1. Blue Deployment (v1)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-blue
spec:
  replicas: 2
  selector:
    matchLabels:
      app: store
      version: v1
  template:
    metadata:
      labels:
        app: store
        version: v1
    spec:
      containers:
      - name: web
        image: nginx:1.24
        ports:
        - containerPort: 80

---
# 2. Green Deployment (v2)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-green
spec:
  replicas: 2
  selector:
    matchLabels:
      app: store
      version: v2
  template:
    metadata:
      labels:
        app: store
        version: v2
    spec:
      containers:
      - name: web
        image: nginx:1.25
        ports:
        - containerPort: 80

---
# 3. The Switcher Service (Currently pointing to Blue)
apiVersion: v1
kind: Service
metadata:
  name: store-live-svc
spec:
  type: NodePort
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: store
    version: v1  # THIS IS THE CRITICAL LINE
```

### The Switch Command
To flip the switch from Blue to Green with zero downtime, you update the Service's selector to look for `version: v2` instead of `v1`.
You can do this imperatively using `kubectl patch`:

```bash
kubectl patch service store-live-svc -p '{"spec":{"selector":{"version":"v2"}}}'
```

### Walkthrough & Architecture Notes
1.  **Label Overlap:** Both Deployments share the label `app: store`, but differ on the `version` label. This is a common pattern.
2.  **Instantaneous Switch:** The moment you run the `patch` command (or `kubectl apply` an updated YAML file), the Kubernetes Control Plane updates the Service Endpoints. The internal iptables/IPVS rules on the worker nodes are updated almost instantly. New HTTP requests immediately start flowing to the `app-green` pods.
3.  **Instant Rollback:** If QA realizes Green is broken in production 10 seconds after the switch, rolling back is as simple as flipping the selector back to `v1`. The Blue pods were never destroyed; they were just sitting idle, waiting to receive traffic again. (If you used a RollingUpdate, rollback would take time as K8s would have to kill v2 pods and spin v1 pods back up).
</details>
