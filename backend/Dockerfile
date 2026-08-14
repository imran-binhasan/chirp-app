FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# The migration CLI and the schema it applies. Without these the image cannot
# run the `npm run prisma:deploy` step before rollout.
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY prisma ./prisma
# Recreated rather than copied: COPY dereferences symlinks, and a flattened
# copy of the CLI resolves its wasm assets relative to .bin/ and fails.
RUN ln -sf ../prisma/build/index.js node_modules/.bin/prisma
# Regenerate here so the client engines match the OpenSSL version actually
# present in this image, not whatever the build stage detected.
RUN npx prisma generate
COPY --from=build /app/dist ./dist

USER node
EXPOSE 4000
CMD ["sh", "-c", "npm run prisma:deploy && node dist/server.js"]