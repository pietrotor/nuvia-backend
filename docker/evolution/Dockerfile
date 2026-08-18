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

# Evolution 2.3.7 only exposes findLabels + handleLabel, and label associations
# often fail to reach the phone when applied with a phone-number JID. The patch
# adds a find-or-create route (ensureLabel) and resolves LID before add/remove,
# so Nuvi can mirror the "human attention" handoff state onto a WhatsApp Business
# label. It only edits the bundled dist output — no messaging behaviour changes.
# Re-run and re-validate delivery after any base image / Baileys bump.
COPY patches/apply-label-patch.js /tmp/nuvia/apply-label-patch.js
RUN EVOLUTION_ROOT=/evolution node /tmp/nuvia/apply-label-patch.js \
  && grep -q 'routerPath("ensureLabel")' dist/main.js \
  && grep -q "async ensureLabel(" dist/main.js \
  && grep -q "async ensureLabel(" dist/api/integrations/channel/whatsapp/whatsapp.baileys.service.js
