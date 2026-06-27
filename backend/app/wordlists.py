"""Pen Neer — curated word lists per checkable category (NL + EN mixed).

These power the auto-check: an answer in a checked category that is NOT found here
gets an orange "?" (still counts, but flagged so the group can reject it via a
challenge). The lists are deliberately generous, not exhaustive — the challenge
system is the human safety net for the long tail, so no AI is needed. Open
categories (Jongen, Meisje, Ding) are NOT listed here and stay letter-only.

game.py normalizes every entry at import (lowercase, strip diacritics/spaces),
so entries here can be written naturally in either language.
"""

LAND = [
    # UN members + common Dutch/English names and variants
    "Afghanistan", "Albanië", "Albania", "Algerije", "Algeria", "Andorra", "Angola",
    "Antigua en Barbuda", "Argentinië", "Argentina", "Armenië", "Armenia", "Australië", "Australia",
    "Oostenrijk", "Austria", "Azerbeidzjan", "Azerbaijan", "Bahama's", "Bahamas", "Bahrein", "Bahrain",
    "Bangladesh", "Barbados", "Belarus", "Wit-Rusland", "België", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnië en Herzegovina", "Bosnia", "Botswana", "Brazilië", "Brazil", "Brunei", "Bulgarije",
    "Bulgaria", "Burkina Faso", "Burundi", "Cambodja", "Cambodia", "Kameroen", "Cameroon", "Canada",
    "Kaapverdië", "Cape Verde", "Centraal-Afrikaanse Republiek", "Tsjaad", "Chad", "Chili", "Chile", "China",
    "Colombia", "Comoren", "Comoros", "Congo", "Costa Rica", "Kroatië", "Croatia", "Cuba", "Cyprus",
    "Tsjechië", "Czech Republic", "Czechia", "Denemarken", "Denmark", "Djibouti", "Dominica",
    "Dominicaanse Republiek", "Dominican Republic", "Ecuador", "Egypte", "Egypt", "El Salvador",
    "Equatoriaal-Guinea", "Eritrea", "Estland", "Estonia", "Eswatini", "Ethiopië", "Ethiopia", "Fiji",
    "Finland", "Frankrijk", "France", "Gabon", "Gambia", "Georgië", "Georgia", "Duitsland", "Germany",
    "Ghana", "Griekenland", "Greece", "Grenada", "Guatemala", "Guinee", "Guinea", "Guinee-Bissau",
    "Guyana", "Haïti", "Haiti", "Honduras", "Hongarije", "Hungary", "IJsland", "Iceland", "India",
    "Indonesië", "Indonesia", "Iran", "Irak", "Iraq", "Ierland", "Ireland", "Israël", "Israel", "Italië",
    "Italy", "Ivoorkust", "Jamaica", "Japan", "Jordanië", "Jordan", "Kazachstan", "Kazakhstan", "Kenia",
    "Kenya", "Kiribati", "Koeweit", "Kuwait", "Kirgizië", "Kyrgyzstan", "Laos", "Letland", "Latvia",
    "Libanon", "Lebanon", "Lesotho", "Liberia", "Libië", "Libya", "Liechtenstein", "Litouwen", "Lithuania",
    "Luxemburg", "Luxembourg", "Madagaskar", "Madagascar", "Malawi", "Maleisië", "Maleisië", "Malaysia",
    "Maldiven", "Maldives", "Mali", "Malta", "Marokko", "Morocco", "Mauritanië", "Mauritania", "Mauritius",
    "Mexico", "Micronesia", "Moldavië", "Moldova", "Monaco", "Mongolië", "Mongolia", "Montenegro",
    "Mozambique", "Myanmar", "Namibië", "Namibia", "Nauru", "Nepal", "Nederland", "Netherlands",
    "Nieuw-Zeeland", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Noord-Korea", "North Korea",
    "Noord-Macedonië", "Noorwegen", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papoea-Nieuw-Guinea",
    "Paraguay", "Peru", "Filipijnen", "Philippines", "Polen", "Poland", "Portugal", "Qatar", "Roemenië",
    "Romania", "Rusland", "Russia", "Rwanda", "Saint Kitts en Nevis", "Saint Lucia",
    "Saint Vincent en de Grenadines", "Samoa", "San Marino", "Saoedi-Arabië", "Saudi Arabia", "Senegal",
    "Servië", "Serbia", "Seychellen", "Seychelles", "Sierra Leone", "Singapore", "Slowakije", "Slovakia",
    "Slovenië", "Slovenia", "Salomonseilanden", "Somalië", "Somalia", "Spanje", "Spain", "Sri Lanka",
    "Soedan", "Sudan", "Suriname", "Zweden", "Sweden", "Zwitserland", "Switzerland", "Syrië", "Syria",
    "Taiwan", "Tadzjikistan", "Tajikistan", "Tanzania", "Thailand", "Oost-Timor", "Togo", "Tonga",
    "Trinidad en Tobago", "Tunesië", "Tunisia", "Turkije", "Turkey", "Turkmenistan", "Tuvalu", "Oeganda",
    "Uganda", "Oekraïne", "Ukraine", "Verenigde Arabische Emiraten", "Verenigd Koninkrijk",
    "United Kingdom", "Engeland", "England", "Verenigde Staten", "United States", "Amerika", "America",
    "Uruguay", "Oezbekistan", "Uzbekistan", "Vanuatu", "Vaticaanstad", "Venezuela", "Vietnam", "Jemen",
    "Yemen", "Zambia", "Zimbabwe", "Zuid-Afrika", "South Africa", "Zuid-Korea", "South Korea", "Zuid-Soedan",
]

