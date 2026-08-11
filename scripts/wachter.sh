#!/bin/sh
# Pen Neer — de wachter. Draait OP de host, buiten de container.
#
# WAAROM BUITEN. In de app zit een bewaaklus die naar de schijf, de kopie en de
# fouten kijkt. Die ziet alles behalve het ene geval dat het meest voorkomt:
# dat de app zelf niet meer draait. Een wachter die in het proces zit dat stuk
# is, meldt niets. Vandaar deze: hij staat ernaast en kijkt van buiten.
#
# WAT HIJ DOET. Elke vijf minuten /healthz opvragen. Twee keer achter elkaar
# mis is een storing (een keer mis kan een uitrol zijn, die duurt ongeveer een
# minuut). Dan gaat er een mail, en daarna hoogstens één per twee uur. Komt de
# app terug, dan volgt er een bericht dat het weer loopt: zonder dat blijf je
# na het eerste alarm in het ongewisse.
#
# DE SLEUTEL. De mail gaat via Resend, met dezelfde sleutel die de app zelf
# gebruikt. Die staat niet in dit bestand maar wordt uit de container gelezen,
# zodat er geen tweede plek is waar hij kan verlopen. Ligt de container plat,
# dan werkt `docker inspect` nog steeds: de omgeving zit in de configuratie,
# niet in het draaiende proces.
#
# INSTALLEREN (op de host, als root):
#   install -m 755 wachter.sh /usr/local/bin/penneer-wachter
#   ( crontab -l 2>/dev/null; echo '*/5 * * * * /usr/local/bin/penneer-wachter' ) | crontab -
#
# WAT DIT NIET ZIET. Sterft de machine zelf, dan zwijgt deze wachter net zo
# hard als de lus in de app. Daarvoor is een dienst van buiten nodig.

URL="${PENNEER_URL:-https://penneer.artnomad.nl/healthz}"
APP="${PENNEER_APP:-fakp5903ljd5puk0303xccjl}"
NAAR="${PENNEER_ALARM_NAAR:-kream.art@gmail.com}"
VAN="${PENNEER_MAIL_FROM:-Pen Neer <penneer@artnomad.nl>}"
STAAT="${PENNEER_STAAT:-/var/lib/penneer-wachter}"
HERHAAL=24          # 24 x 5 minuten = elke twee uur nog een keer

mkdir -p "$STAAT"
TELLER="$STAAT/mislukt"
[ -f "$TELLER" ] || echo 0 > "$TELLER"
n=$(cat "$TELLER")

sleutel() {
  [ -n "$RESEND_API_KEY" ] && { printf '%s' "$RESEND_API_KEY"; return; }
  c=$(docker ps -a --filter "name=$APP" -q | head -1)
  [ -n "$c" ] || return
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$c" \
    | sed -n 's/^RESEND_API_KEY=//p' | head -1
}

mail() {
  onderwerp="$1"; tekst="$2"
  k=$(sleutel)
  if [ -z "$k" ]; then
    logger -t penneer-wachter "geen RESEND_API_KEY; $onderwerp: $tekst"
    return
  fi
  curl -s -m 20 -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $k" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s"}' "$VAN" "$NAAR" "$onderwerp" "$tekst")" \
    > /dev/null
  logger -t penneer-wachter "$onderwerp: $tekst"
}

if curl -fsS -m 15 "$URL" > /dev/null 2>&1; then
  if [ "$n" -ge 2 ]; then
    mail "Pen Neer is weer bereikbaar" "Na $((n * 5)) minuten antwoordt $URL weer normaal."
  fi
  echo 0 > "$TELLER"
  exit 0
fi

n=$((n + 1))
echo "$n" > "$TELLER"
if [ "$n" -eq 2 ] || { [ "$n" -gt 2 ] && [ $(((n - 2) % HERHAAL)) -eq 0 ]; }; then
  mail "Pen Neer is niet bereikbaar" "$URL antwoordt al $((n * 5)) minuten niet."
fi
