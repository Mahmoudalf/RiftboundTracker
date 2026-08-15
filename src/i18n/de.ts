import type { Translation } from './types';

/**
 * German.
 *
 * Translated for **voice**, not word-for-word — this app explains itself in
 * sentences rather than labels, and a literal rendering of an English sentence
 * is the fastest way to lose that. Where a container cannot take the natural
 * German, the string is shortened deliberately rather than left to clip; those
 * are marked and listed in `budgets.ts`.
 *
 * Two things worth knowing if you are editing this file:
 *
 * - **`game.result.draw` is `Unentschieden`** — 13 characters against the
 *   English 4. It does not fit `ChoiceRow`'s third of a screen and is the
 *   clearest example of why the budgets file exists.
 * - Riftbound's own German terms are used where the game has them. Card names
 *   and rules text stay English by decision, so this file must not invent a
 *   German name for anything printed on a card.
 */
export const de: Translation = {
  'game.result.win': 'Sieg',
  'game.result.loss': 'Niederlage',
  // Natural German is "Unentschieden". Shortened to fit a third of the screen
  // at one line — the trade the owner accepted for the tight controls.
  'game.result.draw': 'Remis',

  'game.style.casual': 'Locker',
  'game.style.online': 'Online',
  'game.style.tournament': 'Turnier',
  'game.style.testing': 'Test',

  'event.style.nexusNight': 'Nexus-Abend',
  'event.style.skirmish': 'Scharmützel',
  'event.style.locals': 'Lokalturnier',
  'event.style.regionalQualifier': 'Regionale Qualifikation',
  'event.style.regionalFinal': 'Regionalfinale',

  'date.today': 'Heute',
  'date.yesterday': 'Gestern',
  'date.daysAgo': 'vor {days} Tagen',

  'common.notRecorded': 'Nicht erfasst',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'common.back': 'Zurück',

  'game.title': 'Partie',
  'game.notFound.title': 'Partie nicht gefunden',
  'game.notFound.body': 'Sie wurde möglicherweise gelöscht.',
  'game.section.matchup': 'Die Paarung',
  'game.section.result': 'Ergebnis',
  'game.section.oppLegend': 'Legende des Gegners',
  'game.section.oppChampion': 'Dessen Champion',
  'game.section.bestOf': 'Modus',
  'game.section.gameStyle': 'Spielart',
  'game.section.event': 'Event',
  'game.section.note': 'Notiz',
  'game.deckDeleted': 'Deck gelöscht',
  'game.opponentNotRecorded': 'Gegner nicht erfasst',
  'game.championNotRecorded': 'Champion nicht erfasst',
  'game.countsWithoutOpponent': 'Die Partie zählt auch ohne',
  'game.legendNotInLibrary': 'Legende nicht in der Bibliothek',
  'game.legendGone':
    'Diese Legende ist nicht mehr in der Kartenbibliothek, deshalb fehlt ihr Bild. Die Partie weiß weiterhin, gegen wen du gespielt hast.',
  'game.noRounds': 'Keine Runden',
  'game.notePlaceholder': 'Alles, was erwähnenswert ist',
  'game.nothingToChoose': 'Nichts zur Auswahl.',
  'game.versionLocked':
    'Welche Version diese Partie gespielt hat, lässt sich nicht ändern. Ein Ergebnis auf eine Liste zu schieben, die es nicht gespielt hat, ist genau das, was der Versionsverlauf verhindern soll.',
  'game.delete': 'Partie löschen',
  'game.deleteTitle': 'Diese Partie löschen?',
  'game.deleteBody': 'Sie zählt dann nicht mehr zur Bilanz dieses Decks.',

  'game.section.theGame': 'Die Partie',
  'game.section.theMatches': 'Die Spiele',
  'game.matchNumber': 'Spiel {number}',
  'game.noMatches':
    'Für diese Partie wurden keine einzelnen Spiele erfasst. Partien, die vor der Spieldetail-Erfassung eingetragen wurden, haben nur ihr Gesamtergebnis — das zählt weiterhin für jede Bilanz.',
  'game.depth.edit': 'Spieldetails bearbeiten',
  'game.depth.add': 'Spieldetails ergänzen',
  'game.depth.meta': 'Eröffnungshand · Mulligan · Endstand',
  'game.depth.a11y': 'Ausführliche Spieldetails ergänzen',
  'game.note.a11y': 'Notiz zur Partie',

  'log.title': 'Partie erfassen',
  'log.close': 'Schließen',
  'log.mode': 'Erfassungsmodus',
  'log.mode.simplified': 'Einfach',
  'log.mode.advanced': 'Ausführlich',
  'log.mode.help':
    'Der ausführliche Modus erfasst neben dem Ergebnis auch Eröffnungshände, Mulligans und den Punktestand je Spiel.',
  'log.yourDeck': 'Dein Deck',
  'log.chooseDeck': 'Deck wählen',
  'log.legend': 'Legende',
  'log.chooseLegend': 'Legende wählen',
  'log.chosenChampion': 'Champion',
  'log.chooseChampion': 'Champion wählen',
  'log.legendFirst': 'Zuerst eine Legende wählen',
  'log.opponentSkip': 'Auch ohne zählt die Partie',
  'log.noDeckYet': 'Kein Deck',
  'log.opponentNotRecorded': 'Gegner nicht erfasst',
  'log.event.optional': 'Event (optional)',
  'log.event.placeholder': 'Nexus-Abend #4',
  'log.event.a11y': 'Name des Events',
  'log.event.help':
    'Benenne dieses Turnier — jede Runde und Partie unter diesem Namen wird zusammengefasst.',
  'log.continue': 'Weiter',
  'log.continue.a11y': 'Weiter zur Übersicht',
  'log.stillPlaying': 'Läuft noch',
  'log.noGamesYet': 'Noch keine Spiele erfasst',
  'log.derived': 'aus den Spielen abgeleitet',
  'log.notSavedYet': 'Noch nichts gespeichert — der nächste Schritt zeigt dir die Partie zuerst.',
  'log.answerEach': 'Beantworte jedes Spiel oben. {count} Siege entscheiden die Partie.',
  'log.outcome': 'Ausgang der Partie',
  'log.review.title': 'Vor dem Speichern prüfen',
  'log.review.subtitle':
    'Alles Übersprungene wird als „nicht erfasst“ gespeichert, niemals geraten.',
  'log.review.finalize': 'Speichern',
  'log.review.nextRound': 'Nächste Runde erfassen',
  'log.row.deck': 'Deck',
  'log.row.opponent': 'Gegner',
  'log.row.format': 'Format',
  'log.row.event': 'Event',
  'log.row.note': 'Notiz',
  'log.row.detail': 'Details',
  'log.row.matchDetail': 'Details zu Spiel {number}',
  'log.replacedOf': '{sent} von {dealt} ersetzt',
  'log.empty.title': 'Noch keine Decks',
  'log.empty.body':
    'Eine Partie hängt an genau der Deckversion, die sie gespielt hat — es muss also zuerst ein Deck geben.',
  'log.empty.build': 'Deck erstellen',
  'log.toast': 'Erfasst · {deck}{version} steht jetzt bei {wins}–{losses} ({rate} %)',
  'log.undo': 'Rückgängig',

  'log.leave.title': 'Ohne Speichern verlassen?',
  'log.leave.bodyComplete':
    'Diese Partie ist vollständig, aber noch nicht gespeichert — beim Schließen wird nichts erfasst.',
  'log.leave.bodyPartial':
    'Hier ist noch nichts gespeichert. Gegner, Spiele und Notizen existieren nur auf diesem Bildschirm.',
  'log.leave.review': 'Prüfen und speichern',
  'log.leave.discard': 'Verwerfen und schließen',
  'log.leave.stay': 'Weiter erfassen',

  'match.card.theMatch': 'Das Spiel',
  'match.whoWon': 'Wer hat gewonnen?',
  'match.whoWentFirst': 'Wer hatte den Anfang?',
  'match.iDid': 'Ich',
  'match.theyDid': 'Gegner',
  'match.firstNotSet': 'Anfang nicht erfasst',
  'match.notSure': 'Weiß nicht',
  'match.ourField': 'Dein Schlachtfeld — aus diesem Deck',
  'match.ourField.placeholder': 'Aus diesem Deck wählen',
  'match.theirField': 'Sein Schlachtfeld',
  'match.theirField.placeholder': 'Schlachtfelder suchen',
  // Buchstabe zuerst: er bleibt lesbar, wenn das Wort abgeschnitten wird.
  'match.result.win': 'S · Sieg',
  'match.result.loss': 'N · Niederlage',
  'match.result.draw': 'R · Remis',
  'match.pickField': 'Gespieltes Schlachtfeld',
  'match.openingHand': 'Eröffnungshand — aus diesem Deck',
  'match.openingHand.help':
    'Tippe ein Feld an, um die ganze Hand zu wählen — bis zu {size} Karten, zweimal tippen für eine zweite Kopie.',
  'match.mulligan': 'Mulligan',
  'match.mulligan.help':
    'Die ersten beiden — welche Karten der Eröffnungshand zurückgingen, höchstens {max} auf einmal. Die letzten beiden — was du dafür nachgezogen hast.',
  'match.mulligan.over':
    '{count} zurückgelegt — Riftbound erlaubt höchstens {max}. Bleibt wie eingetragen.',
  'match.pick.hand': 'Deine Eröffnungshand',
  'match.pick.drewBack': 'Was du nachgezogen hast',
  'match.pick.whichBack': 'Welche Karten gingen zurück?',
  'match.pick.onlyDealt': 'Nur die Karten, die du gezogen hattest.',
  'match.pick.fromDeck': 'Aus {deck}',
  'match.pick.partners': 'Champions, die zu {legend} passen',
  'match.pick.thisDeck': 'diesem Deck',
  'match.pick.noChampion': 'Keine Champion-Einheit in der Bibliothek passt zu dieser Legende.',
  'match.pick.mulliganFirst':
    'Trage zuerst die Eröffnungshand ein — zurückgehen kann nur, was gezogen wurde.',
  'match.pick.noMainDeck':
    'Diese Deckversion hat keine Hauptdeck-Karten, die die Bibliothek auflösen kann.',
  'match.pick.libraryDownloading': 'Die Kartenbibliothek wurde noch nicht fertig geladen.',
  'deck.title': 'Deck',
  'deck.notFound.title': 'Deck nicht gefunden',
  'deck.notFound.body': 'Es wurde möglicherweise gelöscht.',
  'deck.goBack': 'Zurück',
  'deck.inCollection': 'In deiner Sammlung',
  'deck.preview': 'Deck-Vorschau',
  'deck.goldfish': 'Testhand ziehen',
  'deck.goldfish.a11y': 'Eine Testhand aus dieser Version ziehen',
  'deck.details': 'Deck-Details',
  'deck.details.a11y': 'Deck umbenennen oder Notizen bearbeiten',
  'deck.duplicate': 'Deck kopieren',
  'deck.edit': 'Deck bearbeiten',
  'deck.delete': 'Deck löschen',
  'deck.noGames':
    'Noch keine Partien. Tippe auf das + in der Leiste, um eine zu erfassen — sie hängt sich an die Version, auf die dieses Deck gerade zeigt.',
  'deck.versionsHelp':
    'Jede Bearbeitung nach deiner ersten Partie erzeugt hier eine neue Version, mit genau den geänderten Karten.',
  'deck.noStats':
    'Noch nichts zu messen. Erfasse eine Partie, dann erscheinen hier Bilanz, Intervall und die Aufschlüsselung je Version.',
  'deck.recordAllVersions': 'Bilanz · alle Versionen',
  'deck.byVersion': 'Nach Version',
  'deck.compareHint':
    'Nutze „Vergleichen“ im Reiter „Versionen“, um die Karten hinter dem Unterschied zu sehen.',

  'editor.cancel.a11y': 'Bearbeitung abbrechen',
  'editor.save.a11y': 'Deck speichern',
  'editor.name': 'Deckname',
  'editor.inDeck': 'Im Deck',
  'editor.inDeck.a11y': 'Nur Karten zeigen, die schon im Deck sind',
  'editor.noCardsMatch': 'Keine Karten gefunden.',
  'editor.searchBattlefields': 'Schlachtfelder suchen',
  'editor.searchToAdd': 'Karten zum Hinzufügen suchen',
  'editor.searchSideboard': 'Karten fürs Sideboard suchen',
  'editor.pickLegendFirst': 'Zuerst eine Legende wählen',
  'editor.pickLegendFirst.body':
    'Die Legende bestimmt, welche Domänen das Deck enthalten darf — vorher gibt es nichts anzubieten.',
  'editor.leave.title': 'Ohne Speichern verlassen?',
  'editor.leave.body':
    'Der Entwurf wird nirgends gespeichert. Im Versionsmodell ist eine ungespeicherte Bearbeitung kein verlorener Tastendruck, sondern ein Deck, das es nie gab.',
  'editor.leave.save': 'Speichern und verlassen',
  'editor.leave.discard': 'Verwerfen und fortfahren',
  'editor.leave.stay': 'Hierbleiben',
  'editor.renamedTo': 'Umbenannt in {name}',

  'build.title': 'Deck erstellen',
  'build.save': 'Deck speichern',
  'build.name': 'Deckname',
  'build.prev': 'Vorheriger Schritt',
  'build.next': 'Nächster Schritt',
  'build.search': 'Karten suchen',
  'build.searchIdentity': '{domains}-Karten suchen',
  'build.searchLegends': 'Legenden suchen',
  'build.searchBattlefields': 'Schlachtfelder suchen',
  'deck.goBack.a11y': 'Zurück',
  'deck.copyCode.a11y': 'Deck-Code in die Zwischenablage kopieren',
  'deck.edit.a11y': 'Deck bearbeiten',
  'build.noCards': 'Noch keine Karten',
  'build.libraryDownloading':
    'Die Kartenbibliothek wurde noch nicht fertig geladen. Öffne den Sammlungs-Reiter, lass sie fertig laden und komm dann zurück.',
  'build.noLegendMatch': 'Keine Legende passt zu diesem Namen.',
  'build.noChampion':
    'Keine Champion-Einheit der Bibliothek passt zu dieser Legende. Du kannst ohne fortfahren.',
  'build.noRunes': 'Keine Runen passen zu dieser Identität.',
  'build.runesHelp':
    'Startet mit einer gleichmäßigen Aufteilung deiner beiden Domänen. Ändere sie oder wähle ein anderes Artwork — für die Regeln ist jede Ausgabe einer Rune dieselbe Karte.',
  'build.saveAnyway':
    'Ein unfertiges Deck lässt sich speichern — du kannst später zurückkommen. Nichts hier blockiert das Speichern.',

  "binder.fallbackName": "Ordner",
  "binder.shown": "{count} angezeigt",
  "binder.inLibrary": "{count} in der Bibliothek",
  "binder.syncing": "wird geladen",
  "binder.setAll": "Alle",
  "binder.nSets": "{count} Sets",
  "binder.setValue": "Set · {value}",
  "binder.sortValue": "Sortierung · {value}",
  "binder.hint": "Tippe eine Karte an, um Exemplare zu ändern · Foils schimmern",
  "binder.hintGallery": "Die Bibliothek, mit jeder Karte darin. Lege Exemplare in einen Ordner, um deinen Bestand zu verfolgen.",
  "binder.stillDownloading": "Wird noch geladen",
  "binder.stillDownloading.body": "Die Kartenbibliothek wird noch geladen. Was schon da ist, lässt sich bereits durchsuchen.",
  "binder.nothingMatches": "Kein Treffer",
  "binder.nothingMatches.body": "Keine Karte der Bibliothek passt zu diesen Filtern.",
  "binder.inThisBinder": "{count} in diesem Ordner",
  "binder.finish.sameTotal": "Zählt zur selben Summe",
  "binder.finish.regular": "Normale Ausgabe",
  "binder.finish.notPrinted": "In dieser Ausführung nicht gedruckt",
  "binder.finish.add": "{finish}-Exemplar hinzufügen",
  "binder.finish.remove": "{finish}-Exemplar entfernen",
  "binder.deleteTitle": "{name} löschen?",
  "binder.deleteThis": "diesen Ordner",
  "binder.deleteBody": "Die {count} hier abgelegten Karten zählen nicht mehr zu deinem Bestand. Die Karten selbst bleiben unberührt — nur dieser Ordner geht.",
  "binder.deleteBodyOne": "Die eine hier abgelegte Karte zählt nicht mehr zu deinem Bestand. Die Karte selbst bleibt unberührt — nur dieser Ordner geht.",
  "binder.deleteEmpty": "Es ist nichts darin abgelegt.",
  "binder.rename.a11y": "Name des Ordners",
  "binder.filtersActive": "{count} Filter aktiv",
  'binder.notInLibrary': 'Nicht in der Bibliothek',
  'binder.delete': 'Diesen Ordner löschen',
  'binder.delete.body':
    'Die Karten gehen mit — dein Bestand sinkt um alles, was hier abgelegt war. Aus der Bibliothek wird nichts entfernt.',
  'binder.name': 'Name des Ordners',
  'binder.namePlaceholder': 'Tauschordner',
  'binder.search': 'Name, Text oder Schlüsselwort suchen',
  'binder.searchLibrary': 'Kartenbibliothek durchsuchen',
  'binder.set': 'Set',
  'binder.allSets': 'Alle Sets',
  'binder.sort': 'Sortierung',

  'import.title': 'Deck importieren',
  'import.paste': 'Aus Zwischenablage einfügen',
  'import.read': 'Code einlesen',
  'import.save': 'Dieses Deck speichern',
  'import.codePlaceholder': 'Deck-Code einfügen — zusätzlicher Text drumherum stört nicht',
  'import.code': 'Deck-Code',
  'import.name': 'Deckname',
  'import.namePlaceholder': 'Deck benennen',
  'import.noChampion':
    'Dieser Code nennt keinen Champion — ältere Codes tun das oft nicht. Wähle nach dem Speichern einen im Editor.',
  'import.different': 'Anderen Code verwenden',

  'stats.title': 'Statistik',
  'stats.deck': 'Deck',
  'stats.noDecks': 'Noch keine Decks',
  'stats.noDecks.body':
    'Statistiken entstehen aus Partien, und eine Partie hängt immer an einem Deck. Erstelle zuerst eines.',
  'stats.noGames': 'Noch keine Partien',
  'stats.noGames.all': 'Tippe nach einer Partie auf das + in der Leiste.',
  'stats.noGames.deck':
    'Für dieses Deck ist noch nichts erfasst. Tippe auf das + in der Leiste oder wähle oben ein anderes Deck.',
  'stats.gameCount.one': '{count} Partie',
  'stats.gameCount.other': '{count} Partien',
  'stats.noRecord': 'Keine Partien',
  'stats.noEvents': 'Noch keine Events',
  'stats.noEvents.body':
    'Ein Event fasst die Runden eines Turniers oder Spieleabends zusammen — so siehst du, wie der Tag lief, statt nur wie das Deck insgesamt abschneidet. Erfasse eine Partie, wähle eine organisierte Spielart und gib ihr einen Namen.',
  'stats.event.a11y': '{name}, {rounds} Runden',
  'stats.event.placed': 'Platz {place}',

  'history.window': 'Zeigt die {shown} neuesten von {total}.',
  'history.more': '{count} weitere zeigen',
  'history.all': 'Alle {total} Partien werden gezeigt.',

  'filters.clearAll': 'Alle zurücksetzen',
  'filters.close': 'Filter schließen',
  'filters.hideAltArt': 'Alternative Artworks ausblenden',
  'filters.hideAltArt.help':
    'Alternative Ausgaben doppeln Karten, die schon im Raster stehen.',
  'filters.domain': 'Domäne',
  'filters.type': 'Typ',
  'filters.cost': 'Kosten',
  'filters.rarity': 'Seltenheit',
  'filters.set': 'Set',
  'filters.sortBy': 'Sortieren nach',

  'detail.title': 'Spieldetails',
  'detail.save': 'Details speichern',
  'detail.help':
    'Alles hier ist optional und unabhängig — ein Punktestand ohne Eröffnungshand zählt trotzdem für die Punkteauswertung. Lass lieber leer, woran du dich nicht erinnerst, als zu raten.',
  'detail.notEditable':
    'Welche Spiele gespielt wurden, lässt sich hier nicht ändern — das Partieergebnis wird daraus abgeleitet, ein zusätzliches Spiel würde diesen Bildschirm der Aufzeichnung widersprechen lassen. Korrigiere die Spiele in der Partie selbst.',
  'detail.noMatches': 'Keine Spiele erfasst',
  'detail.noMatches.body':
    'Diese Partie wurde erfasst, bevor es Spieldetails gab, oder ihre Spiele wurden gelöscht. Details hängen an einem Spiel — es gibt also noch nichts, woran sie hängen könnten.',

  'goldfish.title': 'Testhand',
  'goldfish.draw': 'Karte ziehen',
  'goldfish.draw.a11y': 'Eine Karte ziehen',
  'goldfish.empty': 'Das Deck ist leer — alle Karten sind auf der Hand.',
  'goldfish.reshuffle': 'Neu mischen und austeilen',
  'goldfish.reshuffle.a11y': 'Neu mischen und eine neue Hand austeilen',
  'goldfish.nothing': 'Nichts zu ziehen',
  'goldfish.nothing.body':
    'Diese Version hat noch kein Hauptdeck, also gibt es keine Hand zum Eröffnen. Füge Karten hinzu und komm zurück.',

  'event.title': 'Event',
  'event.notFound': 'Event nicht gefunden',
  'event.notFound.body':
    'Es wurde möglicherweise gelöscht. Alle dort gespielten Partien stehen weiterhin in deinem Verlauf.',
  'event.edit': 'Event bearbeiten',
  'event.details': 'Event-Details',
  'event.delete': 'Event löschen',
  'event.style': 'Event-Art',
  'event.placement': 'Welchen Platz hast du belegt?',

  'decks.title': 'Decks',
  'decks.empty': 'Verfolge ein Deck durch jede Änderung',
  'decks.empty.body':
    'Partien bleiben an genau der Liste hängen, die sie gespielt hat — eine Deck-Bearbeitung schreibt also nie den Verlauf um.',
  'decks.import': 'Deck-Code importieren',
  'decks.build': 'Deck erstellen',

  'collection.title': 'Sammlung',
  "collection.copies": "Karten",
  "collection.distinctOf": "{distinct} von {total} Karten",
  "collection.searchCount": "{count} Karten durchsuchen — offline",
  "collection.searchPlain": "Bibliothek durchsuchen",
  "collection.stillDownloading": "Die Bibliothek wird noch geladen, die Summe wächst also noch.",
  "collection.galleryRow": "Jede Karte der Bibliothek · {copies} Karten im Besitz",
  "collection.binderRow": "{distinct} verschiedene · {copies} Karten",
  "collection.binderEmpty": "Leer — hier ist noch nichts abgelegt",
  "collection.showMoreSets": "{count} weitere Sets anzeigen",
  "collection.showOneMoreSet": "1 weiteres Set anzeigen",
  "collection.showFewerSets": "Weniger Sets anzeigen",
  "collection.setProgress.a11y": "{label}, {owned} von {total} Karten",
  'collection.newBinder': 'Neuer Ordner',
  'collection.searchLibrary': 'Kartenbibliothek durchsuchen',

  'pool.clear': 'Filter zurücksetzen',
  'pool.search': 'Karten suchen',
  'pool.sort': 'Sortierung',
  'pool.type': 'Typ',
  'pool.set': 'Set',

  'analytics.casualGames': 'Freie Partien',
  'analytics.overall': "Gesamt",
  'analytics.turnOrder': "ANFANG",
  'analytics.wentFirst': "Hatte den Anfang",
  'analytics.wentSecond': "Kam nach",
  'analytics.gameStyle': "SPIELART",
  'analytics.openingHands': "ERÖFFNUNGSHÄNDE",
  'analytics.howClose': "WIE KNAPP",
  'analytics.cardsThrownBack': "KARTEN, DIE DU ZURÜCKLEGST",
  'analytics.scoreMargin': "PUNKTEABSTAND",
  'analytics.theyScoredInWins': "Gegnerpunkte bei deinen Siegen",
  'analytics.youScoredInLosses': "Deine Punkte bei deinen Niederlagen",
  'analytics.currentStreak': "Aktuelle Serie",
  'analytics.longestRun': "Längste Serie",
  'analytics.gamesCount': "{count} Partien",
  'analytics.winRate': 'Siegquote',
  'analytics.moreBreakdowns': 'Analyse',
  'analytics.opponent': 'Gegner',
  'analytics.empty': 'Noch keine Partien erfasst',
  'analytics.empty.body':
    'Siegquote, Erkenntnisse und Aufschlüsselungen erscheinen, sobald du die erste Partie mit diesem Deck erfasst.',

  'zone.legendChampion': 'Legende & Champion',
  "zone.battlefieldsShort": "Felder",
  "deck.cardCount": "{count} Karten",
  "deck.coverageCount": "{owned}/{required} Karten",
  "deck.preview.list.a11y": "Listenansicht",
  "deck.preview.gallery.a11y": "Galerieansicht",
  "deck.legal": "Legal",
  "deck.notLegal": "! Nicht legal",
  "version.compare": "Vergleichen",
  "version.compareTwo": "Zwei Versionen vergleichen",
  "version.compareTapTwo": "Tippe zwei Versionen zum Vergleichen an",
  "version.compareTapOneMore": "Noch eine · v{version} gewählt",
  "build.mainMeta": "{count}/{target} Karten",
  "build.sideboardMeta": "{count} Karten — optional",
  "build.sideboardOptional": "Optional — überspringen",
  "legality.moreToFix": "Noch {count} zu beheben.",
  "legality.unresolved": "{count} Karten dieses Decks sind nicht in der Bibliothek, die Zahlen oben sind also um genau so viel zu niedrig. Beim Speichern bleiben sie erhalten.",
  "legality.unresolvedOne": "1 Karte dieses Decks ist nicht in der Bibliothek, die Zahlen oben sind also um genau so viel zu niedrig. Beim Speichern bleibt sie erhalten.",
  'zone.legend': 'Legende',
  'zone.champion': 'Champion',
  'zone.main': 'Deck',
  'zone.mainShort': 'Deck',
  'zone.runes': 'Runen',
  'zone.battlefields': 'Schlachtfelder',
  'zone.sideboard': 'Sideboard',

  'tab.decks': 'Decks',
  'tab.collection': 'Sammlung',
  'tab.stats': 'Statistik',
  // "Einstellungen" wäre korrekter, passt aber nicht in eine Tab-Zelle.
  'tab.settings': 'Optionen',
  'tab.logGame.hint': 'Öffnet die Partieerfassung',

  'deckTab.overview': 'Übersicht',
  'deckTab.versions': 'Versionen',
  'deckTab.matches': 'Partien',
  'deckTab.stats': 'Statistik',

  'statsTab.games': 'Partien',
  'statsTab.analytics': 'Auswertung',
  'statsTab.events': 'Events',
  'stats.allDecks': 'Alle Decks',

  'action.share': 'Teilen',
  'action.edit': 'Bearbeiten',
  'action.save': 'Speichern',
  'action.done': 'Fertig',
  'action.clear': 'Leeren',
  'action.next': 'Weiter',
  'action.new': 'Neu',
  'action.import': 'Importieren',
  'action.archive': 'Archivieren',
  'action.overwrite': 'Überschreiben',
  'action.keepAsIs': 'So lassen',
  'action.backToDecks': 'Zurück zu den Decks',
  'action.openCollection': 'Sammlung öffnen',

  'deck.archived': 'Archiviert',
  'deck.current': 'Aktuell',
  'deck.archiveThis': 'Dieses Deck archivieren',
  'deck.restoreArchive': 'Aus dem Archiv holen',
  'deck.archiveTitle': '{name} archivieren?',
  'deck.shareFailed': 'Beim Erzeugen des Deck-Codes ist etwas schiefgegangen.',
  'import.unreadable': 'Dieser Code konnte nicht gelesen werden.',

  'collection.binders': 'Ordner',
  'collection.gallery': 'Galerie',
  'binder.sort.name': 'Name',
  'binder.sort.collector': 'Sammlernummer',
  'binder.sort.energy': 'Energie',
  'binder.sort.rarity': 'Seltenheit',
  'filters.title': 'Filter',
  'filters.sort.relevance': 'Beste Treffer',
  'filters.sort.name': 'Name',
  'filters.sort.cost': 'Kosten',
  'filters.sort.collector': 'Set-Reihenfolge',
  'filters.sort.rarity': 'Seltenheit',
  'pool.sort.energy': 'Energiekosten',
  'pool.sort.name': 'Name',

  'card.energy': 'Energie',
  'card.might': 'Stärke',
  'card.power': 'Kraft',

  'build.pickLegend': 'Legende wählen',
  'build.pickChampion': 'Champion wählen',
  'build.review': 'Prüfen',

  'event.rounds': 'Runden',

  'result.win': 'SIEG',
  'result.loss': 'NIEDERLAGE',
  'result.draw': 'REMIS',

  'sync.checking': 'Suche nach neuen Karten',
  'sync.downloading': 'Karten werden geladen',
  'sync.indexing': 'Suchindex wird aufgebaut',
  'sync.failed': 'Aktualisierung fehlgeschlagen',

  'legality.noLegend': 'Wähle eine Legende — sie legt die Domänen des Decks fest',
  'legality.noChampion': 'Wähle eine Champion-Einheit',

  'hands.decidedByMore': 'Deutlicher entschieden',

  'finding.version.ahead': '{current} schlägt {previous}.',
  'finding.version.behind': '{current} liegt hinter {previous}.',
  'finding.version.evidence':
    '{current} {currentRate} über {currentGames} Partien · {previous} {previousRate} über {previousGames}',

  'finding.matchup.worse': '{opponent}-Decks schlagen dich.',
  'finding.matchup.better': 'Du schlägst {opponent}-Decks.',
  'finding.matchup.evidence':
    '{opponent} · {record} · {rate} gegenüber {restRate} in deinen übrigen Partien',

  'finding.card.headline': 'Du legst {card} öfter zurück, als du sie behältst.',
  'finding.card.evidence': '{mulliganed} von {seen} Eröffnungshänden, in denen sie lag',

  'finding.margin.winClose': 'Die knappen gewinnst du, die klaren verlierst du.',
  'finding.margin.winClear': 'Deine Siege sind klar, deine Niederlagen knapp.',
  'finding.margin.evidence':
    'Knapp {close} · klar {clear} ({recorded} von {total} Spielen mit Punktestand)',

  'finding.order.first': 'Der Anfang hilft diesem Deck messbar.',
  'finding.order.second': 'Als Zweiter zu starten hilft diesem Deck messbar.',
  'finding.order.evidence':
    'Mit Anfang {onPlay} · ohne Anfang {onDraw} ({recorded} von {total} Partien erfasst)',

  'finding.nextStep':
    'Noch nichts Eindeutiges — etwa {more} weitere {games} würden es zeigen.',
  'finding.nextStep.uncapped':
    'Noch nichts Eindeutiges. Die bisherigen Unterschiede sind kleiner, als sich mit dieser Zahl an Partien auflösen lässt.',
  'finding.game': 'Partie',
  'finding.games': 'Partien',

  'ui.dismiss': 'Schließen',
  'ui.close': 'Schließen',
  'ui.goBack': 'Zurück',
  'ui.notes': 'Notizen',
  'ui.logGame': 'Partie erfassen',

  'onboarding.step': 'Schritt {step} von {total}',
  'onboarding.welcome': 'Willkommen bei Riftbound Tracker',
  'onboarding.welcome.body':
    'Verfolge deine Decks, erfasse deine Partien und sieh, was wirklich funktioniert — alles auf deinem Gerät.',
  'onboarding.wip': 'In Entwicklung',
  'onboarding.wip.body':
    'Ein unfertiges Projekt, offen entwickelt — zwischen Updates kann sich einiges ändern oder kaputtgehen. Deine Decks und Partien liegen nur auf diesem Gerät.',
  'onboarding.start': 'Los geht’s',

  'onboarding.setup': 'Richte dein Profil ein',
  'onboarding.setup.body': 'Alles davon kannst du später in den Optionen ändern.',
  'onboarding.name': 'Anzeigename',
  'onboarding.name.placeholder': 'z. B. Master Yi Main',
  'onboarding.name.help': 'Wird nur auf diesem Gerät gespeichert. Es wird nichts übertragen.',
  'onboarding.name.next': 'Weiter',
  'onboarding.language': 'Sprache',
  'onboarding.language.default': 'Standard',
  'onboarding.firstDeck': 'Erstes Deck',
  'onboarding.import': 'Deck importieren',
  'onboarding.import.body': 'Füge einen vorhandenen Deck-Code ein',
  'onboarding.new': 'Neues Deck erstellen',
  'onboarding.new.body': 'Leer beginnen und Karte für Karte aufbauen',
  'onboarding.skip': 'Ich schaue mich erst um',

  'profile.name': 'Dein Name',
  'profile.namePlaceholder': 'Nicht gesetzt',
  'profile.name.a11y': 'Dein Anzeigename',
  'profile.nameHelp':
    'Wird vorerst nur auf diesem Gerät verwendet. Sobald die Cloud-Synchronisierung kommt, ist es der Name deines Kontos.',

  'profile.report': 'Rückmeldung',
  'profile.report.body':
    'Fehler gefunden oder einen Wunsch? Es geht nur mit, was du hier schreibst — Angaben zu deinem Gerät werden nicht erfasst.',
  'profile.report.kind': 'Worum geht es?',
  'profile.report.kind.bug': 'Fehler',
  'profile.report.kind.feature': 'Wunsch',
  'profile.report.placeholder': 'Was passiert ist oder was du dir wünschst',
  'profile.report.a11y': 'Deine Rückmeldung',
  'profile.report.copy': 'Kopieren',
  'profile.report.copied': 'Kopiert — füge sie dort ein, wo du sie hinschickst',
  'profile.report.noBackend':
    'Aus der App heraus lässt sich das noch nirgendwohin senden. Kopieren ist vorerst alles.',

  'profile.library': 'Kartenbibliothek',
  'profile.library.stored':
    '{count} Karten auf diesem Gerät gespeichert. Stöbern, Suchen und Deckbau funktionieren ohne Verbindung.',
  'profile.library.empty': 'Noch keine Karten gespeichert.',
  'profile.library.refresh': 'Kartenbibliothek aktualisieren',
  'profile.library.refreshing': 'Wird aktualisiert…',
  'profile.about': 'Über',
  'profile.about.unofficial':
    'Riftbound Tracker ist ein inoffizielles Fan-Projekt. Es steht in keiner Verbindung zu Riot Games und wird weder unterstützt noch gesponsert.',
  'profile.about.attribution':
    'Die Kartendaten stammen von Riftcodex. Kartenbilder, Namen und Spieltexte sind Eigentum von Riot Games und werden gemäß Riots „Legal Jibber Jabber“-Richtlinie für nicht-kommerzielle Fan-Inhalte verwendet.',

  'card.notFound': 'Karte nicht gefunden',
  'card.notFound.body':
    'Sie wurde möglicherweise aus der Kartenbibliothek entfernt. Ein Aktualisieren der Bibliothek in den Einstellungen behebt das meistens.',

  'binder.new': 'Neuer Ordner',
  'binder.new.subtitle':
    'Ein Ort für Karten, die dir gehören — ein Tauschordner, eine Deckbox, ein Regal.',

  'legality.legal': 'Legales Deck',
  'legality.main': 'Haupt',
  'legality.runes': 'Runen',
  'legality.fields': 'Felder',

  'version.keepEditing': 'Weiter bearbeiten',
  'version.nameThis': 'Diese Version benennen',
  'version.label': 'Versionsbezeichnung',
  'version.fork': 'Von hier abzweigen',
  'version.labelNotes': 'Bezeichnung & Notizen',
  'version.delete': 'Version löschen',
  'version.noChanges': 'Keine Kartenänderungen',
  'version.didItHelp': 'Hat es geholfen?',
  'version.correlational':
    'Korrelation, keine Ursache. Das Meta verschiebt sich und Spieler werden besser — eine Version, die besser aussieht, wurde vielleicht einfach später gespielt.',
  'version.whatChanged': 'Was sich geändert hat',
  'version.identical': 'Diese beiden Listen sind identisch.',

  'winRate.noMatches': 'Keine Partien',
  'deckCard.legendArt': 'Artwork der Legende',
  'deckPreview.yourDeck': 'Dein Deck',

  'match.noBattlefields':
    'Die aktuelle Version dieses Decks hat keine Schlachtfelder. Füge sie im Deck-Editor hinzu, dann erscheinen sie hier.',
  'match.slot.card': 'Karte',
  'match.slot.mull': 'Zurück',
  'match.slot.drew': 'Neu',
  'match.slot.dealt.a11y':
    'Karte {index} der Eröffnungshand: {card}. Tippen, um die Hand zu wählen.',
  'match.slot.dealtEmpty.a11y':
    'Karte {index} der Eröffnungshand, nicht gewählt. Tippen, um die Hand zu wählen.',
  'match.slot.mull.a11y': 'Zurückgelegt: {card}. Tippen, um die Auswahl zu ändern.',
  'match.slot.mullEmpty.a11y':
    'Mulligan-Feld {index}, leer. Tippen, um zu wählen, welche Karten zurückgingen.',
  'match.slot.drew.a11y': 'Ersatzkarte {index}: {card}. Tippen, um das Nachgezogene zu wählen.',
  'match.slot.drewLocked.a11y':
    'Feld für Ersatzkarten, erst verfügbar, wenn eine Karte zurückgelegt wurde.',
  'match.score': 'Punkte',
  'match.score.notSet': 'Offen',
  'match.readBack.won': 'Gewonnen',
  'match.readBack.lost': 'Verloren',
  'match.readBack.drew': 'Remis',
  'match.readBack.firstNotRecorded': 'Anfang nicht erfasst',
  'match.readBack.youFirst': 'du hattest den Anfang',
  'match.readBack.theyFirst': 'der Gegner hatte den Anfang',
  'match.readBack.ourFieldMissing': 'deins nicht erfasst',
  'match.readBack.theirFieldMissing': 'seins nicht erfasst',

  // Kurz gehalten: das Abzeichen ist schmal und steht neben dem Spieltitel.
  'match.outcome.won': 'SIEG',
  'match.outcome.lost': 'NIEDERLAGE',
  'match.outcome.drew': 'REMIS',
  'match.youWentFirst': 'Du hattest den Anfang',
  'match.theyWentFirst': 'Der Gegner hatte den Anfang',
  'match.score.you': 'Du',
  'match.score.them': 'Gegner',
  'match.hand.dealt': '{count} gezogen',
  'match.hand.sentBack': '{count} zurückgelegt',
  'match.hand.keptAll': 'alle behalten',
  'match.hand.drewBack': 'Nachgezogen',
  'match.hand.cardGone': 'Nicht mehr in der Bibliothek',

  // Wie im Tab — "Einstellungen" passt dort nicht, und beide sollen gleich heißen.
  'profile.title': 'Optionen',
  'profile.localOnly': 'Nur lokal',
  'profile.nothingLeaves': 'Nichts verlässt dieses Gerät',
  'profile.language': 'Sprache',
  'profile.languageHelp':
    'Kartennamen und Regeltexte bleiben englisch — sie müssen zu den Karten in deiner Hand passen.',
};
