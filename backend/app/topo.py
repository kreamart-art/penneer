"""Pen Neer — Topografie, het tweede deel van de Dagronde.

Dezelfde afspraak als het woordendeel (`daily.py`): iedereen krijgt op een dag
dezelfde vragen, afgeleid uit de datum, dus geen enkele server hoeft iets op te
slaan om het eens te zijn. Alleen gaat het hier niet om een letter maar om acht
aardrijkskundevragen.

De vragen komen EEN VOOR EEN, met vijftien seconden per vraag, net als een
duelronde. Elke vraag wordt apart uitgeserveerd en door de server gestempeld: de
app sluiten en heropenen levert dus geen bedenktijd op, en je ziet de volgende
vraag pas als de vorige voorbij is.

Antwoorden worden getypt, niet aangeklikt. Dat past bij de rest van het spel,
maar het betekent wel dat spelfouten in eigennamen ("Kopenhagen" met een c)
verkeerd zouden vallen. Daarom mag een antwoord een paar letters afwijken,
precies zoals de soepele spelling in de rondes werkt, en met de accountoptie aan
mag het er nog eentje meer naast zitten.

De bank staat tweetalig: de vraag heeft een Nederlandse en een Engelse tekst,
maar de goede antwoorden zitten in EEN lijst met beide talen erin. Zo blijft de
dagranglijst vergelijkbaar, ongeacht in welke taal je speelt.
"""
from __future__ import annotations

import datetime as dt
import random

from .game import _edit_distance_capped, normalize

QUESTIONS_PER_DAY = 8
QUESTION_S = 15          # per vraag, net als een duelronde
GRACE_S = 5              # speling voor het netwerk bovenop die 15
DURATION_S = QUESTIONS_PER_DAY * QUESTION_S
POINTS_PER_ANSWER = 10   # 8 x 10 = 80 maximaal
BOARD_LIMIT = 25