VRUCHT = [
    "appel", "apple", "abrikoos", "apricot", "ananas", "pineapple", "avocado", "banaan", "banana",
    "bes", "bessen", "berry", "braam", "bramen", "blackberry", "bosbes", "blueberry", "citroen", "lemon",
    "cranberry", "dadel", "date", "druif", "druiven", "grape", "framboos", "frambozen", "raspberry",
    "granaatappel", "pomegranate", "grapefruit", "guave", "guava", "kers", "kersen", "cherry", "kiwi",
    "kokosnoot", "kokos", "coconut", "kumquat", "limoen", "lime", "lychee", "mandarijn", "mandarin",
    "tangerine", "mango", "meloen", "melon", "watermeloen", "watermelon", "moerbei", "mulberry", "nectarine",
    "olijf", "olive", "papaja", "papaya", "passievrucht", "passion fruit", "peer", "peren", "pear", "perzik",
    "peach", "pruim", "pruimen", "plum", "rabarber", "rhubarb", "sinaasappel", "orange", "stekelbes",
    "gooseberry", "vijg", "vijgen", "fig", "vlierbes", "elderberry", "aardbei", "aardbeien", "strawberry",
    "tomaat", "tomato", "dragonfruit", "drakenfruit", "kweepeer", "kaki", "persimmon", "physalis", "pompoen",
    "clementine", "bloedsinaasappel", "blackcurrant", "zwarte bes", "rode bes", "kruisbes", "jackfruit",
    "durian", "rambutan", "starfruit", "carambola", "tamarinde", "tamarind", "kastanje", "chestnut",
]

