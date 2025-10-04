# Installation Commands

## Install Dependencies
bun add @prisma/client ioredis argon2
bun add -d prisma @types/node

## Initialize Prisma (if not done)
bunx prisma init --datasource-provider mongodb

## Generate Prisma Client
bunx prisma generate

## Push schema to database (for development)
bunx prisma db push
