# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production web server
FROM nginx:alpine

# Set default backend service target
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=5000

# Copy built frontend assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx template for dynamic environment variable substitution
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Expose HTTP port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
