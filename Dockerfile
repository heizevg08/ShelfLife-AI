# Render needs one runtime for the Express API and the bundled Python forecasting
# worker. The Node-only runtime cannot start `ml/src/10_persistent_inference_worker.py`.
FROM node:24-bookworm-slim AS node-runtime

# The pinned model packages publish Python 3.14 wheels. Start from that runtime
# and copy the project's pinned Node 24 toolchain rather than relying on a
# distribution package with a different Node major version.
# The persisted joblib artifact records Python 3.14.7 in its metadata contract.
# Pin the runtime to that exact patch release; the floating 3.14-slim tag can
# advance independently and must not silently bypass the contract validation.
FROM python:3.14.7-slim

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
# npm and npx are symlinks in the Node image. Copying their launcher files alone
# breaks the launcher's relative require path, so recreate the links after copying
# the actual npm package.
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

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
ENV ML_STARTUP_TIMEOUT_MS=90000

CMD ["npm", "run", "start", "--workspace", "server"]
