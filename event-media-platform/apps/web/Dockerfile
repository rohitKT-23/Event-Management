FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspaces --include-workspace-root=false || npm install

FROM node:20-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build -w @emp/shared && npm run build -w @emp/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/apps/web/.next ./.next
COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder /repo/apps/web/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
