# ---------- Build Stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Copy entire repository
COPY . .

# Build from backend
WORKDIR /app/backend

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build

# ---------- Production Stage ----------
FROM node:22-alpine

WORKDIR /app/backend

ENV NODE_ENV=production

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy Prisma schema
COPY backend/prisma ./prisma

# Copy build output
COPY --from=builder /app/backend/dist ./dist

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
