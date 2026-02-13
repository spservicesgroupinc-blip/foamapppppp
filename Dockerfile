# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using npm ci for reproducible builds
# Increase timeout and retry settings for reliability
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 30000 && \
    npm config set fetch-timeout 300000 && \
    npm ci --prefer-offline || npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
