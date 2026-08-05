#!/usr/bin/env bash
# Dev-only: waits for the WhatsApp session, then periodically sends a message
# and checks whether WhatsApp acknowledges it.
#
# Evolution stores its own Message.status as PENDING and often never updates it,
# so the only trustworthy delivery signal is a row in the MessageUpdate table.
set -u

cd "$(dirname "$0")/../.."

INSTANCE="${INSTANCE:-nuvi-bf5a5e7e-e12d-444d-9855-f7ec1daec436}"
APIKEY="${EVOLUTION_API_KEY:-nuvia-evolution-dev-key-change-me}"
SELF="${SELF_NUMBER:-59164939566}"
CONTACT="${CONTACT_NUMBER:-59169531998}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

send_probe() {
  local number="$1" label="$2"
  local resp id status

  resp=$(curl -sS --max-time 20 -X POST "http://localhost:8080/message/sendText/${INSTANCE}" \
    -H "apikey: ${APIKEY}" -H 'content-type: application/json' \
    -d "{\"number\":\"${number}\",\"text\":\"Sonda Nuvi ${label} $(date +%H:%M:%S)\"}" 2>&1)

  id=$(printf '%s' "$resp" | python3 -c 'import json,sys
try: print(json.load(sys.stdin)["key"]["id"])
except Exception: print("")' 2>/dev/null)

  if [ -z "$id" ]; then
    log "  ${label}: envio RECHAZADO -> $(printf '%s' "$resp" | head -c 160)"
    return
  fi

  for _ in $(seq 1 6); do
    sleep 5
    status=$(docker compose exec -T db psql -U postgres -d evolution -t -A \
      -c "select status from \"MessageUpdate\" where \"keyId\"='${id}' order by id desc limit 1;" \
      2>/dev/null | tr -d ' \n')
    if [ -n "$status" ]; then
      log "  ${label}: ACK=${status} (entregado)"
      return
    fi
  done
  log "  ${label}: SIN ACK en 30s (no entregado)"
}

state=""
log "Esperando vinculacion..."
for _ in $(seq 1 2880); do
  state=$(curl -sS --max-time 10 -H "apikey: ${APIKEY}" \
    "http://localhost:8080/instance/connectionState/${INSTANCE}" 2>/dev/null \
    | python3 -c 'import json,sys
try: print(json.load(sys.stdin)["instance"]["state"])
except Exception: print("")' 2>/dev/null)
  [ "$state" = "open" ] && break
  sleep 5
done

if [ "$state" != "open" ]; then
  log "NUNCA SE VINCULO. Sin escaneo no hay nada que probar."
  exit 0
fi

log "VINCULADO. Probando envio inmediato."
send_probe "$SELF" "nota-propia"
send_probe "$CONTACT" "contacto"

for cycle in $(seq 1 12); do
  sleep 180
  log "--- ciclo ${cycle} (t+$((cycle * 3)) min desde la vinculacion) ---"
  send_probe "$SELF" "nota-propia"
  if [ $((cycle % 2)) -eq 0 ]; then
    send_probe "$CONTACT" "contacto"
  fi
done

log "FIN DE LA SONDA"