DIER = [
    "aap", "monkey", "alligator", "antilope", "antelope", "beer", "bear", "bever", "beaver", "bij", "bee",
    "bizon", "bison", "buffel", "buffalo", "cavia", "guinea pig", "cheetah", "chimpansee", "chimpanzee",
    "dachshund", "das", "badger", "dolfijn", "dolphin", "duif", "pigeon", "dove", "eekhoorn", "squirrel",
    "eend", "duck", "egel", "hedgehog", "eland", "moose", "elk", "ezel", "donkey", "fazant", "pheasant",
    "flamingo", "fret", "ferret", "gans", "goose", "gazelle", "gepard", "gibbon", "giraf", "giraffe",
    "gnoe", "wildebeest", "goudvis", "goldfish", "haai", "shark", "haas", "hare", "hamster", "havik", "hawk",
    "hagedis", "lizard", "hert", "deer", "hond", "dog", "hyena", "iguana", "leguaan", "impala", "jaguar",
    "kaketoe", "cockatoo", "kameel", "camel", "kangoeroe", "kangaroo", "kat", "cat", "kever", "beetle",
    "kikker", "frog", "kip", "chicken", "koala", "koe", "cow", "konijn", "rabbit", "krab", "crab", "kreeft",
    "lobster", "krokodil", "crocodile", "kwal", "jellyfish", "lama", "llama", "leeuw", "lion", "leeuwerik",
    "lieveheersbeestje", "ladybug", "luipaard", "leopard", "lynx", "makreel", "mackerel", "marmot",
    "meeuw", "seagull", "mier", "ant", "mol", "mole", "mug", "mosquito", "muis", "mouse", "mus", "sparrow",
    "nachtegaal", "nightingale", "neushoorn", "rhino", "rhinoceros", "nijlpaard", "hippo", "hippopotamus",
    "octopus", "inktvis", "olifant", "elephant", "otter", "paard", "horse", "panda", "panter", "panther",
    "papegaai", "parrot", "pauw", "peacock", "pelikaan", "pelican", "pinguïn", "penguin", "poema", "puma",
    "kakkerlak", "cockroach", "rat", "ree", "reiger", "heron", "rendier", "reindeer", "rups", "caterpillar",
    "salamander", "schaap", "sheep", "schildpad", "turtle", "tortoise", "schorpioen", "scorpion", "slak",
    "snail", "slang", "snake", "spin", "spider", "sprinkhaan", "grasshopper", "struisvogel", "ostrich",
    "tijger", "tiger", "tor", "tortelduif", "uil", "owl", "valk", "falcon", "varken", "pig", "vleermuis",
    "bat", "vlieg", "fly", "vlinder", "butterfly", "vis", "fish", "vos", "fox", "walvis", "whale", "wants",
    "wasbeer", "raccoon", "weekdier", "wesp", "wasp", "wolf", "worm", "wezel", "weasel", "yak", "zalm",
    "salmon", "zebra", "zeehond", "seal", "zeeleeuw", "sea lion", "zeester", "starfish", "zwaan", "swan",
    "zwijn", "boar", "kabeljauw", "cod", "karper", "carp", "koala", "koolmees", "merel", "blackbird",
    "specht", "woodpecker", "spreeuw", "starling", "buizerd", "buzzard", "adelaar", "eagle", "arend",
]

STAD = [
    # NL
    "Amsterdam", "Rotterdam", "Den Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda",
    "Nijmegen", "Apeldoorn", "Arnhem", "Haarlem", "Enschede", "Amersfoort", "Zaanstad", "Haarlemmermeer",
    "Den Bosch", "Zwolle", "Leiden", "Leeuwarden", "Maastricht", "Dordrecht", "Ede", "Alkmaar", "Delft",
    "Venlo", "Deventer", "Helmond", "Hengelo", "Hilversum", "Assen", "Middelburg", "Roermond", "Sittard",
    # world capitals / big cities
    "Londen", "London", "Parijs", "Paris", "Berlijn", "Berlin", "Madrid", "Rome", "Lissabon", "Lisbon",
    "Wenen", "Vienna", "Brussel", "Brussels", "Antwerpen", "Antwerp", "Gent", "Brugge", "Luik", "Athene",
    "Athens", "Boedapest", "Budapest", "Praag", "Prague", "Warschau", "Warsaw", "Moskou", "Moscow",
    "Kiev", "Kyiv", "Stockholm", "Oslo", "Kopenhagen", "Copenhagen", "Helsinki", "Dublin", "Bern", "Zürich",
    "Genève", "Geneva", "Milaan", "Milan", "Napels", "Naples", "Venetië", "Venice", "Barcelona", "Sevilla",
    "Lyon", "Marseille", "München", "Munich", "Hamburg", "Frankfurt", "Keulen", "Cologne", "Istanboel",
    "Istanbul", "Ankara", "Caïro", "Cairo", "Casablanca", "Nairobi", "Lagos", "Kaapstad", "Cape Town",
    "Johannesburg", "Tokio", "Tokyo", "Osaka", "Peking", "Beijing", "Shanghai", "Hongkong", "Hong Kong",
    "Seoul", "Bangkok", "Jakarta", "Manilla", "Manila", "Mumbai", "Delhi", "Bangalore", "Karachi",
    "Dubai", "Abu Dhabi", "Doha", "Riyad", "Riyadh", "Teheran", "Tehran", "Bagdad", "Baghdad", "Jeruzalem",
    "Jerusalem", "Tel Aviv", "New York", "Los Angeles", "Chicago", "Houston", "Miami", "Boston", "Toronto",
    "Vancouver", "Montreal", "Mexico-Stad", "Mexico City", "Bogota", "Lima", "Santiago", "Buenos Aires",
    "Rio de Janeiro", "Sao Paulo", "Brasilia", "Sydney", "Melbourne", "Auckland", "Washington", "Singapore",
]

