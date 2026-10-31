# Challenge 3: GPU Node Pool Provisioning for LLMs

## The Scenario
Your company is deploying a large language model (LLM) for a new AI feature. The model requires an NVIDIA GPU to run inference at an acceptable speed. Your Kubernetes cluster currently consists of 10 standard CPU-only worker nodes, and you have just added 2 specialized, expensive GPU worker nodes.
If you just deploy the LLM Pod, Kubernetes might schedule it on a standard CPU node (where it will crash or run unacceptably slow). Furthermore, you don't want your standard, cheap web apps accidentally taking up space on the expensive GPU nodes.

## The Objective
You must use **Node Selectors** (or Node Affinity) and **Taints/Tolerations** to ensure:
1. The LLM Pod *only* runs on the new GPU nodes.
2. Standard web Pods are *prevented* from running on the GPU nodes.

## Requirements
*   **Infrastructure Assumptions:**
    *   The 2 GPU nodes have been labeled with `hardware-type: gpu`.
    *   The 2 GPU nodes have been tainted with `dedicated=gpu:NoSchedule`. (This means no Pod can be scheduled here unless it specifically tolerates this taint).
*   **Deployment Name:** `llm-inference-engine`
*   **Replicas:** 2
*   **Image:** `pytorch/pytorch:latest` (Use command `["sleep", "infinity"]` to keep it running for the challenge).
*   **Node Selector:** Configure the deployment so it *demands* to be placed on a node with the label `hardware-type: gpu`.
*   **Tolerations:** Configure the deployment so it *tolerates* the taint `dedicated=gpu:NoSchedule`.

---

## Starter Template
Create a file named `challenge-3.yaml`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-inference-engine
spec:
  replicas: 2
  selector:
    matchLabels:
      app: llm
  template:
    metadata:
      labels:
        app: llm
    spec:
      containers:
      - name: pytorch
        image: pytorch/pytorch:latest
        command: ["sleep", "infinity"]
      # Add NodeSelector here
      # Add Tolerations here
```

---

<details>
<summary>View Full Solution & Walkthrough</summary>

### The Solution (challenge-3.yaml)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-inference-engine
spec:
  replicas: 2
  selector:
    matchLabels:
      app: llm
  template:
    metadata:
      labels:
        app: llm
    spec:
      # 1. Demand to be on a GPU node
      nodeSelector:
        hardware-type: gpu
      # 2. Bypass the bouncer blocking non-GPU apps
      tolerations:
      - key: "dedicated"
        operator: "Equal"
        value: "gpu"
        effect: "NoSchedule"
      containers:
      - name: pytorch
        image: pytorch/pytorch:latest
        command: ["sleep", "infinity"]
        # In a real scenario, you would also request GPU resources:
        # resources:
        #   limits:
        #     nvidia.com/gpu: 1
```

### Walkthrough & Architecture Notes
1.  **The Bouncer (Taints):** The cluster admin added a taint to the GPU nodes (`dedicated=gpu:NoSchedule`). Think of this as a bouncer at a VIP club. If a standard Nginx pod tries to schedule onto that node, the bouncer rejects it because the Nginx pod doesn't have a VIP pass (Toleration). This solves requirement #2 (protecting the expensive nodes).
2.  **The VIP Pass (Tolerations):** We added a `tolerations` block to our LLM Deployment. This is the VIP pass. It tells the Kubernetes scheduler, "I am allowed to bypass the `dedicated=gpu` bouncer."
3.  **The GPS (NodeSelector):** Just having a VIP pass doesn't mean the LLM Pod will actually go to the club. It might just wander into a regular bar (a standard CPU node). The `nodeSelector: hardware-type: gpu` acts as a GPS, explicitly forcing the scheduler to only consider nodes with that specific label.
4.  By combining Taints/Tolerations and NodeSelectors, you perfectly isolate specialized workloads in a multi-tenant cluster.
</details>
