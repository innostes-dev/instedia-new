# Challenge 5: Enterprise Multi-Tenant Cluster Architecture

## The Scenario
Your enterprise has one massive Kubernetes cluster. Two separate engineering teams, "Team Alpha" and "Team Beta", share this cluster.
Recently, Team Alpha deployed a buggy application that consumed 100% of the cluster's memory, causing Team Beta's applications to crash. Furthermore, for security reasons, Team Beta's backend API must never be accessible from Team Alpha's network.

## The Objective
You are the Principal Architect. You need to implement a **Multi-Tenant Architecture** using Kubernetes primitives to securely isolate these two teams.

## Requirements
You must create a comprehensive YAML configuration that does the following:

1.  **Namespaces:** Create two Namespaces: `alpha-space` and `beta-space`.
2.  **Resource Quotas:** Create a `ResourceQuota` in the `alpha-space` that hard-caps the entire namespace to a maximum of `4` CPUs and `8Gi` of Memory.
3.  **Network Policies:**
    *   Create a `NetworkPolicy` in `beta-space` named `deny-alpha`.
    *   It should apply to all Pods in `beta-space`.
    *   It should **Deny** all incoming (Ingress) traffic originating from the `alpha-space` namespace.
    *   It should **Allow** incoming traffic from other Pods within the `beta-space`.
4.  **Deployment (Team Alpha):** Create a Deployment in `alpha-space` named `alpha-hog`. It must request `1` CPU per pod. Since the namespace quota is 4, scaling this beyond 4 replicas should be blocked by Kubernetes.

---

## Starter Template
Create a file named `challenge-5.yaml`. Use `---` to separate resources.

```yaml
# 1. Namespaces
apiVersion: v1
kind: Namespace
metadata:
  name: alpha-space
  labels:
    team: alpha # Useful for NetworkPolicies
---
# ... add beta-space

---
# 2. Resource Quota for Alpha
apiVersion: v1
kind: ResourceQuota
metadata:
  name: alpha-compute-quota
  namespace: alpha-space
# ... complete quota spec

---
# 3. Network Policy for Beta
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-alpha
  namespace: beta-space
# ... complete policy spec

---
# 4. Alpha Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alpha-hog
  namespace: alpha-space
# ... complete deployment with CPU requests
```

---

<details>
<summary>View Full Solution & Walkthrough</summary>

### The Solution (challenge-5.yaml)

```yaml
# 1. Namespaces
apiVersion: v1
kind: Namespace
metadata:
  name: alpha-space
  labels:
    team: alpha # Needed so Beta can identify Alpha
---
apiVersion: v1
kind: Namespace
metadata:
  name: beta-space
  labels:
    team: beta

---
# 2. Resource Quota (The Memory/CPU Governor)
apiVersion: v1
kind: ResourceQuota
metadata:
  name: alpha-compute-quota
  namespace: alpha-space
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "4"
    limits.memory: 8Gi

---
# 3. Network Policy (The Firewall)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-beta
  namespace: beta-space
spec:
  podSelector: {} # Empty selector means "Apply to ALL pods in beta-space"
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          team: beta # ONLY allow traffic from namespaces labeled 'team: beta' (itself)
    # Notice we omitted alpha. By default, NetworkPolicies drop everything not explicitly allowed.

---
# 4. Alpha Deployment (Testing the Quota)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alpha-hog
  namespace: alpha-space
spec:
  replicas: 5 # We want 5...
  selector:
    matchLabels:
      app: hog
  template:
    metadata:
      labels:
        app: hog
    spec:
      containers:
      - name: main
        image: nginx
        resources:
          requests:
            cpu: "1" # ...but 5 * 1 CPU > Quota of 4.
          limits:
            cpu: "1"
```

### Walkthrough & Architecture Notes
1.  **The Blast Radius (Namespaces):** By putting teams in different Namespaces, we create virtual clusters. If an Alpha engineer runs `kubectl delete pods --all`, they only delete Alpha pods, not Beta pods.
2.  **The Budget (ResourceQuota):** When you apply this YAML, K8s will attempt to create the `alpha-hog` deployment. The Deployment asks for 5 replicas. The ReplicaSet tries to create 5 Pods. The first 4 Pods will succeed. The 5th Pod will be rejected by the Kubernetes API server with a `Forbidden: exceeded quota` error. This guarantees Team Alpha can never starve Team Beta of physical server resources.
3.  **The Firewall (NetworkPolicy):** Network Policies are internal firewalls. The `isolate-beta` policy acts on all pods in `beta-space`. Its rule says: "Only accept traffic if it comes from a Namespace with the label `team: beta`." If a pod in `alpha-space` tries to `curl` a pod in `beta-space`, the network plugin (like Calico or Cilium) will drop the packets at the source.
</details>