BEROEP = [
    "accountant", "acteur", "actor", "actrice", "advocaat", "lawyer", "ambtenaar", "anesthesist",
    "apotheker", "pharmacist", "architect", "arts", "doctor", "dokter", "astronaut", "automonteur",
    "bakker", "baker", "bankier", "banker", "barman", "bartender", "beeldhouwer", "sculptor", "bibliothecaris",
    "librarian", "bioloog", "biologist", "boekhouder", "boer", "farmer", "boswachter", "bouwvakker",
    "brandweerman", "firefighter", "buschauffeur", "cardioloog", "chef", "chef-kok", "chirurg", "surgeon",
    "componist", "composer", "conducteur", "danser", "dancer", "decaan", "dichter", "poet", "diëtist",
    "directeur", "director", "dirigent", "conductor", "elektricien", "electrician", "fotograaf",
    "photographer", "fysiotherapeut", "gids", "guide", "goochelaar", "magician", "hovenier", "gardener",
    "ingenieur", "engineer", "journalist", "kapper", "barber", "hairdresser", "kapitein", "captain",
    "kassière", "kelner", "waiter", "kleermaker", "tailor", "kok", "cook", "kunstenaar", "artist",
    "lasser", "welder", "leraar", "teacher", "lerares", "loodgieter", "plumber", "makelaar", "manager",
    "marinier", "matroos", "sailor", "metselaar", "bricklayer", "monteur", "mechanic", "muzikant",
    "musician", "notaris", "notary", "officier", "ondernemer", "ober", "onderwijzer", "operator", "optometrist",
    "piloot", "pilot", "politieagent", "police officer", "politicus", "politician", "postbode", "postman",
    "predikant", "professor", "psychiater", "psychiatrist", "psycholoog", "psychologist", "rechter", "judge",
    "redacteur", "editor", "regisseur", "reporter", "schilder", "painter", "schoenmaker", "schoonmaker",
    "cleaner", "schrijver", "writer", "secretaresse", "secretary", "slager", "butcher", "soldaat", "soldier",
    "stewardess", "stratenmaker", "stukadoor", "tandarts", "dentist", "taxichauffeur", "taxi driver",
    "timmerman", "carpenter", "tolk", "interpreter", "tuinman", "verkoper", "salesman", "verpleegkundige",
    "verpleegster", "nurse", "vertaler", "translator", "verzorgende", "violist", "violinist", "visser",
    "fisherman", "vroedvrouw", "midwife", "wetenschapper", "scientist", "wiskundige", "mathematician",
    "zanger", "singer", "zangeres", "zakenman", "businessman", "zeeman",
]

RAW: dict[str, list[str]] = {
    "Land": LAND,
    "Vrucht": VRUCHT,
    "Dier": DIER,
    "Stad": STAD,
    "Beroep": BEROEP,
}
