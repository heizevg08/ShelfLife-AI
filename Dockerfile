# Render needs one runtime for the Express API and the bundled Python forecasting
# worker. The Node-only runtime cannot start `ml/src/10_persistent_inference_worker.py`.
FROM node:24-bookworm-slim AS node-runtime

# The pinned model packages publish Python 3.14 wheels. Start from that runtime
# and copy the project's pinned Node 24 toolchain rather than relying on a
# distribution package with a different Node major version.
FROM python:3.14-slim

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/bin/npm /usr/local/bin/npm
COPY --from=node-runtime /usr/local/bin/npx /usr/local/bin/npx
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules

WORKDIR /app

# Copy manifests first so dependency layers remain cacheable between deployments.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --include=dev

COPY . .

# Debian marks the system Python as externally managed. The image is disposable, so
# installing the pinned, application-only worker dependencies here is intentional.
RUN python3 -m pip install --no-cache-dir -r ml/requirements-runtime.txt \
  && npm run build --workspace server

ENV NODE_ENV=production
ENV ML_PYTHON_EXECUTABLE=python3
ENV ML_WORKER_SCRIPT=ml/src/10_persistent_inference_worker.py

CMD ["npm", "run", "start", "--workspace", "server"]
