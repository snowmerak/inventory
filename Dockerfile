# Use Bun official image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock* ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bun run db:generate

# Copy source code
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .

# Production image
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

# Expose port
EXPOSE 3030

# Run the app
CMD ["bun", "run", "src/index.ts"]
