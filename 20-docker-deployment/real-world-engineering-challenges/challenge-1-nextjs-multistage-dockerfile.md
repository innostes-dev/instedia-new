# Real-World Engineering Challenge 1: Next.js Multi-Stage Dockerfile

## The Challenge Scenario
You have been hired as a DevOps engineer for an e-commerce startup. Their frontend is built with Next.js. Currently, they deploy by running `npm run build` on a giant EC2 instance, and the server keeps crashing out of memory.

Your task is to write a highly optimized, production-ready `Dockerfile` for this Next.js application that meets the following strict enterprise requirements:

### Strict Requirements
1. **Multi-Stage Build:** You must use at least 3 stages (`deps`, `builder`, and `runner`).
2. **Alpine Base:** You must use `node:18-alpine` to keep the image size minimal.
3. **Non-Root User:** For security, the final running container **must not run as root**. It must run as the `nextjs` user.
4. **Standalone Output:** You must configure the runner to utilize Next.js's `standalone` output feature (which drastically reduces the required `node_modules` size). *Assume the developer has already set `output: 'standalone'` in their `next.config.js`.*
5. **Port:** The application must expose and listen on port `3000`.

---

## Starter Template
Create a file named `Dockerfile` in the root of your Next.js project. Use this skeleton:

```dockerfile
# ==========================================
# STAGE 1: Dependencies
# ==========================================
FROM node:18-alpine AS deps
# TODO: Install libc6-compat (often needed for alpine native modules)
# TODO: Set WORKDIR to /app
# TODO: Copy package.json and package-lock.json
# TODO: Run npm ci

# ==========================================
# STAGE 2: Builder
# ==========================================
FROM node:18-alpine AS builder
# TODO: Set WORKDIR to /app
# TODO: Copy node_modules from deps stage
# TODO: Copy all source code
# TODO: Run npm run build

# ==========================================
# STAGE 3: Production Runner
# ==========================================
FROM node:18-alpine AS runner
# TODO: Set WORKDIR to /app
# TODO: Set NODE_ENV to production
# TODO: Create a non-root group and user (e.g., nodejs / nextjs)
# TODO: Copy the public directory from the builder
# TODO: Copy the standalone directory from builder (.next/standalone)
# TODO: Copy the static directory from builder (.next/static)
# TODO: Set the correct user ownership and switch to the non-root user
# TODO: Expose port 3000
# TODO: Set the command to run the standalone server.js
```

---

<details>
<summary><b>Click for Full Production Solution & Walkthrough</b></summary>

### The Complete Production Dockerfile

```dockerfile
# ==========================================
# STAGE 1: Dependencies
# ==========================================
FROM node:18-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package lists and cleanly install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# STAGE 2: Builder
# ==========================================
FROM node:18-alpine AS builder
WORKDIR /app

# Copy deps from the previous stage for faster building
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application (Assumes output: 'standalone' in next.config.js)
RUN npm run build

# ==========================================
# STAGE 3: Production Runner
# ==========================================
FROM node:18-alpine AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Security: Create a non-root user and group
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Set correct permissions for the nextjs build folders
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Security: Switch to the non-root user
USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the standalone Node.js server
CMD ["node", "server.js"]
```

### Walkthrough & Architecture Notes

1. **Why `libc6-compat`?** Alpine uses `musl` instead of `glibc` for its C standard library. Many Node.js packages with native C++ bindings (like image optimization libraries used by Next.js) expect `glibc`. Adding this package prevents runtime crashes.
2. **The Standalone Output:** In Next.js 12+, setting `output: 'standalone'` makes Next.js analyze your code during the build and trace exactly which files in `node_modules` are actually used. It copies *only* those files into `.next/standalone`. We then copy that tiny folder into our runner, completely avoiding the need to run `npm install --production` or copy a massive 500MB `node_modules` folder!
3. **Security (Non-Root User):** By default, Docker runs everything as the `root` user. If a hacker finds a vulnerability in your Node app and gains arbitrary code execution, they have root access to the container! By creating the `nodejs` group and `nextjs` user, and explicitly calling `USER nextjs` at the end of the file, we strip those privileges.
4. **`--chown=nextjs:nodejs`:** When we `COPY` files from the builder, they are owned by root by default. We must use the `--chown` flag during the copy so our new restricted user has permission to read and execute them.
</details>
