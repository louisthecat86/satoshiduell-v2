# Tournament System - Vereinfachter Modus

## Überblick

Der Turniermodus ist bewusst einfach gehalten:

- Ein Turnier besteht aus einem einzigen Quiz mit $N$ Fragen.
- Spieler sehen dieselben Fragen, aber in ihrer Sprache (de/en/es), wenn vorhanden.
- Gewinner ist die Person mit den meisten richtigen Antworten; bei Gleichstand zählt die schnellere Zeit.
- Auszahlung findet außerhalb der App statt (per Gewinner-Token).

## Zugriff & Tokens

Es gibt zwei Zugriffsarten:

- **Oeffentlich:** Jeder kann beitreten.
- **Token:** Der Creator erzeugt fuer jede Person einen einmaligen Token.

Token-Flow:

1. Creator erzeugt einen Token und gibt ihn persoenlich weiter.
2. Teilnehmer gibt den Token beim Beitritt ein.
3. Token wird als verbraucht markiert und kann nicht erneut genutzt werden.

## Begrenzung (Deadline oder Spielerlimit)

Es muss mindestens eine Begrenzung gesetzt sein:

- **Deadline:** Turnier endet automatisch, sobald `play_until` erreicht ist.
- **Teilnehmerlimit:** Turnier endet, sobald das Limit voll ist und alle gespielt haben.

## Gewinner-Token

- Beim Abschluss wird ein Gewinner ermittelt.
- Der Gewinner erhaelt einen Token zur Auszahlung.
- Der Token ist dauerhaft im Turnier-Detail sichtbar (nur fuer Gewinner und Creator).

## Historie

- Abgeschlossene Turniere erscheinen in der Historie.
- Detailansicht zeigt Teilnehmer, Scores, Zeiten und Gewinner.

## Datenfelder (vereinfacht)

- `question_count` (int)
- `questions` (array mit Question-IDs)
- `play_until` (timestamp)
- `max_players` (int, optional)
- `access_level` (`public` oder `token`)
- `participants` (array)
- `status` (`registration`, `active`, `finished`)
- `winner`, `winner_token`

## Status-Logik

- **registration:** Beitritt moeglich.
- **active:** Turnier laeuft (z.B. voll oder gestartet).
- **finished:** Turnier beendet.

## Automatische Finalisierung

- Ein Cron-Job finalisiert Turniere bei Deadline automatisch.
- Edge Function: `finalize-tournaments`
