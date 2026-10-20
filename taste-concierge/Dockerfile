# Railway (or any container host) image for the Taste Concierge demo.
# The Qloo harness is installed because it is the supported way to reach Qloo (see docs/API-NOTES.md).
FROM node:22-bookworm-slim
WORKDIR /app
RUN npm install -g @qloo/qloo-harness
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
# Set QLOO_API_KEY and NEBIUS_API_KEY as service variables on the host, never in this file.
EXPOSE 8787
CMD ["npm", "start"]
