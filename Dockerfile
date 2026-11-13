ARG PARENT_VERSION=3.2.8-node24.22.3
ARG PORT=3000
ARG PORT_DEBUG=9229

FROM defradigital/node-development:3.2.8-node24.22.3 AS development

ENV TZ="Europe/London"

ARG PORT
ARG PORT_DEBUG
ENV PORT=${PORT}
EXPOSE ${PORT} ${PORT_DEBUG}

COPY --chown=node:node --chmod=755 package*.json .npmrc ./
RUN npm ci --ignore-scripts
COPY --chown=node:node --chmod=755 . .
RUN npm run build

CMD [ "npm", "run", "start:dev" ]

FROM development AS production_build

ENV NODE_ENV=production

RUN npm run build

FROM defradigital/node:3.2.8-node24.22.3 AS production

ENV TZ="Europe/London"

# Add curl to template.
# CDP PLATFORM HEALTHCHECK REQUIREMENT
USER root
RUN apk add --no-cache curl
USER node

COPY --from=production_build /home/node/package*.json /home/node/.npmrc ./
COPY --from=production_build /home/node/src ./src/
COPY --from=production_build /home/node/.public/ ./.public/

RUN npm ci --omit=dev --ignore-scripts

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD [ "node", "src" ]
