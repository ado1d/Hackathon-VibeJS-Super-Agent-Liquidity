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
# IMPORTANT: no trailing slash (e.g. https://backend.onrender.com, not https://backend.onrender.com/)
ENV BACKEND_URL=https://placeholder.invalid
# nginx.conf.template uses ${BACKEND_URL} — envsubst fills it at container startup.
# proxy_ssl_server_name on (in the template) auto-sends SNI based on this URL's host.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
