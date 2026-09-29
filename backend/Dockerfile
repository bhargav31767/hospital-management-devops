# Build and runtime stage for Node.js backend
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install dependencies separately for optimal Docker layer caching
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy application source
COPY . .

# Use non-root user provided by node image
USER node

# Expose backend port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5000/health || exit 1

# Start backend server
CMD ["node", "server.js"]
