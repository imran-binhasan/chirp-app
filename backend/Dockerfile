FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# The migration CLI and the schema it applies. Without these the image cannot
# run the `npm run prisma:deploy` step the README prescribes before rollout.
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY prisma ./prisma
# Recreated rather than copied: COPY dereferences symlinks, and a flattened
# copy of the CLI resolves its wasm assets relative to .bin/ and fails.
#
# prisma.config.ts is deliberately left out — it needs a TypeScript loader that
# prod dependencies do not include, and everything it sets (schema path, seed
# command) is either the default or dev-only. DATABASE_URL comes from the
# environment here, not a .env file.
RUN ln -sf ../prisma/build/index.js node_modules/.bin/prisma
COPY --from=build /app/dist ./dist

USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
