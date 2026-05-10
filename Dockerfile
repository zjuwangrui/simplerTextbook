ARG NODE_BASE_IMAGE=node:20-alpine
ARG PYTHON_BASE_IMAGE=python:3.12-slim

FROM ${NODE_BASE_IMAGE} AS frontend-build

ARG NPM_REGISTRY=

WORKDIR /build/frontend

COPY src/frontend/package.json src/frontend/tsconfig.json src/frontend/tsconfig.node.json src/frontend/vite.config.ts ./
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi \
    && npm install

COPY src/frontend/index.html ./
COPY src/frontend/src ./src
RUN npm run build

FROM ${PYTHON_BASE_IMAGE} AS runtime

ARG PIP_INDEX_URL=
ARG PIP_EXTRA_INDEX_URL=

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV APP_HOST=0.0.0.0
ENV APP_PORT=5000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY src/backend/requirements.txt /app/src/backend/requirements.txt
RUN if [ -n "$PIP_INDEX_URL" ]; then pip config set global.index-url "$PIP_INDEX_URL"; fi \
    && if [ -n "$PIP_EXTRA_INDEX_URL" ]; then pip config set global.extra-index-url "$PIP_EXTRA_INDEX_URL"; fi \
    && pip install --no-cache-dir -r /app/src/backend/requirements.txt

COPY src/backend /app/src/backend
COPY deploy/nginx.modelscope.conf /etc/nginx/conf.d/default.conf
COPY deploy/start-modelscope.sh /app/start-modelscope.sh
COPY --from=frontend-build /build/frontend/dist /usr/share/nginx/html

RUN chmod +x /app/start-modelscope.sh \
    && mkdir -p /app/runtime/data/textbooks /app/runtime/uploads /app/runtime/logs /app/runtime/reports

EXPOSE 7860

CMD ["/app/start-modelscope.sh"]
