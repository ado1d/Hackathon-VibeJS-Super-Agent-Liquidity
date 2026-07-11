FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Default backend URL — override via BACKEND_URL env var at runtime.
# The 15-extract-backend-host.sh script strips trailing slash and extracts
# BACKEND_HOST for SSL SNI before nginx processes the template.
ENV BACKEND_URL=https://placeholder.invalid
# nginx.conf.template uses ${BACKEND_URL} and ${BACKEND_HOST} — envsubst
# fills them at container startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Script that runs before envsubst to extract BACKEND_HOST from BACKEND_URL.
COPY 15-extract-backend-host.sh /docker-entrypoint.d/15-extract-backend-host.sh
RUN chmod +x /docker-entrypoint.d/15-extract-backend-host.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
