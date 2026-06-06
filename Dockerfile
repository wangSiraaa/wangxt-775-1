FROM node:18-alpine AS builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

COPY --from=builder /app/frontend/dist ./public

RUN mkdir -p /app/backend/data /app/backend/uploads

EXPOSE 3001

CMD ["sh", "-c", "npm run seed && npm start"]
