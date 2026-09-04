FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
# poll data + generated secret live here; mount a volume to persist
RUN mkdir -p /app/data && chown node:node /app/data
ENV DATABASE_PATH=/app/data/showhands.db
# Behind a reverse proxy set ADDRESS_HEADER=X-Forwarded-For (and XFF_DEPTH=1);
# if clients hit the container directly set SHOWHANDS_NO_PROXY=1. The app
# refuses to start with neither, so per-IP rate limits can't silently break.
USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
