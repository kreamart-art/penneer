"""Een aankondiging aan alle spelers: in de app en op de telefoon.

Voor iets wat NIET uit een gebeurtenis komt, zoals "er is een nieuwe versie".
Draait in de app-container op productie:

    cat scripts/omroep.py | ssh root@<host> "docker exec -i <container> python -"

Twee dingen tegelijk, en met opzet in deze volgorde:

  1. de MELDING in de app, voor iedereen met een account. Die blijft staan tot
     hij hem wegveegt, dus ook wie vandaag niet kijkt ziet hem morgen nog;
  2. de PUSH op de telefoon, voor wie meldingen aan heeft staan. Die is
     vluchtig: hij komt binnen of hij komt niet binnen.

De melding gaat rechtstreeks de database in en niet via accounts.stuur(), want
dat is een methode van de DRAAIENDE server met zijn websockets erbij; een tweede
proces dat die aanroept praat tegen zijn eigen lege kopie. Wie nu online is ziet
hem dus bij zijn volgende verversing, en dat is precies goed genoeg voor een
bericht dat vraagt om de app te herstarten.
"""
import base64, json, os, sqlite3, time, urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

SOORT = "update"
TITEL = "Nieuwe versie"
BODY = "Sluit de app helemaal af en open hem opnieuw, dan werk je bij."
URL = "/"

con = sqlite3.connect("/data/penneer.db")
con.row_factory = sqlite3.Row

# ---- 1. de melding in de app ------------------------------------------------
nu = time.time()
spelers = [r["id"] for r in con.execute("SELECT id FROM users")]
gezet = 0
for uid in spelers:
    # Niet twee keer dezelfde aankondiging als het script per ongeluk opnieuw
    # draait: een omroep van vandaag telt als dezelfde omroep.
    al = con.execute(
        "SELECT 1 FROM meldingen WHERE user_id=? AND soort=? AND created_at > ?",
        (uid, SOORT, nu - 12 * 3600),
    ).fetchone()
    if al:
        continue
    con.execute(
        "INSERT INTO meldingen (user_id, soort, titel, body, icoon, naar, data, created_at, gelezen)"
        " VALUES (?,?,?,?,?,?,NULL,?,0)",
        (uid, SOORT, TITEL, BODY, "ster", "home", nu),
    )
    gezet += 1
con.commit()
print(f"meldingen gezet: {gezet} van {len(spelers)} accounts")

# ---- 2. de push op de telefoon ----------------------------------------------
subs = con.execute("SELECT endpoint, p256dh, auth, user_id FROM push_subs").fetchall()
rij = con.execute("SELECT value AS v FROM meta WHERE key='vapid_private'").fetchone()
if not rij or not subs:
    print("geen push verstuurd (geen sleutel of geen abonnementen)")
    raise SystemExit(0)

sk = serialization.load_pem_private_key(rij["v"].encode(), password=None)
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
unb64 = lambda s: base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
vapid_pub = sk.public_key().public_bytes(
    serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
)
payload = json.dumps({"title": TITEL, "body": BODY, "url": URL, "tag": SOORT}).encode()


def jwt_voor(origin: str) -> str:
    kop = b64(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    lijf = b64(json.dumps(
        {"aud": origin, "exp": int(time.time()) + 12 * 3600, "sub": "mailto:kream.art@gmail.com"},
        separators=(",", ":"),
    ).encode())
    der = sk.sign(f"{kop}.{lijf}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    return f"{kop}.{lijf}.{b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"


def versleutel(p256dh: str, auth: str, data: bytes) -> bytes:
    ua_pub_ruw = unb64(p256dh)
    ua_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_pub_ruw)
    as_priv = ec.generate_private_key(ec.SECP256R1())
    as_pub = as_priv.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    prk = HKDF(algorithm=hashes.SHA256(), length=32, salt=unb64(auth),
               info=b"WebPush: info\x00" + ua_pub_ruw + as_pub).derive(as_priv.exchange(ec.ECDH(), ua_pub))
    salt = os.urandom(16)
    cek = HKDF(algorithm=hashes.SHA256(), length=16, salt=salt,
               info=b"Content-Encoding: aes128gcm\x00").derive(prk)
    nonce = HKDF(algorithm=hashes.SHA256(), length=12, salt=salt,
                 info=b"Content-Encoding: nonce\x00").derive(prk)
    body = AESGCM(cek).encrypt(nonce, data + b"\x02", None)
    return salt + (4096).to_bytes(4, "big") + bytes([len(as_pub)]) + as_pub + body


goed = 0
for s in subs:
    origin = "/".join(s["endpoint"].split("/")[:3])
    req = urllib.request.Request(s["endpoint"], data=versleutel(s["p256dh"], s["auth"], payload), method="POST")
    req.add_header("Content-Encoding", "aes128gcm")
    req.add_header("Content-Type", "application/octet-stream")
    req.add_header("TTL", "86400")
    req.add_header("Authorization", f"vapid t={jwt_voor(origin)}, k={b64(vapid_pub)}")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            print(f"   {r.status} {origin.split('//')[-1]}")
            goed += 1
    except Exception as e:  # noqa: BLE001 - een dood abonnement mag de rest niet stoppen
        print(f"   FOUT {origin.split('//')[-1]}: {e}")
print(f"pushes verstuurd: {goed} van {len(subs)}")
