FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Primero solo los package*.json: si no cambian, Docker reutiliza la capa de npm ci (caché)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["node", "app.js"]