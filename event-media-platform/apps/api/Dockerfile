# Multi-stage build for the API + worker
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspaces --include-workspace-root=false || npm install

FROM node:20-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @emp/shared && npm run build -w @emp/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Sharp requires libvips
RUN apk add --no-cache vips-dev fftw-dev gcc g++ make libc6-compat
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/server.js"]
