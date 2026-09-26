FROM node:22-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate

COPY . .
RUN pnpm run build
RUN pnpm prune --prod \
  && node -e "if (!require('@prisma/client').Role) throw new Error('Prisma Client was not generated')"

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV LOCAL_UPLOAD_ROOT=./uploads

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

RUN mkdir -p /app/uploads \
  && chown node:node /app/uploads \
  && chmod 770 /app/uploads

USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
