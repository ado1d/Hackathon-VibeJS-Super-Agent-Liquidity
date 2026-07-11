FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV BACKEND_URL=http://127.0.0.1:1
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/render.conf.template
COPY docker-entrypoint.sh /usr/local/bin/super-agent-entrypoint
COPY --from=build /app/dist /usr/share/nginx/html
RUN chmod +x /usr/local/bin/super-agent-entrypoint
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/super-agent-entrypoint"]
