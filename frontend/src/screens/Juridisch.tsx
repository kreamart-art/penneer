// Privacy en voorwaarden.
//
// De tekst staat hier en niet in i18n.tsx: het zijn twee lappen lopende tekst
// van tien alinea's, en die tussen de knoplabels zetten maakt dat bestand
// onleesbaar zonder dat er iets tegenover staat. Wel dezelfde twee talen.
//
// De inhoud is geschreven naar wat de app ECHT doet. Elke regel hieronder komt
// overeen met iets in de code: de blob-avatars in db.py, de magic link via
// Resend, de woorden die naar de scheidsrechter gaan, PayPal, de push-abonnees.
// Verandert dat, dan verandert deze tekst mee.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Screen } from "../components/Layout";
import { PilKeuze } from "./Hub";
import { NeonKader } from "../components/ProfileHero";
import { useT } from "../i18n/i18n";
import { colors, font } from "../theme/tokens";

type Blok = { kop: string; tekst: string[] };

const PRIVACY_NL: Blok[] = [
  {
    kop: "Kort gezegd",
    tekst: [
      "Pen Neer is een spel van Artnomad. Je kunt het spelen zonder account: dan slaan we niets over je op behalve wat er tijdens dat potje op de server staat, en dat verdwijnt als de kamer sluit.",
      "Maak je wel een profiel aan, dan bewaren we precies genoeg om je spel te laten werken. Niet meer. We verkopen niets door.",
    ],
  },
  {
    kop: "Wat we bewaren",
    tekst: [
      "Je naam, je kleur en je profielfoto of gekozen avatar. De foto staat in onze eigen database, niet bij een andere partij.",
      "Je e-mailadres, alleen als je het zelf invult om in te loggen. Stel je een wachtwoord in, dan bewaren we daar een versleutelde afdruk van en nooit het wachtwoord zelf.",
      "Je spelgeschiedenis: potjes, punten, winsten, prestaties, level, munten, aankopen en welke items je bezit.",
      "Je vrienden, blokkeringen, clublidmaatschap en de berichten en spraakberichten die je stuurt.",
      "Je meldingsabonnement, als je meldingen aanzet.",
    ],
  },
  {
    kop: "Wat we niet doen",
    tekst: [
      "Geen profielopbouw voor derden en geen doorverkoop van gegevens. Advertenties in de app kunnen voorkomen; ook dan verkopen we je gegevens niet door.",
      "We lezen je berichten niet mee. Ze staan versleuteld over de lijn (https) maar leesbaar in de database, dus stuur er niets in wat je niemand zou toevertrouwen.",
    ],
  },
  {
    kop: "Wie er nog meer bij komt",
    tekst: [
      "De scheidsrechter. Twijfelt iemand aan een woord, dan gaat dat ENE woord met zijn categorie naar een taalmodel om beoordeeld te worden. Er gaat geen naam en geen account mee.",
      "Resend, voor het versturen van de inloglink naar je e-mailadres.",
      "PayPal, als je iets koopt. Wij zien nooit je betaalgegevens; PayPal geeft ons alleen door dat de betaling is gelukt.",
      "De meldingsdienst van je browser (Apple, Google of Mozilla), om een melding op je telefoon te krijgen als de app dicht is.",
    ],
  },
  {
    kop: "Hoe lang",
    tekst: [
      "Zolang je profiel bestaat. Verwijder je je profiel in de instellingen, dan gaat alles wat aan je account hangt mee weg: foto, statistieken, berichten, vriendschappen, aankopen. Dat is niet terug te draaien.",
      "Meldingen in je inbox houden we hooguit de laatste veertig aan; oudere vallen vanzelf weg.",
    ],
  },
  {
    kop: "Kinderen",
    tekst: [
      "Het spel is voor iedereen, maar chat en berichten zijn dat niet altijd. Ben je jonger dan zestien, vraag dan eerst thuis of het goed is dat je een profiel aanmaakt.",
    ],
  },
  {
    kop: "Je rechten",
    tekst: [
      "Je mag opvragen wat we van je hebben, het laten aanpassen of het laten verwijderen. Mail daarvoor naar kream.art@gmail.com en zet je spelersnaam erbij.",
    ],
  },
];

