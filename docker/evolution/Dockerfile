# Evolution 2.3.7 pins baileys 7.0.0-rc.9, which predates the tc-token handling
# WhatsApp now requires. Without it every outbound message to a personal chat is
# nacked with 463 (NackCallerReachoutTimelocked) and never delivered, while
# inbound keeps working. No Evolution release ships a fixed baileys yet, so we
# override the dependency here.
# Upstream: https://github.com/evolution-foundation/evolution-api/issues/2597
ARG EVOLUTION_VERSION=v2.3.7
FROM evoapicloud/evolution-api:${EVOLUTION_VERSION}

ARG BAILEYS_VERSION=7.0.0-rc14
RUN npm install "baileys@${BAILEYS_VERSION}" --no-audit --no-fund \
  && test -f node_modules/baileys/lib/Utils/tc-token-utils.js
