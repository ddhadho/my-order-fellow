FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql \
    postgresql-client \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]