const VOORWAARDEN_NL: Blok[] = [
  {
    kop: "Meedoen",
    tekst: [
      "Door Pen Neer te spelen ga je akkoord met deze voorwaarden. Ze zijn kort en bedoeld om het voor iedereen leuk te houden.",
    ],
  },
  {
    kop: "Je profiel",
    tekst: [
      "Eén profiel per persoon. Je bent zelf verantwoordelijk voor wat er onder jouw naam gebeurt, dus deel je inloglink niet.",
      "Kies een naam en een foto waar niemand van schrikt. Namen of afbeeldingen die beledigend zijn, iemand anders nadoen of niet door de beugel kunnen, halen we weg.",
    ],
  },
  {
    kop: "Eerlijk spelen",
    tekst: [
      "Geen tweede account om jezelf punten toe te spelen, geen geautomatiseerde hulpjes, en niet proberen de server of andermans account binnen te komen.",
      "Merken we dat een score niet klopt, dan mogen we hem terugdraaien. Bij herhaling kan een account op slot.",
    ],
  },
  {
    kop: "Berichten en chat",
    tekst: [
      "Wat je stuurt is van jou en blijft jouw verantwoordelijkheid. Bedreigen, pesten, haat zaaien of ongevraagd reclame sturen mag niet.",
      "Last van iemand? Blokkeer diegene; dat werkt meteen en van beide kanten.",
    ],
  },
  {
    kop: "Munten en aankopen",
    tekst: [
      "Munten zijn speelgeld binnen Pen Neer. Ze hebben geen waarde buiten het spel, zijn niet inwisselbaar voor geld en kunnen niet worden overgedragen.",
      "Koop je munten met echt geld, dan zijn ze meteen op je account beschikbaar. Omdat je ze direct krijgt, vervalt daarmee het herroepingsrecht van veertien dagen. Ging er iets mis met een betaling, mail dan en we lossen het op.",
      "Wat je met munten koopt (knoppen, skins, stickers, avatars) blijft van je zolang je account bestaat.",
    ],
  },
  {
    kop: "Het spel verandert",
    tekst: [
      "Pen Neer wordt doorontwikkeld. Onderdelen kunnen erbij komen, veranderen of verdwijnen, en prijzen kunnen wijzigen. Bestaat een item dat je hebt gekocht niet meer, dan zoeken we een gelijkwaardige vervanging.",
    ],
  },
  {
    kop: "Geen garanties",
    tekst: [
      "Het spel wordt aangeboden zoals het is. We doen ons best dat alles werkt, maar we kunnen niet beloven dat het altijd bereikbaar is of foutloos draait.",
    ],
  },
  {
    kop: "Stoppen",
    tekst: [
      "Je kunt op elk moment je profiel verwijderen in de instellingen. Wij mogen een account sluiten als iemand deze voorwaarden herhaaldelijk aan zijn laars lapt.",
    ],
  },
  {
    kop: "Vragen",
    tekst: [
      "Mail naar kream.art@gmail.com. Op deze voorwaarden is Nederlands recht van toepassing.",
    ],
  },
];

const PRIVACY_EN: Blok[] = [
  {
    kop: "In short",
    tekst: [
      "Pen Neer is a game by Artnomad. You can play without an account: then nothing about you is stored beyond what lives on the server during that game, and that goes when the room closes.",
      "If you do create a profile, we keep exactly enough to make your game work. No more. We do not sell anything on.",
    ],
  },
  {
    kop: "What we keep",
    tekst: [
      "Your name, your colour and your profile photo or chosen avatar. The photo sits in our own database, not with another party.",
      "Your e-mail address, only if you enter it yourself to log in. If you set a password we keep an encrypted print of it and never the password itself.",
      "Your play history: games, points, wins, achievements, level, coins, purchases and which items you own.",
      "Your friends, blocks, club membership and the messages and voice notes you send.",
      "Your notification subscription, if you turn notifications on.",
    ],
  },
  {
    kop: "What we do not do",
    tekst: [
      "No profiling for third parties and no reselling of data. The app may show ads; even then your data is never sold on.",
      "We do not read along with your messages. They travel encrypted (https) but sit readable in the database, so do not send anything you would not trust anyone with.",
    ],
  },
  {
    kop: "Who else is involved",
    tekst: [
      "The referee. If someone doubts a word, that ONE word and its category go to a language model to be judged. No name and no account go with it.",
      "Resend, to send the login link to your e-mail address.",
      "PayPal, if you buy something. We never see your payment details; PayPal only tells us the payment succeeded.",
      "Your browser's notification service (Apple, Google or Mozilla), to reach your phone when the app is closed.",
    ],
  },
  {
    kop: "How long",
    tekst: [
      "As long as your profile exists. Delete your profile in the settings and everything attached to your account goes with it: photo, statistics, messages, friendships, purchases. That cannot be undone.",
      "We keep at most the last forty notifications in your inbox; older ones fall away by themselves.",
    ],
  },
  {
    kop: "Children",
    tekst: [
      "The game is for everyone, but chat and messages are not always. If you are under sixteen, ask at home first whether creating a profile is alright.",
    ],
  },
  {
    kop: "Your rights",
    tekst: [
      "You may ask what we hold about you, have it corrected or have it deleted. Mail kream.art@gmail.com and include your player name.",
    ],
  },
];