# Elke vraag: id, de vraag in het Nederlands en Engels, en alle antwoorden die
# goed zijn (beide talen, plus gangbare schrijfwijzen). Het id is stabiel: het
# staat in de dagseed, dus hernummeren verandert oude dagen met terugwerkende
# kracht. Nieuwe vragen krijgen een nieuw id, achteraan.
BANK: list[dict] = [
    # --- Nederland en Belgie ---
    {"id": "nl-hoofdstad", "nl": "Wat is de hoofdstad van Nederland?", "en": "What is the capital of the Netherlands?", "a": ["Amsterdam"]},
    {"id": "nl-regering", "nl": "In welke stad zetelt de Nederlandse regering?", "en": "In which city does the Dutch government sit?", "a": ["Den Haag", "The Hague", "s-Gravenhage", "'s-Gravenhage"]},
    {"id": "be-hoofdstad", "nl": "Wat is de hoofdstad van Belgie?", "en": "What is the capital of Belgium?", "a": ["Brussel", "Brussels", "Bruxelles"]},
    {"id": "prov-maastricht", "nl": "In welke provincie ligt Maastricht?", "en": "Which province is Maastricht in?", "a": ["Limburg"]},
    {"id": "prov-eindhoven", "nl": "In welke provincie ligt Eindhoven?", "en": "Which province is Eindhoven in?", "a": ["Noord-Brabant", "Brabant", "North Brabant"]},
    {"id": "prov-middelburg", "nl": "In welke provincie ligt Middelburg?", "en": "Which province is Middelburg in?", "a": ["Zeeland"]},
    {"id": "prov-lelystad", "nl": "In welke provincie ligt Lelystad?", "en": "Which province is Lelystad in?", "a": ["Flevoland"]},
    {"id": "prov-enschede", "nl": "In welke provincie ligt Enschede?", "en": "Which province is Enschede in?", "a": ["Overijssel"]},
    {"id": "hs-friesland", "nl": "Wat is de hoofdstad van Friesland?", "en": "What is the capital of Friesland?", "a": ["Leeuwarden", "Ljouwert"]},
    {"id": "hs-gelderland", "nl": "Wat is de hoofdstad van Gelderland?", "en": "What is the capital of Gelderland?", "a": ["Arnhem"]},
    {"id": "hs-overijssel", "nl": "Wat is de hoofdstad van Overijssel?", "en": "What is the capital of Overijssel?", "a": ["Zwolle"]},
    {"id": "hs-drenthe", "nl": "Wat is de hoofdstad van Drenthe?", "en": "What is the capital of Drenthe?", "a": ["Assen"]},
    {"id": "hs-noordholland", "nl": "Wat is de hoofdstad van Noord-Holland?", "en": "What is the capital of North Holland?", "a": ["Haarlem"]},
    {"id": "hs-noordbrabant", "nl": "Wat is de hoofdstad van Noord-Brabant?", "en": "What is the capital of North Brabant?", "a": ["Den Bosch", "s-Hertogenbosch", "'s-Hertogenbosch", "Den Bosch"]},
    {"id": "nl-zuiden", "nl": "Welk land ligt ten zuiden van Nederland?", "en": "Which country lies south of the Netherlands?", "a": ["Belgie", "Belgium"]},
    {"id": "nl-oosten", "nl": "Welk land ligt ten oosten van Nederland?", "en": "Which country lies east of the Netherlands?", "a": ["Duitsland", "Germany"]},
    {"id": "land-antwerpen", "nl": "In welk land ligt Antwerpen?", "en": "Which country is Antwerp in?", "a": ["Belgie", "Belgium"]},
    {"id": "sur-hoofdstad", "nl": "Wat is de hoofdstad van Suriname?", "en": "What is the capital of Suriname?", "a": ["Paramaribo"]},
    {"id": "cur-hoofdstad", "nl": "Wat is de hoofdstad van Curacao?", "en": "What is the capital of Curacao?", "a": ["Willemstad"]},
    {"id": "aru-hoofdstad", "nl": "Wat is de hoofdstad van Aruba?", "en": "What is the capital of Aruba?", "a": ["Oranjestad"]},

    # --- Europese hoofdsteden ---
    {"id": "hs-frankrijk", "nl": "Wat is de hoofdstad van Frankrijk?", "en": "What is the capital of France?", "a": ["Parijs", "Paris"]},
    {"id": "hs-duitsland", "nl": "Wat is de hoofdstad van Duitsland?", "en": "What is the capital of Germany?", "a": ["Berlijn", "Berlin"]},
    {"id": "hs-spanje", "nl": "Wat is de hoofdstad van Spanje?", "en": "What is the capital of Spain?", "a": ["Madrid"]},
    {"id": "hs-italie", "nl": "Wat is de hoofdstad van Italie?", "en": "What is the capital of Italy?", "a": ["Rome", "Roma"]},
    {"id": "hs-portugal", "nl": "Wat is de hoofdstad van Portugal?", "en": "What is the capital of Portugal?", "a": ["Lissabon", "Lisbon", "Lisboa"]},
    {"id": "hs-griekenland", "nl": "Wat is de hoofdstad van Griekenland?", "en": "What is the capital of Greece?", "a": ["Athene", "Athens"]},
    {"id": "hs-oostenrijk", "nl": "Wat is de hoofdstad van Oostenrijk?", "en": "What is the capital of Austria?", "a": ["Wenen", "Vienna", "Wien"]},
    {"id": "hs-zwitserland", "nl": "Wat is de hoofdstad van Zwitserland?", "en": "What is the capital of Switzerland?", "a": ["Bern", "Berne"]},
    {"id": "hs-polen", "nl": "Wat is de hoofdstad van Polen?", "en": "What is the capital of Poland?", "a": ["Warschau", "Warsaw", "Warszawa"]},
    {"id": "hs-zweden", "nl": "Wat is de hoofdstad van Zweden?", "en": "What is the capital of Sweden?", "a": ["Stockholm"]},
    {"id": "hs-noorwegen", "nl": "Wat is de hoofdstad van Noorwegen?", "en": "What is the capital of Norway?", "a": ["Oslo"]},
    {"id": "hs-denemarken", "nl": "Wat is de hoofdstad van Denemarken?", "en": "What is the capital of Denmark?", "a": ["Kopenhagen", "Copenhagen", "Kobenhavn"]},
    {"id": "hs-finland", "nl": "Wat is de hoofdstad van Finland?", "en": "What is the capital of Finland?", "a": ["Helsinki"]},
    {"id": "hs-ierland", "nl": "Wat is de hoofdstad van Ierland?", "en": "What is the capital of Ireland?", "a": ["Dublin"]},
    {"id": "hs-vk", "nl": "Wat is de hoofdstad van het Verenigd Koninkrijk?", "en": "What is the capital of the United Kingdom?", "a": ["Londen", "London"]},
    {"id": "hs-hongarije", "nl": "Wat is de hoofdstad van Hongarije?", "en": "What is the capital of Hungary?", "a": ["Boedapest", "Budapest"]},
    {"id": "hs-tsjechie", "nl": "Wat is de hoofdstad van Tsjechie?", "en": "What is the capital of Czechia?", "a": ["Praag", "Prague", "Praha"]},
    {"id": "hs-roemenie", "nl": "Wat is de hoofdstad van Roemenie?", "en": "What is the capital of Romania?", "a": ["Boekarest", "Bucharest", "Bucuresti"]},
    {"id": "hs-kroatie", "nl": "Wat is de hoofdstad van Kroatie?", "en": "What is the capital of Croatia?", "a": ["Zagreb"]},
    {"id": "hs-ijsland", "nl": "Wat is de hoofdstad van IJsland?", "en": "What is the capital of Iceland?", "a": ["Reykjavik"]},
    {"id": "hs-turkije", "nl": "Wat is de hoofdstad van Turkije?", "en": "What is the capital of Turkey?", "a": ["Ankara"]},
    {"id": "hs-rusland", "nl": "Wat is de hoofdstad van Rusland?", "en": "What is the capital of Russia?", "a": ["Moskou", "Moscow", "Moskva"]},
    {"id": "hs-servie", "nl": "Wat is de hoofdstad van Servie?", "en": "What is the capital of Serbia?", "a": ["Belgrado", "Belgrade", "Beograd"]},
    {"id": "hs-bulgarije", "nl": "Wat is de hoofdstad van Bulgarije?", "en": "What is the capital of Bulgaria?", "a": ["Sofia"]},

    # --- Wereld ---
    {"id": "hs-japan", "nl": "Wat is de hoofdstad van Japan?", "en": "What is the capital of Japan?", "a": ["Tokio", "Tokyo"]},
    {"id": "hs-china", "nl": "Wat is de hoofdstad van China?", "en": "What is the capital of China?", "a": ["Peking", "Beijing"]},
    {"id": "hs-india", "nl": "Wat is de hoofdstad van India?", "en": "What is the capital of India?", "a": ["New Delhi", "Nieuw-Delhi", "Delhi"]},
    {"id": "hs-brazilie", "nl": "Wat is de hoofdstad van Brazilie?", "en": "What is the capital of Brazil?", "a": ["Brasilia"]},
    {"id": "hs-argentinie", "nl": "Wat is de hoofdstad van Argentinie?", "en": "What is the capital of Argentina?", "a": ["Buenos Aires"]},
    {"id": "hs-canada", "nl": "Wat is de hoofdstad van Canada?", "en": "What is the capital of Canada?", "a": ["Ottawa"]},
    {"id": "hs-vs", "nl": "Wat is de hoofdstad van de Verenigde Staten?", "en": "What is the capital of the United States?", "a": ["Washington", "Washington DC"]},
    {"id": "hs-australie", "nl": "Wat is de hoofdstad van Australie?", "en": "What is the capital of Australia?", "a": ["Canberra"]},
    {"id": "hs-egypte", "nl": "Wat is de hoofdstad van Egypte?", "en": "What is the capital of Egypt?", "a": ["Cairo", "Kairo"]},
    {"id": "hs-marokko", "nl": "Wat is de hoofdstad van Marokko?", "en": "What is the capital of Morocco?", "a": ["Rabat"]},
    {"id": "hs-kenia", "nl": "Wat is de hoofdstad van Kenia?", "en": "What is the capital of Kenya?", "a": ["Nairobi"]},
    {"id": "hs-nigeria", "nl": "Wat is de hoofdstad van Nigeria?", "en": "What is the capital of Nigeria?", "a": ["Abuja"]},
    {"id": "hs-indonesie", "nl": "Wat is de hoofdstad van Indonesie?", "en": "What is the capital of Indonesia?", "a": ["Jakarta", "Djakarta"]},
    {"id": "hs-thailand", "nl": "Wat is de hoofdstad van Thailand?", "en": "What is the capital of Thailand?", "a": ["Bangkok"]},
    {"id": "hs-peru", "nl": "Wat is de hoofdstad van Peru?", "en": "What is the capital of Peru?", "a": ["Lima"]},
    {"id": "hs-cuba", "nl": "Wat is de hoofdstad van Cuba?", "en": "What is the capital of Cuba?", "a": ["Havana", "Havanna", "La Habana"]},
    {"id": "hs-zuidkorea", "nl": "Wat is de hoofdstad van Zuid-Korea?", "en": "What is the capital of South Korea?", "a": ["Seoel", "Seoul"]},
    {"id": "hs-iran", "nl": "Wat is de hoofdstad van Iran?", "en": "What is the capital of Iran?", "a": ["Teheran", "Tehran"]},
    {"id": "hs-pakistan", "nl": "Wat is de hoofdstad van Pakistan?", "en": "What is the capital of Pakistan?", "a": ["Islamabad"]},
    {"id": "hs-nieuwzeeland", "nl": "Wat is de hoofdstad van Nieuw-Zeeland?", "en": "What is the capital of New Zealand?", "a": ["Wellington"]},
    {"id": "hs-ethiopie", "nl": "Wat is de hoofdstad van Ethiopie?", "en": "What is the capital of Ethiopia?", "a": ["Addis Abeba", "Addis Ababa"]},
    {"id": "hs-ghana", "nl": "Wat is de hoofdstad van Ghana?", "en": "What is the capital of Ghana?", "a": ["Accra"]},
    {"id": "hs-vietnam", "nl": "Wat is de hoofdstad van Vietnam?", "en": "What is the capital of Vietnam?", "a": ["Hanoi"]},
    {"id": "hs-chili", "nl": "Wat is de hoofdstad van Chili?", "en": "What is the capital of Chile?", "a": ["Santiago"]},
    {"id": "hs-colombia", "nl": "Wat is de hoofdstad van Colombia?", "en": "What is the capital of Colombia?", "a": ["Bogota"]},

    # --- Waar ligt het? ---
    {"id": "land-eiffel", "nl": "In welk land staat de Eiffeltoren?", "en": "Which country is the Eiffel Tower in?", "a": ["Frankrijk", "France"]},
    {"id": "land-colosseum", "nl": "In welk land staat het Colosseum?", "en": "Which country is the Colosseum in?", "a": ["Italie", "Italy"]},
    {"id": "land-sagrada", "nl": "In welk land staat de Sagrada Familia?", "en": "Which country is the Sagrada Familia in?", "a": ["Spanje", "Spain"]},
    {"id": "land-akropolis", "nl": "In welk land staat de Akropolis?", "en": "Which country is the Acropolis in?", "a": ["Griekenland", "Greece"]},
    {"id": "land-tajmahal", "nl": "In welk land staat de Taj Mahal?", "en": "Which country is the Taj Mahal in?", "a": ["India"]},
    {"id": "land-muur", "nl": "In welk land ligt de Chinese Muur?", "en": "Which country is the Great Wall in?", "a": ["China"]},
    {"id": "land-machu", "nl": "In welk land ligt Machu Picchu?", "en": "Which country is Machu Picchu in?", "a": ["Peru"]},
    {"id": "land-kilimanjaro", "nl": "In welk land ligt de Kilimanjaro?", "en": "Which country is Kilimanjaro in?", "a": ["Tanzania"]},
    {"id": "land-piramides", "nl": "In welk land liggen de piramides van Gizeh?", "en": "Which country are the pyramids of Giza in?", "a": ["Egypte", "Egypt"]},
    {"id": "land-kremlin", "nl": "In welk land staat het Kremlin?", "en": "Which country is the Kremlin in?", "a": ["Rusland", "Russia"]},
    {"id": "land-atomium", "nl": "In welk land staat het Atomium?", "en": "Which country is the Atomium in?", "a": ["Belgie", "Belgium"]},
    {"id": "land-stonehenge", "nl": "In welk land ligt Stonehenge?", "en": "Which country is Stonehenge in?", "a": ["Engeland", "England", "Verenigd Koninkrijk", "United Kingdom", "Groot-Brittannie"]},
    {"id": "land-hollywood", "nl": "In welk land ligt Hollywood?", "en": "Which country is Hollywood in?", "a": ["Verenigde Staten", "United States", "Amerika", "America", "USA", "VS"]},
    {"id": "land-bali", "nl": "In welk land ligt Bali?", "en": "Which country is Bali in?", "a": ["Indonesie", "Indonesia"]},
    {"id": "land-ibiza", "nl": "In welk land ligt Ibiza?", "en": "Which country is Ibiza in?", "a": ["Spanje", "Spain"]},
    {"id": "land-sicilie", "nl": "In welk land ligt Sicilie?", "en": "Which country is Sicily in?", "a": ["Italie", "Italy"]},
    {"id": "land-kreta", "nl": "In welk land ligt Kreta?", "en": "Which country is Crete in?", "a": ["Griekenland", "Greece"]},
    {"id": "land-casablanca", "nl": "In welk land ligt Casablanca?", "en": "Which country is Casablanca in?", "a": ["Marokko", "Morocco"]},
    {"id": "land-istanbul", "nl": "In welk land ligt Istanbul?", "en": "Which country is Istanbul in?", "a": ["Turkije", "Turkey"]},
    {"id": "land-dubai", "nl": "In welk land ligt Dubai?", "en": "Which country is Dubai in?", "a": ["Verenigde Arabische Emiraten", "United Arab Emirates", "Emiraten", "UAE", "VAE"]},
    {"id": "land-zurich", "nl": "In welk land ligt Zurich?", "en": "Which country is Zurich in?", "a": ["Zwitserland", "Switzerland"]},
    {"id": "land-everest", "nl": "In welk land ligt de Mount Everest?", "en": "Which country is Mount Everest in?", "a": ["Nepal", "China", "Tibet"]},
    {"id": "land-montblanc", "nl": "In welk land ligt de Mont Blanc?", "en": "Which country is Mont Blanc in?", "a": ["Frankrijk", "France", "Italie", "Italy"]},

    # --- Werelddelen ---
    {"id": "wd-egypte", "nl": "Op welk werelddeel ligt Egypte?", "en": "Which continent is Egypt on?", "a": ["Afrika", "Africa"]},
    {"id": "wd-brazilie", "nl": "Op welk werelddeel ligt Brazilie?", "en": "Which continent is Brazil on?", "a": ["Zuid-Amerika", "South America"]},
    {"id": "wd-japan", "nl": "Op welk werelddeel ligt Japan?", "en": "Which continent is Japan on?", "a": ["Azie", "Asia"]},
    {"id": "wd-noorwegen", "nl": "Op welk werelddeel ligt Noorwegen?", "en": "Which continent is Norway on?", "a": ["Europa", "Europe"]},
    {"id": "wd-mexico", "nl": "Op welk werelddeel ligt Mexico?", "en": "Which continent is Mexico on?", "a": ["Noord-Amerika", "North America"]},
    {"id": "wd-sahara", "nl": "Op welk werelddeel ligt de Sahara?", "en": "Which continent is the Sahara on?", "a": ["Afrika", "Africa"]},
    {"id": "wd-grootste", "nl": "Wat is het grootste werelddeel?", "en": "What is the largest continent?", "a": ["Azie", "Asia"]},

    # --- Water en bergen ---
    {"id": "riv-parijs", "nl": "Welke rivier stroomt door Parijs?", "en": "Which river flows through Paris?", "a": ["Seine"]},
    {"id": "riv-londen", "nl": "Welke rivier stroomt door Londen?", "en": "Which river flows through London?", "a": ["Theems", "Thames"]},
    {"id": "riv-rome", "nl": "Welke rivier stroomt door Rome?", "en": "Which river flows through Rome?", "a": ["Tiber"]},
    {"id": "riv-donau", "nl": "Welke rivier stroomt door Wenen en Boedapest?", "en": "Which river flows through Vienna and Budapest?", "a": ["Donau", "Danube"]},
    {"id": "riv-egypte", "nl": "Welke rivier stroomt door Egypte?", "en": "Which river flows through Egypt?", "a": ["Nijl", "Nile"]},
    {"id": "riv-zuidamerika", "nl": "Wat is de langste rivier van Zuid-Amerika?", "en": "What is the longest river in South America?", "a": ["Amazone", "Amazon"]},
    {"id": "zee-noord", "nl": "Welke zee ligt ten noorden van Nederland?", "en": "Which sea lies north of the Netherlands?", "a": ["Noordzee", "North Sea"]},
    {"id": "zee-europa-afrika", "nl": "Welke zee ligt tussen Europa en Afrika?", "en": "Which sea lies between Europe and Africa?", "a": ["Middellandse Zee", "Mediterranean", "Mediterranean Sea"]},
    {"id": "oc-europa-amerika", "nl": "Welke oceaan ligt tussen Europa en Amerika?", "en": "Which ocean lies between Europe and America?", "a": ["Atlantische Oceaan", "Atlantic", "Atlantic Ocean"]},
    {"id": "oc-grootste", "nl": "Wat is de grootste oceaan?", "en": "What is the largest ocean?", "a": ["Grote Oceaan", "Stille Oceaan", "Pacific", "Pacific Ocean"]},
    {"id": "meer-afrika", "nl": "Wat is het grootste meer van Afrika?", "en": "What is the largest lake in Africa?", "a": ["Victoriameer", "Lake Victoria", "Victoria"]},

    # --- Records ---
    {"id": "rec-kleinste", "nl": "Wat is het kleinste land ter wereld?", "en": "What is the smallest country in the world?", "a": ["Vaticaanstad", "Vaticaan", "Vatican", "Vatican City"]},
    {"id": "rec-grootste", "nl": "Wat is het grootste land ter wereld?", "en": "What is the largest country in the world?", "a": ["Rusland", "Russia"]},
]

