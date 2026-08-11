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
# Waar het alarm heen gaat. Let op: zolang artnomad.nl niet geverifieerd is bij
# Resend levert die alleen af op het adres van de Resend-rekening zelf, en gaat
# alles naar een ander adres met een 403 de prullenbak in. Is het domein wel
# geverifieerd, dan mag hier elk adres staan.
NAAR="${PENNEER_ALARM_NAAR:-mindlockresidence@gmail.com}"
STAAT="${PENNEER_STAAT:-/var/lib/penneer-wachter}"
HERHAAL=24          # 24 x 5 minuten = elke twee uur nog een keer

mkdir -p "$STAAT"
TELLER="$STAAT/mislukt"
[ -f "$TELLER" ] || echo 0 > "$TELLER"
n=$(cat "$TELLER")

uit_container() {
  c=$(docker ps -a --filter "name=$APP" -q | head -1)
  [ -n "$c" ] || return
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$c" \
    | sed -n "s/^$1=//p" | head -1
}

sleutel() {
  [ -n "$RESEND_API_KEY" ] && { printf '%s' "$RESEND_API_KEY"; return; }
  uit_container RESEND_API_KEY
}

# De afzender ook uit de container: staat daar iets anders dan het domein dat
# bij Resend geverifieerd is, dan weigert Resend de mail met een 403 en zou de
# wachter denken dat hij meldt terwijl er niets aankomt.
afzender() {
  [ -n "$PENNEER_MAIL_FROM" ] && { printf '%s' "$PENNEER_MAIL_FROM"; return; }
  uit_container PENNEER_MAIL_FROM
}

mail() {
  onderwerp="$1"; tekst="$2"
  k=$(sleutel)
  VAN=$(afzender)
  [ -n "$VAN" ] || VAN="onboarding@resend.dev"
  if [ -z "$k" ]; then
    logger -t penneer-wachter "geen RESEND_API_KEY; $onderwerp: $tekst"
    return
  fi
  # De code van Resend meelezen en meelogen. Een alarmmail die stilletjes
  # mislukt is het ergste wat een wachter kan overkomen: dan denk je dat je
  # bewaakt wordt terwijl er niets vertrekt.
  code=$(curl -s -m 20 -o /tmp/penneer-wachter.antwoord -w '%{http_code}' \
    -X POST https://api.resend.com/emails \
    -H "Authorization: Bearer $k" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"from":"%s","to":["%s"],"subject":"%s","text":"%s"}' "$VAN" "$NAAR" "$onderwerp" "$tekst")")
  if [ "$code" = "200" ]; then
    logger -t penneer-wachter "$onderwerp: $tekst"
  else
    logger -t penneer-wachter "MAIL MISLUKT ($code): $(head -c 200 /tmp/penneer-wachter.antwoord)"
  fi
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
