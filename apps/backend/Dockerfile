# O build (tsc, prisma generate) gera só JavaScript: roda na arquitetura do runner, mesmo quando a
# imagem final é ARM (ADR 0011). Só o estágio de runtime usa a arquitetura de destino.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build

WORKDIR /app
ENV DATABASE_URL=mysql://user:password@localhost:3306/buffet_management

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npx prisma generate
RUN npx tsc -p tsconfig.build.json

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && addgroup -S app \
    && adduser -S app -G app \
    && chown -R app:app /app /usr/local/bin/docker-entrypoint.sh

USER app
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]