BANK_BY_ID = {q["id"]: q for q in BANK}


# De vragen worden per CYCLUS uitgedeeld in plaats van elke dag opnieuw geloot.
# Loten per dag kan dezelfde vraag twee dagen achter elkaar opleveren, en dat
# "niet die van gisteren"-lapje eromheen wordt al snel troebel. Nu schudden we de
# hele bank een keer per cyclus en delen we hem uit in plakjes van acht: binnen
# een cyclus krijg je dus gegarandeerd geen enkele vraag twee keer, en bij de
# volgende cyclus ligt de volgorde weer anders. Alles blijft afleidbaar uit de
# datum, dus er hoeft niets opgeslagen te worden.
ANCHOR = dt.date(2026, 1, 1)
DAYS_PER_CYCLE = max(1, len(BANK) // QUESTIONS_PER_DAY)


def _raw_order(cycle: int) -> list[dict]:
    order = list(BANK)
    random.Random(f"penneer-topo:cycle:{cycle}").shuffle(order)
    return order


def _cycle_order(cycle: int) -> list[dict]:
    """De volgorde waarin een cyclus wordt uitgedeeld.

    Binnen een cyclus zit elke vraag maar op een plek, dus daar kan niets
    herhalen. Alleen op de grens tussen twee cycli kan de eerste dag botsen met
    de laatste dag ervoor. Die botsers RUILEN we met een vraag verderop, in
    plaats van er een bij te halen: bijhalen zou die vraag twee keer uitdelen.

    De ruilpartner komt nooit uit het eerste of het laatste plakje. Daardoor is de
    staart van een cyclus altijd gelijk aan de ongeschudde staart, en kan de
    volgende cyclus daarop rekenen zonder zichzelf te hoeven uitrekenen.
    """
    order = _raw_order(cycle)
    if cycle == 0 or DAYS_PER_CYCLE < 3:
        return order
    prev_tail = {q["id"] for q in _raw_order(cycle - 1)[-QUESTIONS_PER_DAY:]}
    swappable = range(QUESTIONS_PER_DAY, len(order) - QUESTIONS_PER_DAY)
    for i in range(QUESTIONS_PER_DAY):
        if order[i]["id"] not in prev_tail:
            continue
        for j in swappable:
            if order[j]["id"] not in prev_tail:
                order[i], order[j] = order[j], order[i]
                break
    return order


def questions_for(day: str) -> list[dict]:
    """De acht vragen van vandaag, dezelfde voor iedereen."""
    idx = (dt.date.fromisoformat(day) - ANCHOR).days
    cycle, slot = divmod(idx, DAYS_PER_CYCLE)   # negatieve dagen vallen goed uit
    start = slot * QUESTIONS_PER_DAY
    return _cycle_order(cycle)[start:start + QUESTIONS_PER_DAY]


def public_questions(day: str, lang: str = "nl") -> list[dict]:
    """Wat de speler te zien krijgt: id en vraagtekst, nooit het antwoord."""
    key = "en" if lang == "en" else "nl"
    return [{"id": q["id"], "q": q[key]} for q in questions_for(day)]


def _budget(key: str, lenient: bool) -> int:
    """Hoeveel letters een antwoord ernaast mag zitten.

    Eigennamen zijn lastig te spellen, dus er is altijd wat ruimte. Korte
    antwoorden blijven exact: bij drie letters is bijna elk ander woord binnen
    bereik. Met soepele spelling aan mag er eentje meer naast.
    """
    n = len(key)
    base = 0 if n < 4 else 1 if n <= 6 else 2
    return base + (1 if lenient and n >= 4 else 0)


def check(answer: str, question: dict, lenient: bool = False) -> bool:
    given = normalize(answer or "")
    if not given:
        return False
    for good in question["a"]:
        key = normalize(good)
        if given == key:
            return True
        budget = _budget(key, lenient)
        if budget and _edit_distance_capped(given, key, budget) <= budget:
            return True
    return False


def score_answers(day: str, answers: dict, lenient: bool = False) -> tuple[int, list[dict]]:
    """Beoordeel een inzending. Geeft (score, per vraag) terug.

    In de uitslag staat ook het goede antwoord, want anders leer je er niets van.
    Dat mag: op dat moment is je inzending al vast en kun je niet meer wijzigen.
    """
    out: list[dict] = []
    score = 0
    for q in questions_for(day):
        given = str((answers or {}).get(q["id"]) or "").strip()[:40]
        ok = check(given, q, lenient=lenient)
        if ok:
            score += POINTS_PER_ANSWER
        out.append({
            "id": q["id"],
            "your": given,
            "ok": ok,
            "points": POINTS_PER_ANSWER if ok else 0,
            "answer": q["a"][0],
        })
    return score, out