const VOORWAARDEN_EN: Blok[] = [
  { kop: "Taking part", tekst: ["By playing Pen Neer you agree to these terms. They are short and meant to keep it fun for everyone."] },
  {
    kop: "Your profile",
    tekst: [
      "One profile per person. You are responsible for what happens under your name, so do not share your login link.",
      "Pick a name and a photo nobody will be shocked by. Names or images that are offensive, impersonate someone else or are otherwise out of order will be removed.",
    ],
  },
  {
    kop: "Fair play",
    tekst: [
      "No second account to feed yourself points, no automated helpers, and no attempts to get into the server or someone else's account.",
      "If we spot a score that is not right we may reverse it. Repeat offences can get an account locked.",
    ],
  },
  {
    kop: "Messages and chat",
    tekst: [
      "What you send is yours and stays your responsibility. Threatening, bullying, spreading hate or sending unsolicited advertising is not allowed.",
      "Trouble with someone? Block them; it works immediately and both ways.",
    ],
  },
  {
    kop: "Coins and purchases",
    tekst: [
      "Coins are play money inside Pen Neer. They hold no value outside the game, cannot be exchanged for money and cannot be transferred.",
      "If you buy coins with real money they land on your account right away. Because you receive them immediately, the fourteen-day right of withdrawal lapses. If something went wrong with a payment, mail us and we will sort it out.",
      "What you buy with coins (buttons, skins, stickers, avatars) stays yours for as long as your account exists.",
    ],
  },
  {
    kop: "The game changes",
    tekst: [
      "Pen Neer keeps being developed. Parts may be added, changed or removed, and prices may change. If an item you bought no longer exists, we will find an equivalent replacement.",
    ],
  },
  {
    kop: "No guarantees",
    tekst: ["The game is offered as it is. We do our best to keep everything working, but we cannot promise it is always reachable or bug free."],
  },
  {
    kop: "Stopping",
    tekst: [
      "You can delete your profile at any time in the settings. We may close an account if someone repeatedly ignores these terms.",
    ],
  },
  { kop: "Questions", tekst: ["Mail kream.art@gmail.com. Dutch law applies to these terms."] },
];

function Lap({ blokken }: { blokken: Blok[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {blokken.map((b) => (
        <NeonKader
          key={b.kop}
          hoek={11}
          dik={0.34}
          sterkte={0.34}
          vulling="geen"
          eindkap="kort"
          binnen={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}
        >
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 14.5, color: colors.gold }}>{b.kop}</span>
          {b.tekst.map((r, i) => (
            <p key={i} style={{ margin: 0, fontFamily: font.ui, fontSize: 13, lineHeight: 1.6, color: colors.sub }}>
              {r}
            </p>
          ))}
        </NeonKader>
      ))}
    </div>
  );
}

export function Juridisch({ onBack, start = "privacy" }: { onBack: () => void; start?: "privacy" | "terms" }) {
  const { t, lang } = useT();
  const [tab, setTab] = useState<"privacy" | "terms">(start);
  const nl = lang === "nl";
  const blokken = tab === "privacy" ? (nl ? PRIVACY_NL : PRIVACY_EN) : nl ? VOORWAARDEN_NL : VOORWAARDEN_EN;

  return (
    <Screen
      top={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 14px 18px", paddingTop: "calc(14px + env(safe-area-inset-top))" }}>
          <button onClick={onBack} aria-label={t("back")} style={{ background: "transparent", border: "none", cursor: "pointer", color: colors.faint, display: "flex", padding: 2 }}>
            <ArrowLeft size={20} />
          </button>
          <span style={{ flex: 1, fontFamily: font.display, fontWeight: 700, fontSize: 17, color: colors.ink }}>
            {t(tab === "privacy" ? "privacyTitle" : "termsTitle")}
          </span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20 }}>
        <PilKeuze
          actief={tab}
          onKies={setTab}
          opties={[
            { key: "privacy" as const, label: t("privacyTitle") },
            { key: "terms" as const, label: t("termsTitle") },
          ]}
        />
        <Lap blokken={blokken} />
        <p style={{ margin: 0, textAlign: "center", fontFamily: font.ui, fontSize: 11.5, color: colors.faint }}>
          Artnomad · penneer.artnomad.nl
        </p>
      </div>
    </Screen>
  );
}
