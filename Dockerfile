FROM node:22-alpine AS dependencies

WORKDIR /app
COPY packages/docs/package.json packages/docs/package.json
COPY backend/package.json backend/package-lock.json backend/
WORKDIR /app/backend
RUN npm ci

FROM dependencies AS build

WORKDIR /app
COPY packages/docs packages/docs
COPY backend backend
WORKDIR /app/backend
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build --chown=node:node /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/prisma ./prisma
COPY --from=build --chown=node:node /app/backend/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/backend/scripts/start-production.js ./scripts/start-production.js
COPY --from=build --chown=node:node /app/packages/docs /app/packages/docs

RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "scripts/start-production.js"]
