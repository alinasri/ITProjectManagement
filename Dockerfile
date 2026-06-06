# Stage 1: Build React frontend
FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Run Express backend (serves API + built frontend)
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .
# Copy compiled React output into backend/public
COPY --from=builder /app/frontend/dist ./public

# SQLite database persisted in a volume
VOLUME /app/data
ENV DATA_DIR=/app/data
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "src/app.js"]
