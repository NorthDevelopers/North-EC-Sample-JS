FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src

EXPOSE 8000

ENV PORT=8000

CMD ["bun", "run", "src/server.ts"]
