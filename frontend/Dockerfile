FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
# Default backend URL — unreachable so you get a clean 502 (not a loop)
# if BACKEND_URL is not set. Override at runtime with your backend URL.
# IMPORTANT: NO trailing slash. Example:
#   https://super-agent-backend-xxxx.onrender.com
ENV BACKEND_URL=http://127.0.0.1:1
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080