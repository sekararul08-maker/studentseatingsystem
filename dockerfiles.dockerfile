# ============================================================================
# DOCKERFILE SYNTAX — Smart Examination Hall Seating Allocation System
# Two Dockerfiles in this project. Split at '==== FILE:' markers.
# ============================================================================

# ==== FILE: backend/Dockerfile ====
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN npx prisma generate

EXPOSE 5000

CMD ["node", "src/server.js"]


# ==== FILE: frontend/Dockerfile ====
# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
