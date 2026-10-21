# Container image for the Taste Concierge demo (Railway or any container host).
# Build from the REPOSITORY ROOT, because the app uses the SDK in ../agent-runtime:
#   docker build -f taste-concierge/Dockerfile .
# On Railway: service root = the repository root, variable RAILWAY_DOCKERFILE_PATH=taste-concierge/Dockerfile.
# The Qloo harness is installed because it is the route the event kit lists as supported (see docs/API-NOTES.md).
FROM node:22-bookworm-slim
WORKDIR /app
RUN npm install -g @qloo/qloo-harness
COPY agent-runtime/package.json agent-runtime/package-lock.json agent-runtime/
RUN npm ci --prefix agent-runtime --omit=dev
COPY agent-runtime agent-runtime
COPY taste-concierge/package.json taste-concierge/package-lock.json taste-concierge/
RUN npm ci --prefix taste-concierge
COPY taste-concierge taste-concierge
WORKDIR /app/taste-concierge
ENV NODE_ENV=production
# Set QLOO_API_KEY and NEBIUS_API_KEY as service variables on the host, never in this file.
EXPOSE 8787
CMD ["npm", "start"]
