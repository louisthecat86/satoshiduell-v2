# Tournament System - Vereinfachter Modus

## Überblick

Der Turniermodus ist bewusst einfach gehalten:

- Ein Turnier besteht aus einem einzigen Quiz mit $N$ Fragen.
- Es gibt ein Zeitfenster (Deadline), bis wann gespielt werden kann.
- Gewinner ist die Person mit den meisten richtigen Antworten; bei Gleichstand zählt die schnellere Zeit.
- Auszahlung findet außerhalb der App statt.

## Zugriff & Tokens

Es gibt zwei Zugriffsarten:

- **Offentlich:** Jeder kann beitreten.
- **Token:** Der Creator erzeugt für jede Person einen einmaligen Token.

Token-Flow:

1. Creator erzeugt einen Token und gibt ihn persönlich weiter.
2. Teilnehmer gibt den Token beim Beitritt ein.
3. Token wird als verbraucht markiert und kann nicht erneut genutzt werden.

## Datenfelder (vereinfacht)

- `question_count` (int)
- `play_until` (timestamp)
- `access_level` (`public` oder `token`)
- `participants` (array)
- `status` (`registration`, `active`, `finished`)

## Status-Logik

- **registration:** Beitritt möglich.
- **active:** Turnier läuft (z.B. voll oder Start durch Creator).
- **finished:** Turnier beendet.

## Hinweis zur Auszahlung

Die Auszahlung ist nicht Teil der App-Logik und wird extern abgewickelt.
   
6. **Claim-System:**
   - Winner Claim UI
   - Creator Entry Fees Claim
   - LNURL Withdraw Display

---

Welches Payment-Modell sollen wir verwenden? **Option A empfohlen!**
