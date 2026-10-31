# Real-World Engineering Challenge 5: Zero-Downtime Blue-Green Deployment

## The Challenge Scenario
You are managing the deployment for a high-traffic financial API. The current deployment process involves running `docker-compose down && docker-compose up -d`. This causes roughly 15 seconds of downtime, resulting in hundreds of dropped API requests and angry customers.

Your task is to design a **Blue-Green Deployment Architecture** on a single server using Docker and Nginx as a reverse proxy, achieving absolute **Zero-Downtime deployments**.

### Strict Requirements
1. **Three Containers:** You will run an `nginx` container, an `api-blue` container (running v1 of your app), and an `api-green` container (running v2 of your app).
2. **Nginx Reverse Proxy:** The Nginx container must be the only container exposing a port to the host (`80:80`). It must route traffic to either the blue container or the green container based on its configuration file.
3. **The Deployment Script:** You must write a bash script (`deploy.sh`) that simulates a deployment. The script must:
    - Determine which environment (blue or green) is currently inactive.
    - Start the new version of the API in the inactive environment.
    - Wait for the new API to be healthy.
    - Hot-reload the Nginx configuration to point traffic to the newly started API.
    - Stop the old API container.

---

## Starter Template

### 1. `docker-compose.yml`
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    # TODO: Add a shared network

  # Imagine these are two distinct environments on the same server
  api-blue:
    image: hashicorp/http-echo
    command: -text="Hello from the BLUE environment (v1)"
    # TODO: Connect to the shared network

  api-green:
    image: hashicorp/http-echo
    command: -text="Hello from the GREEN environment (v2)"
    # TODO: Connect to the shared network

# TODO: Define the shared network
```

### 2. `nginx.conf`
```nginx
events {}

http {
    # TODO: Define an upstream block called 'backend'
    # By default, point it to api-blue on port 5678

    server {
        listen 80;

        location / {
            # TODO: Proxy pass to the 'backend' upstream
        }
    }
}
```

### 3. `deploy.sh` (The Brains)
```bash
#!/bin/bash
# TODO: Write a script to hot-swap the upstream from blue to green without dropping requests.
```

---

<details>
<summary><b>Click for Full Production Solution & Walkthrough</b></summary>

### The Complete Production Solution

**1. `docker-compose.yml`**
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      # Bind mount the config so we can edit it from the host script
      - ./nginx.conf:/etc/nginx/nginx.conf
    networks:
      - app_network

  api-blue:
    image: hashicorp/http-echo
    command: -text="Hello from the BLUE environment (v1)"
    networks:
      - app_network

  api-green:
    image: hashicorp/http-echo
    command: -text="Hello from the GREEN environment (v2)"
    networks:
      - app_network

networks:
  app_network:
```

**2. `nginx.conf`**
```nginx
events {}

http {
    upstream backend {
        # This will be manipulated by our deployment script
        server api-blue:5678;
    }

    server {
        listen 80;
        location / {
            proxy_pass http://backend;
        }
    }
}
```

**3. `deploy.sh` (The Bash Deployment Script)**
```bash
#!/bin/bash

# 1. Start the stack if it isn't running (Nginx and Blue)
echo "Starting baseline architecture..."
docker-compose up -d nginx api-blue

# 2. Check which environment is currently active in the nginx config
ACTIVE_ENV=$(grep -o "api-[a-z]*" nginx.conf)

if [ "$ACTIVE_ENV" == "api-blue" ]; then
    TARGET_ENV="api-green"
    OLD_ENV="api-blue"
else
    TARGET_ENV="api-blue"
    OLD_ENV="api-green"
fi

echo "Currently active: $ACTIVE_ENV. Deploying new version to: $TARGET_ENV"

# 3. Start the Target (Inactive) Environment
docker-compose up -d $TARGET_ENV

# 4. Wait for the Target Environment to be healthy
echo "Waiting for $TARGET_ENV to be ready..."
sleep 5 # In reality, you would curl an /health endpoint here in a loop

# 5. Hot-swap the Nginx Configuration!
echo "Hot-swapping Nginx configuration..."
# Use sed to replace the active server with the target server in the config file
sed -i "s/server $ACTIVE_ENV:5678/server $TARGET_ENV:5678/g" nginx.conf

# Tell the running Nginx container to gracefully reload its config.
# -s reload tells Nginx to start new worker processes with the new config,
# but let the old worker processes finish their current requests before dying.
# THIS is how we achieve Zero-Downtime!
docker exec $(docker-compose ps -q nginx) nginx -s reload

echo "Traffic is now routed to $TARGET_ENV."

# 6. Tear down the old environment to free up RAM/CPU
echo "Stopping $OLD_ENV..."
docker-compose stop $OLD_ENV

echo "Zero-Downtime Deployment Complete!"
```

### Walkthrough & Architecture Notes

1. **The Core Concept:** Nginx acts as the front door. Users never talk to the API containers directly. Because of this, Nginx can dynamically switch which internal container it forwards traffic to, without the user ever noticing a connection drop.
2. **`docker-compose scale` is dangerous:** A naive approach to deployment is `docker-compose up -d --build --scale api=2`. However, Docker's internal load balancer will immediately start sending 50% of traffic to the new container before it has fully booted, causing users to receive 502 Bad Gateway errors.
3. **`nginx -s reload`:** This is the most important command in the script. You *cannot* restart the Nginx container (`docker restart nginx`), because that drops all active connections. `nginx -s reload` is a graceful signal. Nginx reads the updated `nginx.conf`, spins up new worker threads pointing to `api-green`, and slowly drains traffic from the old threads pointing to `api-blue`.
4. **The Tear Down:** Once Nginx is routing to Green, Blue is completely idle. We stop it to save server resources. On the next deployment, the script will reverse the process, bringing Blue back up with the newest code, pointing Nginx to Blue, and tearing down Green.
</details>
