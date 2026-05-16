FROM node:20-alpine
LABEL org.opencontainers.image.title="LearningTool"
LABEL org.opencontainers.image.description="智能论文阅读 & 刷题工具"

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application
COPY . .

# Ensure data directories exist
RUN mkdir -p data/ai-logs data/uploads data/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>{process.exit(r.statusCode===200?0:1)})"

# Run with full console output (no log suppression)
CMD ["node", "server.js"]
