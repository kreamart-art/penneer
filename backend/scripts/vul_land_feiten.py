#!/usr/bin/env python3
"""Vul `taal` en `weetje` in data/cards/land.csv.

De twee kolommen stonden er wel maar waren overal leeg, dus elke landkaart had
precies twee feiten: hoofdstad en werelddeel. Daardoor kon de kennisquiz maar
twee soorten vragen stellen en had de achterkant van een kaart niets te vertellen.

Alleen de LEGE cellen worden gevuld. Wat er al staat blijft staan, zodat een
handmatige correctie niet wordt overschreven door dit script nog eens te draaien.

Draaien vanuit backend/:
    ./.venv/bin/python scripts/vul_land_feiten.py
    ./.venv/bin/python scripts/seed_cards.py land
"""
from __future__ import annotations

import csv
from pathlib import Path

CSV = Path(__file__).resolve().parents[1] / "data" / "cards" / "land.csv"

# taal: de voertaal zoals je hem op school leert. Bij meer dan een taal de twee
# grootste, want een rij van vijf past niet op een kaart.
# weetje: een zin, iets wat je onthoudt en wat niet al in de andere velden staat.
FEITEN: dict[str, tuple[str, str]] = {
    "Afghanistan": ("Pasjtoe / Dari", "Het land ligt volledig ingesloten door bergen en heeft geen kust."),
    "Albanië": ("Albanees", "De adelaar op de vlag komt uit het wapen van nationale held Skanderbeg."),
    "Algerije": ("Arabisch", "Het grootste land van Afrika; ruim vier vijfde is Sahara."),
    "Andorra": ("Catalaans", "Het wordt geleid door twee staatshoofden: een Franse president en een Spaanse bisschop."),
    "Angola": ("Portugees", "Het land werd pas in 1975 onafhankelijk van Portugal."),
    "Antigua en Barbuda": ("Engels", "Volgens de eilanden zelf heeft Antigua een strand voor elke dag van het jaar."),
    "Argentinië": ("Spaans", "De tango is er ontstaan, in de havenwijken van Buenos Aires."),
    "Armenië": ("Armeens", "Het was in het jaar 301 het eerste land dat het christendom als staatsgodsdienst aannam."),
    "Australië": ("Engels", "Het is het enige land dat een heel werelddeel beslaat."),
    "Azerbeidzjan": ("Azerbeidzjaans", "Het heet het land van het vuur, naar het aardgas dat er van nature brandt."),
    "Bahama's": ("Engels", "Het bestaat uit ruim zevenhonderd eilanden, waarvan er maar dertig bewoond zijn."),
    "Bahrein": ("Arabisch", "Een klein eilandland dat met een dam van 25 kilometer aan Saoedi-Arabië vastzit."),
    "Bangladesh": ("Bengaals", "Het ligt in de grootste rivierdelta ter wereld, van de Ganges en de Brahmaputra."),
    "Barbados": ("Engels", "Het eiland is sinds 2021 een republiek en heeft geen koning meer."),
    "Belarus": ("Belarussisch / Russisch", "Ruim een derde van het land is bos."),
    "België": ("Nederlands / Frans", "Er zijn drie officiële talen: Nederlands, Frans en Duits."),
    "Belize": ("Engels", "Voor de kust ligt het op een na grootste koraalrif ter wereld."),
    "Benin": ("Frans", "Hier ontstond de vodounreligie, die wij kennen als voodoo."),
    "Bhutan": ("Dzongkha", "Het meet zijn welvaart in bruto nationaal geluk in plaats van in geld."),
    "Bolivia": ("Spaans", "Het heeft twee hoofdsteden: Sucre op papier en La Paz in de praktijk."),
    "Bosnië en Herzegovina": ("Bosnisch", "De brug van Mostar werd na de oorlog steen voor steen herbouwd."),
    "Botswana": ("Engels / Setswana", "De Kalahari beslaat ruim twee derde van het land."),
    "Brazilië": ("Portugees", "Het enige land van Zuid-Amerika waar Portugees de voertaal is."),
    "Brunei": ("Maleis", "Een klein sultanaat op Borneo dat rijk werd van olie en gas."),
    "Bulgarije": ("Bulgaars", "Het cyrillische alfabet is hier in de tiende eeuw ontstaan."),
    "Burkina Faso": ("Frans", "De naam betekent land van de oprechte mensen."),
    "Burundi": ("Kirundi / Frans", "Het ligt aan het Tanganyikameer, een van de diepste meren ter wereld."),
    "Cambodja": ("Khmer", "Angkor Wat is het grootste religieuze bouwwerk ter wereld."),
    "Canada": ("Engels / Frans", "Het heeft de langste kustlijn van alle landen."),
    "Centraal-Afrikaanse Republiek": ("Frans / Sango", "Het ligt precies in het midden van het Afrikaanse continent."),
    "Chili": ("Spaans", "Ruim vierduizend kilometer lang en gemiddeld nog geen tweehonderd breed."),
    "China": ("Mandarijn", "De Chinese Muur is over de eeuwen in stukken gebouwd en is duizenden kilometers lang."),
    "Colombia": ("Spaans", "Het enige land van Zuid-Amerika met kust aan zowel de Grote als de Atlantische Oceaan."),
    "Comoren": ("Comorees / Frans", "Een eilandgroep tussen Afrika en Madagaskar, bekend om zijn vanille en ylang-ylang."),
    "Congo": ("Frans", "De Congorivier is de diepste rivier ter wereld."),
    "Costa Rica": ("Spaans", "Het schafte in 1948 zijn leger af en heeft er sindsdien geen meer."),
    "Cuba": ("Spaans", "Het grootste eiland van het Caribisch gebied."),
    "Cyprus": ("Grieks / Turks", "Het eiland is sinds 1974 in tweeën gedeeld door een bufferzone."),
    "Denemarken": ("Deens", "Het bestaat uit een schiereiland en ruim vierhonderd eilanden."),
    "Djibouti": ("Frans / Arabisch", "Het Assalmeer ligt 155 meter onder zeeniveau, het laagste punt van Afrika."),
    "Dominica": ("Engels", "Bekend als het natuureiland, met een meer dat kookt van vulkanische hitte."),
    "Dominicaanse Republiek": ("Spaans", "Het deelt het eiland Hispaniola met Haïti."),
    "Duitsland": ("Duits", "Het grenst aan negen landen, meer dan welk ander Europees land ook."),
    "Ecuador": ("Spaans", "De naam betekent evenaar; die loopt dwars door het land."),
    "Egypte": ("Arabisch", "De piramides van Gizeh staan er al ruim vierduizend jaar."),
    "El Salvador": ("Spaans", "Het kleinste land van Midden-Amerika, met tientallen vulkanen."),
    "Equatoriaal-Guinea": ("Spaans", "Het enige Afrikaanse land waar Spaans de voertaal is."),
    "Eritrea": ("Tigrinya / Arabisch", "De hoofdstad Asmara staat vol art-decogebouwen uit de Italiaanse tijd."),
    "Estland": ("Estisch", "Bijna de helft van het land is bos, en internet geldt er als basisvoorziening."),
    "Eswatini": ("Swati / Engels", "Het heette tot 2018 Swaziland en is een van de laatste koninkrijken van Afrika."),
    "Ethiopië": ("Amhaars", "Het heeft een eigen kalender die ruim zeven jaar achterloopt op de onze."),
    "Fiji": ("Engels / Fijisch", "Een eilandstaat van ruim driehonderd eilanden in de Stille Oceaan."),
    "Filipijnen": ("Filipijns / Engels", "Het bestaat uit meer dan zevenduizend eilanden."),
    "Finland": ("Fins / Zweeds", "Het land van de duizend meren heeft er in werkelijkheid bijna tweehonderdduizend."),
    "Frankrijk": ("Frans", "Het meest bezochte land ter wereld."),
    "Gabon": ("Frans", "Ruim tachtig procent van het land is regenwoud."),
    "Gambia": ("Engels", "Het kleinste land van het Afrikaanse vasteland, een strook langs een rivier."),
    "Georgië": ("Georgisch", "Hier werd al achtduizend jaar geleden wijn gemaakt, de oudste die we kennen."),
    "Ghana": ("Engels", "Het eerste land in Afrika onder de Sahara dat onafhankelijk werd, in 1957."),
    "Grenada": ("Engels", "Het kruidnooteiland: nootmuskaat staat zelfs op de vlag."),
    "Griekenland": ("Grieks", "De democratie en de Olympische Spelen zijn hier ontstaan."),
    "Guatemala": ("Spaans", "Het hart van de oude Mayabeschaving."),
    "Guinee": ("Frans", "Uit de hooglanden ontspringen de Niger, de Senegal en de Gambia."),
    "Guinee-Bissau": ("Portugees", "Voor de kust liggen de Bijagos-eilanden, een beschermd natuurgebied."),
    "Guyana": ("Engels", "Het enige Zuid-Amerikaanse land waar Engels de voertaal is."),
    "Haïti": ("Frans / Creools", "In 1804 de eerste zwarte republiek ter wereld."),
    "Honduras": ("Spaans", "De Mayastad Copán staat vol bewerkte stenen zuilen."),
    "Hongarije": ("Hongaars", "Het Hongaars lijkt op geen enkele buurtaal en hoort bij het Fins en het Estisch."),
    "Ierland": ("Iers / Engels", "Het heet het groene eiland omdat het er zo vaak regent."),
    "IJsland": ("IJslands", "Bijna alle stroom en warmte komt uit water en aardwarmte."),
    "India": ("Hindi / Engels", "Er worden meer dan twintig officiële talen gesproken."),
    "Indonesië": ("Indonesisch", "Het bestaat uit ruim zeventienduizend eilanden."),
    "Irak": ("Arabisch / Koerdisch", "Tussen de Eufraat en de Tigris ontstond het eerste schrift."),
    "Iran": ("Perzisch", "Perzepolis was ruim tweeduizend jaar geleden de hoofdstad van een wereldrijk."),
    "Israël": ("Hebreeuws / Arabisch", "De Dode Zee is met ruim vierhonderd meter onder zeeniveau het laagste punt op land."),
    "Italië": ("Italiaans", "Er staan twee onafhankelijke staten binnen zijn grenzen: San Marino en Vaticaanstad."),
    "Ivoorkust": ("Frans", "Het is de grootste cacaoproducent ter wereld."),
    "Jamaica": ("Engels", "De reggae is hier ontstaan."),
    "Japan": ("Japans", "Het bestaat uit bijna zevenduizend eilanden."),
    "Jemen": ("Arabisch", "De oude stad van Sanaa heeft huizen van leem die eeuwen oud zijn."),
    "Jordanië": ("Arabisch", "Petra is uit rotswanden gehouwen, ruim tweeduizend jaar geleden."),
    "Kaapverdië": ("Portugees / Creools", "Een eilandgroep in de Atlantische Oceaan, bekend om de morna van Cesária Évora."),
    "Kameroen": ("Frans / Engels", "Het heet Afrika in het klein: woestijn, oerwoud, bergen en kust in één land."),
    "Kazachstan": ("Kazachs / Russisch", "Het grootste land ter wereld zonder toegang tot zee."),
    "Kenia": ("Swahili / Engels", "De Grote Slenk loopt dwars door het land."),
    "Kirgizië": ("Kirgizisch / Russisch", "Ruim negentig procent van het land ligt in de bergen."),
    "Kiribati": ("Engels / Gilbertees", "Het ligt over alle vier de aardhelften tegelijk."),
    "Koeweit": ("Arabisch", "Een klein woestijnland aan de Perzische Golf dat drijft op olie."),
    "Kroatië": ("Kroatisch", "Voor de kust liggen meer dan duizend eilanden."),
    "Laos": ("Lao", "Het enige land van Zuidoost-Azië zonder kust."),
    "Lesotho": ("Sesotho / Engels", "Het ligt volledig ingesloten door Zuid-Afrika en helemaal boven de 1400 meter."),
    "Letland": ("Lets", "De oude binnenstad van Riga staat vol jugendstil."),
    "Libanon": ("Arabisch", "De ceder op de vlag groeit al duizenden jaren in de bergen."),
    "Liberia": ("Engels", "Gesticht in 1847 door bevrijde slaven uit Amerika."),
    "Libië": ("Arabisch", "Ruim negentig procent van het land is woestijn."),
    "Liechtenstein": ("Duits", "Een van de kleinste landen ter wereld, ingeklemd tussen Zwitserland en Oostenrijk."),
    "Litouwen": ("Litouws", "De Heuvel der Kruisen draagt er honderdduizenden."),
    "Luxemburg": ("Luxemburgs / Frans", "Het enige groothertogdom ter wereld."),
    "Madagaskar": ("Malagasi / Frans", "Negen van de tien diersoorten op het eiland komen nergens anders voor."),
    "Malawi": ("Chichewa / Engels", "Het Malawimeer beslaat bijna een vijfde van het land."),
    "Maldiven": ("Dhivehi", "Het vlakste land ter wereld: gemiddeld anderhalve meter boven zee."),
    "Maleisië": ("Maleis", "Het bestaat uit twee delen, gescheiden door de Zuid-Chinese Zee."),
    "Mali": ("Frans / Bambara", "Timboektoe was eeuwenlang een centrum van boeken en geleerdheid."),
    "Malta": ("Maltees / Engels", "Het Maltees is de enige officiële taal van de EU met Arabische wortels."),
    "Marokko": ("Arabisch / Berbers", "De medina van Fez is een van de grootste autovrije stadskernen ter wereld."),
    "Mauritanië": ("Arabisch", "Het Oog van de Sahara is een kring van veertig kilometer, zichtbaar vanuit de ruimte."),
    "Mauritius": ("Engels / Frans", "De dodo leefde hier en stierf hier uit."),
    "Mexico": ("Spaans", "Er groeien meer soorten cactus dan waar ook ter wereld."),
    "Micronesia": ("Engels", "Ruim zeshonderd eilanden verspreid over een enorm stuk oceaan."),
    "Moldavië": ("Roemeens", "De wijnkelders van Milestii Mici zijn tweehonderd kilometer lang."),
    "Monaco": ("Frans", "Na Vaticaanstad het kleinste land ter wereld."),
    "Mongolië": ("Mongools", "Het dunstbevolkte land ter wereld."),
    "Montenegro": ("Montenegrijns", "De baai van Kotor snijdt als een fjord het land in."),
    "Mozambique": ("Portugees", "Het enige land met een geweer op de vlag."),
    "Myanmar": ("Birmaans", "In Bagan staan meer dan tweeduizend tempels bij elkaar."),
    "Namibië": ("Engels", "De Namibwoestijn is de oudste woestijn ter wereld."),
    "Nauru": ("Nauruaans / Engels", "Het kleinste eilandland ter wereld, kleiner dan Texel."),
    "Nederland": ("Nederlands", "Ruim een kwart van het land ligt onder zeeniveau."),
    "Nepal": ("Nepalees", "Acht van de tien hoogste bergen ter wereld staan hier."),
    "Nicaragua": ("Spaans", "Het Nicaraguameer is het grootste zoetwatermeer van Midden-Amerika."),
    "Nieuw-Zeeland": ("Engels / Maori", "Het was in 1893 het eerste land waar vrouwen mochten stemmen."),
    "Niger": ("Frans", "Vernoemd naar de rivier de Niger, die dwars door het zuiden loopt."),
    "Nigeria": ("Engels", "Het land met de meeste inwoners van heel Afrika."),
    "Noord-Korea": ("Koreaans", "Het gebruikt een eigen jaartelling die begint in 1912."),
    "Noord-Macedonië": ("Macedonisch / Albanees", "Het Ohridmeer is een van de oudste meren ter wereld."),
    "Noorwegen": ("Noors", "De kust zit vol fjorden en is daardoor duizenden kilometers lang."),
    "Oeganda": ("Engels / Swahili", "De bron van de Witte Nijl ligt bij het Victoriameer."),
    "Oekraïne": ("Oekraïens", "De zwarte aarde hier is een van de vruchtbaarste gronden ter wereld."),
    "Oezbekistan": ("Oezbeeks", "Samarkand was een knooppunt op de zijderoute."),
    "Oman": ("Arabisch", "Het oudste onafhankelijke land van de Arabische wereld."),
    "Oost-Timor": ("Portugees / Tetun", "In 2002 onafhankelijk geworden, een van de jongste landen ter wereld."),
    "Oostenrijk": ("Duits", "Bijna twee derde van het land ligt in de Alpen."),
    "Pakistan": ("Urdu / Engels", "De K2 is met 8611 meter de op een na hoogste berg ter wereld."),
    "Palau": ("Palauaans / Engels", "In het Jellyfish Lake zwemmen kwallen die niet meer steken."),
    "Panama": ("Spaans", "Het kanaal verbindt de Atlantische met de Grote Oceaan."),
    "Papoea-Nieuw-Guinea": ("Engels / Tok Pisin", "Er worden ruim achthonderd talen gesproken, meer dan in enig ander land."),
    "Paraguay": ("Spaans / Guaraní", "Een van de weinige landen waar een inheemse taal officieel is."),
    "Peru": ("Spaans / Quechua", "Machu Picchu ligt op ruim tweeduizend vierhonderd meter hoogte."),
    "Polen": ("Pools", "In het Bialowiezawoud staat het laatste oerbos van Europa."),
    "Portugal": ("Portugees", "Ruim de helft van alle kurk ter wereld komt hiervandaan."),
    "Qatar": ("Arabisch", "Een schiereiland dat in vijftig jaar van parelvisserij naar wolkenkrabbers ging."),
    "Roemenië": ("Roemeens", "De Donaudelta is het grootste rietmoeras van Europa."),
    "Rusland": ("Russisch", "Het grootste land ter wereld, met elf tijdzones."),
    "Rwanda": ("Kinyarwanda / Frans", "Het land van de duizend heuvels."),
    "Saint Kitts en Nevis": ("Engels", "Het kleinste land van Amerika, in oppervlakte en inwoners."),
    "Saint Lucia": ("Engels", "De twee Pitons rijzen recht uit zee omhoog."),
    "Saint Vincent en de Grenadines": ("Engels", "Een hoofdeiland met een keten van kleine eilandjes eronder."),
    "Salomonseilanden": ("Engels", "Bijna duizend eilanden ten oosten van Papoea-Nieuw-Guinea."),
    "Samoa": ("Samoaans / Engels", "Het sloeg in 2011 een hele dag over om van tijdzone te wisselen."),
    "San Marino": ("Italiaans", "De oudste nog bestaande republiek ter wereld."),
    "Saoedi-Arabië": ("Arabisch", "Mekka en Medina liggen hier, de twee heiligste steden van de islam."),
    "Senegal": ("Frans / Wolof", "Het meest westelijke punt van het Afrikaanse vasteland ligt hier."),
    "Servië": ("Servisch", "De Donau stroomt er ruim vijfhonderd kilometer doorheen."),
    "Seychellen": ("Creools / Engels", "De coco de mer heeft de grootste zaden van het plantenrijk."),
    "Sierra Leone": ("Engels", "De naam betekent leeuwenberg, naar de bergen achter de kust."),
    "Singapore": ("Engels / Maleis", "Een stadstaat die uit een eiland en zestig eilandjes bestaat."),
    "Slovenië": ("Sloveens", "Ruim zestig procent van het land is bos."),
    "Slowakije": ("Slowaaks", "Het heeft meer dan honderd kastelen en burchten."),
    "Soedan": ("Arabisch", "Er staan meer piramides dan in Egypte, alleen kleiner."),
    "Somalië": ("Somali / Arabisch", "Het heeft de langste kustlijn van het Afrikaanse vasteland."),
    "Spanje": ("Spaans", "Naast Spaans zijn ook Catalaans, Galicisch en Baskisch regionale talen."),
    "Sri Lanka": ("Singalees / Tamil", "Ceylonthee komt hiervandaan; het eiland heette vroeger Ceylon."),
    "Suriname": ("Nederlands", "Het enige land van Zuid-Amerika waar Nederlands de voertaal is."),
    "Syrië": ("Arabisch", "Damascus is een van de oudste steden ter wereld die nog altijd bewoond zijn."),
    "Tadzjikistan": ("Tadzjieks", "Meer dan negentig procent van het land is bergland."),
    "Taiwan": ("Mandarijn", "Een groot deel van alle computerchips ter wereld wordt hier gemaakt."),
    "Tanzania": ("Swahili / Engels", "De Kilimanjaro is met 5895 meter de hoogste berg van Afrika."),
    "Thailand": ("Thai", "Het enige land van Zuidoost-Azië dat nooit is gekoloniseerd."),
    "Togo": ("Frans", "Een smalle strook van de kust tot ver het binnenland in."),
    "Tonga": ("Tongaans / Engels", "Het enige eilandenrijk in de Stille Oceaan met een eigen koning."),
    "Trinidad en Tobago": ("Engels", "De steeldrum is hier uitgevonden, van olievaten."),
    "Tsjaad": ("Frans / Arabisch", "Het Tsjaadmeer is in vijftig jaar tot een fractie geslonken."),
    "Tsjechië": ("Tsjechisch", "Er wordt per persoon meer bier gedronken dan in welk ander land ook."),
    "Tunesië": ("Arabisch", "Het noordelijkste punt van Afrika ligt hier."),
    "Turkije": ("Turks", "Istanbul ligt in twee werelddelen tegelijk."),
    "Turkmenistan": ("Turkmeens", "In de Karakoemwoestijn brandt al tientallen jaren een gaskrater."),
    "Tuvalu": ("Tuvaluaans / Engels", "Het verdient geld aan zijn internetdomein .tv."),
    "Uruguay": ("Spaans", "Het won in 1930 het allereerste wereldkampioenschap voetbal."),
    "Vanuatu": ("Bislama / Engels", "Op Tanna staat een vulkaan waar je tot aan de rand kunt lopen."),
    "Vaticaanstad": ("Italiaans / Latijn", "Het kleinste land ter wereld, kleiner dan een half vierkante kilometer."),
    "Venezuela": ("Spaans", "De Angelwaterval is met bijna duizend meter de hoogste ter wereld."),
    "Verenigd Koninkrijk": ("Engels", "Het bestaat uit vier landsdelen: Engeland, Schotland, Wales en Noord-Ierland."),
    "Verenigde Arabische Emiraten": ("Arabisch", "De Burj Khalifa in Dubai is het hoogste gebouw ter wereld."),
    "Verenigde Staten": ("Engels", "Het heeft geen officiële taal die in de grondwet staat."),
    "Vietnam": ("Vietnamees", "De baai van Ha Long telt bijna tweeduizend kalkstenen eilandjes."),
    "Zambia": ("Engels", "De Victoriawatervallen liggen op de grens met Zimbabwe."),
    "Zimbabwe": ("Engels / Shona", "Great Zimbabwe is een stenen stad uit de middeleeuwen, zonder mortel gebouwd."),
    "Zuid-Afrika": ("Engels / Afrikaans", "Het heeft elf officiële talen en drie hoofdsteden."),
    "Zuid-Korea": ("Koreaans", "Het Koreaanse alfabet hangul is in de vijftiende eeuw met opzet ontworpen."),
    "Zuid-Soedan": ("Engels", "In 2011 onafhankelijk geworden, het jongste land ter wereld."),
    "Zweden": ("Zweeds", "Bijna een tiende van het land bestaat uit meren."),
    "Zwitserland": ("Duits / Frans", "Er zijn vier officiële talen: Duits, Frans, Italiaans en Reto-Romaans."),
}


def main() -> int:
    with CSV.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        velden = list(reader.fieldnames or [])
        rijen = list(reader)

    gevuld = 0
    ontbreekt: list[str] = []
    for r in rijen:
        feit = FEITEN.get(r["word"])
        if not feit:
            ontbreekt.append(r["word"])
            continue
        taal, weetje = feit
        if not (r.get("taal") or "").strip():
            r["taal"] = taal
            gevuld += 1
        if not (r.get("weetje") or "").strip():
            r["weetje"] = weetje

    with CSV.open("w", encoding="utf-8", newline="") as fh:
        schrijver = csv.DictWriter(fh, fieldnames=velden)
        schrijver.writeheader()
        schrijver.writerows(rijen)

    print(f"{gevuld} landen gevuld van {len(rijen)}")
    if ontbreekt:
        print("nog zonder feiten:", ", ".join(ontbreekt))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
