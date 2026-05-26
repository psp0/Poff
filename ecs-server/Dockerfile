FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (caching layer)
COPY package.json ./
RUN npm install --production

# Copy server code
COPY server.js ./

# Copy Lambda functions
# Assuming the build context is the project root, so we copy from lambda/
COPY lambda ./lambda

# Copy shared assets (if needed locally, though CDN is preferred)
# If poff-assets are large, consider using S3/CloudFront instead
# COPY poff-assets ./poff-assets

# Environment variables (defaults)
ENV PORT=3000
ENV NODE_ENV=production
ENV LAMBDA_PATH=./lambda/functions
ENV NODE_OPTIONS="--max-old-space-size=640 --optimize-for-size"

# Expose port
EXPOSE 3000

# Start server with memory optimizations
CMD ["node", "--max-old-space-size=640", "--optimize-for-size", "--gc-interval=100", "server.js"]
