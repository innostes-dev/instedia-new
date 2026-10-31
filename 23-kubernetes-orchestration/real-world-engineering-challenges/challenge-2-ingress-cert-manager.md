# Challenge 2: Production Nginx Ingress with Automatic TLS

## The Scenario
Your startup has successfully deployed its marketing site (`www.coolstartup.io`) and its API (`api.coolstartup.io`) to a Kubernetes cluster. Currently, they are exposed via unencrypted `http` using NodePorts. Security requires that all traffic be routed through a single entry point and secured with `https` using free Let's Encrypt certificates.

## The Objective
You need to configure a single Ingress resource that routes traffic based on the subdomain, and automatically requests and mounts a TLS certificate via `cert-manager`.

## Requirements
*   **Assumptions:** Assume an Nginx Ingress Controller and `cert-manager` are already installed on the cluster. Assume a `ClusterIssuer` named `letsencrypt-prod` exists.
*   **Ingress Name:** `startup-main-ingress`
*   **Annotations:** You must add the specific annotation that tells cert-manager to automatically generate a certificate for this Ingress: `cert-manager.io/cluster-issuer: "letsencrypt-prod"`.
*   **Routing Rules:**
    *   `www.coolstartup.io/` -> Routes to a Service named `marketing-svc` on port `80`.
    *   `api.coolstartup.io/` -> Routes to a Service named `api-gateway-svc` on port `8080`.
*   **TLS Configuration:**
    *   Secure both hosts.
    *   Store the resulting Let's Encrypt certificate in a Secret named `startup-tls-secret`.

---

## Starter Template
Create a file named `challenge-2.yaml`.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: startup-main-ingress
  annotations:
    # Add cert-manager annotation here
spec:
  ingressClassName: nginx
  # ... Add TLS and Rules here
```

---

<details>
<summary>View Full Solution & Walkthrough</summary>

### The Solution (challenge-2.yaml)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: startup-main-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - www.coolstartup.io
    - api.coolstartup.io
    secretName: startup-tls-secret
  rules:
  - host: www.coolstartup.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: marketing-svc
            port:
              number: 80
  - host: api.coolstartup.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway-svc
            port:
              number: 8080
```

### Walkthrough & Architecture Notes
1.  **The Magic Annotation:** The annotation `cert-manager.io/cluster-issuer: "letsencrypt-prod"` acts as a webhook trigger. When Kubernetes sees this Ingress being created, `cert-manager` intercepts the request.
2.  **The Certificate Flow:**
    *   Cert-manager reads the `tls.hosts` array.
    *   It reaches out to Let's Encrypt and performs an HTTP-01 or DNS-01 challenge to prove you own `coolstartup.io`.
    *   Once validated, Let's Encrypt issues the certificate.
    *   Cert-manager takes that certificate and saves it into the Kubernetes Secret named `startup-tls-secret`.
    *   The Nginx Ingress Controller detects the secret, loads it into memory, and immediately begins terminating SSL for those two subdomains.
3.  **Host-Based Routing:** The `rules` array elegantly splits traffic based purely on the domain name the user typed into their browser, allowing you to run entirely different tech stacks behind a single public IP address.
</details>
