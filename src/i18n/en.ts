/**
 * The English catalogue — the source every other locale is checked against.
 *
 * **Keys are namespaced by where the string appears**, not by what it says:
 * `game.result.loss`, not `loss`. Two screens wanting the same English word is
 * normal and two screens wanting the same *German* word is not — "Draw" is
 * `Unentschieden` as a match result and `Ziehen` as an action, and a catalogue
 * keyed on the English would have merged them into one wrong string.
 *
 * Placeholders are `{named}`, never positional. Word order moves between
 * languages, so `{deck} is now {record}` has to be reorderable by the
 * translator without counting arguments.
 *
 * Card data is **not** in here. Riftcodex serves English card names and rules
 * text, and translating them locally would invent names that do not appear on
 * the card in the player's hand — a decklist that disagrees with the table is
 * worse than an English one. Only app copy is translated.
 */
export const en = {
  // ── Match result, and the three-cell control that sets it ──────────────────
  // The tightest containers in the app: `ChoiceRow` gives each cell an equal
  // third of the screen and clips to one line. See `budgets.ts`.
  'game.result.win': 'Win',
  'game.result.loss': 'Loss',
  'game.result.draw': 'Draw',

  // ── How the game was played ───────────────────────────────────────────────
  'game.style.casual': 'Casual',
  'game.style.online': 'Online',
  'game.style.tournament': 'Tournament',
  'game.style.testing': 'Testing',

  // ── Event tiers ───────────────────────────────────────────────────────────
  'event.style.nexusNight': 'Nexus Night',
  'event.style.skirmish': 'Skirmish',
  'event.style.locals': 'Locals',
  'event.style.regionalQualifier': 'Regional Qualifier',
  'event.style.regionalFinal': 'Regional Final',

  // ── Dates, as a player would say them ─────────────────────────────────────
  'date.today': 'Today',
  'date.yesterday': 'Yesterday',
  'date.daysAgo': '{days} days ago',

  // ── Shared vocabulary ─────────────────────────────────────────────────────
  'common.notRecorded': 'Not recorded',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.back': 'Back',

  // ── A logged game, read back and corrected ────────────────────────────────
  'game.title': 'Game',
  'game.notFound.title': 'Game not found',
  'game.notFound.body': 'It may have been deleted.',
  'game.section.matchup': 'The matchup',
  'game.section.result': 'Result',
  'game.section.oppLegend': 'Opponent’s Legend',
  'game.section.oppChampion': 'Their Chosen Champion',
  'game.section.bestOf': 'Best of',
  'game.section.gameStyle': 'Game style',
  'game.section.event': 'Event',
  'game.section.note': 'Note',
  'game.deckDeleted': 'Deck deleted',
  'game.opponentNotRecorded': 'Opponent not recorded',
  'game.championNotRecorded': 'Champion not recorded',
  'game.countsWithoutOpponent': 'The game still counts without one',
  'game.legendNotInLibrary': 'Legend not in the library',
  'game.legendGone':
    'This Legend is no longer in the card library, so its art cannot be shown. The game still knows who you played.',
  'game.noRounds': 'No rounds',
  'game.notePlaceholder': 'Anything worth remembering',
  'game.nothingToChoose': 'Nothing to choose from.',
  'game.versionLocked':
    'Which version played this game cannot be changed. Moving a result onto a list that did not play it is what the version history exists to prevent.',
  'game.delete': 'Delete game',
  'game.deleteTitle': 'Delete this game?',
  'game.deleteBody': 'It will stop counting towards this deck’s record.',

  // The singular and plural of "the matches" section, and its empty state.
  'game.section.theGame': 'The game',
  'game.section.theMatches': 'The matches',
  'game.matchNumber': 'Match {number}',
  'game.noMatches':
    'No matches were recorded for this game. Games logged before per-match detail existed have only their overall result, which still counts towards every record.',
  'game.depth.edit': 'Edit match detail',
  'game.depth.add': 'Add match detail',
  'game.depth.meta': 'Opening deal · Mulligan · Final score',
  // Screen-reader labels. Translated for the same reason everything else is —
  // a German app that speaks English to a blind user is not a German app.
  'game.depth.a11y': 'Add in-depth match detail',
  'game.note.a11y': 'Game note',

  // ── Logging a game ────────────────────────────────────────────────────────
  'log.title': 'Log a game',
  'log.close': 'Close',
  'log.mode': 'Logging mode',
  'log.mode.simplified': 'Simplified',
  'log.mode.advanced': 'Advanced',
  'log.mode.help':
    'Advanced mode tracks opening hands, mulligans and per-match score alongside the result.',
  'log.yourDeck': 'Your deck',
  'log.chooseDeck': 'Choose a deck',
  'log.legend': 'Legend',
  'log.chooseLegend': 'Choose a Legend',
  'log.chosenChampion': 'Chosen Champion',
  'log.chooseChampion': 'Choose a Champion',
  'log.legendFirst': 'Pick a Legend first',
  'log.opponentSkip': 'Skip it and the game still counts',
  'log.noDeckYet': 'No deck',
  'log.opponentNotRecorded': 'Opponent not recorded',
  'log.event.optional': 'Event (optional)',
  'log.event.placeholder': 'Nexus Night #4',
  'log.event.a11y': 'Event name',
  'log.event.help':
    'Name this tournament — every round and game logged under it will be grouped together.',
  'log.continue': 'Continue',
  'log.continue.a11y': 'Continue to review',
  'log.stillPlaying': 'Still playing',
  'log.noGamesYet': 'No games logged yet',
  'log.derived': 'derived from the matches',
  'log.notSavedYet': 'Nothing is saved yet — the next screen reads the game back first.',
  'log.answerEach': 'Answer each game above. {count} won takes the match.',
  'log.outcome': 'Game outcome',
  'log.review.title': 'Review before saving',
  'log.review.subtitle': 'Anything you skipped is stored as "not recorded", never guessed.',
  'log.review.finalize': 'Finalize',
  'log.review.nextRound': 'Log next round',
  'log.row.deck': 'Deck',
  'log.row.opponent': 'Opponent',
  'log.row.format': 'Format',
  'log.row.event': 'Event',
  'log.row.note': 'Note',
  'log.row.detail': 'Detail',
  'log.row.matchDetail': 'Match {number} detail',
  'log.replacedOf': 'Replaced {sent} of {dealt}',
  'log.empty.title': 'No decks yet',
  'log.empty.body':
    'A game is attached to the exact deck version that played it, so there needs to be a deck first.',
  'log.empty.build': 'Build a deck',
  'log.toast':
    'Logged · {deck}{version} now {wins}–{losses} ({rate}%)',
  'log.undo': 'Undo',

  // Leaving with a half-entered game. Three answers, but "Review and save"
  // only exists once the matches settle a result — see the screen's comment.
  'log.leave.title': 'Leave without saving?',
  'log.leave.bodyComplete':
    'This game is complete but not saved yet — closing now records nothing.',
  'log.leave.bodyPartial':
    'Nothing here is saved yet. The opponent, the games and anything you noted are held on this screen only.',
  'log.leave.review': 'Review and save',
  'log.leave.discard': 'Discard and close',
  'log.leave.stay': 'Keep logging',

  // ── One game inside the log form ──────────────────────────────────────────
  'match.card.theMatch': 'The match',
  'match.whoWon': 'Who won?',
  'match.whoWentFirst': 'Who went first?',
  'match.iDid': 'I did',
  'match.theyDid': 'They did',
  'match.firstNotSet': 'first player not set',
  'match.notSure': 'Not sure',
  'match.ourField': 'Your battlefield — from this deck',
  'match.ourField.placeholder': 'Choose from this deck',
  'match.theirField': 'Their battlefield',
  'match.theirField.placeholder': 'Search battlefields',
  // `W · Win` rather than `Win`: the letter survives when the word is clipped,
  // and this row sits in the tightest control the app has.
  'match.result.win': 'W · Win',
  'match.result.loss': 'L · Loss',
  'match.result.draw': 'D · Draw',
  'match.pickField': 'Battlefield they played',
  'match.openingHand': 'Opening hand — from this deck',
  'match.openingHand.help':
    'Tap any slot to pick the whole hand — up to {size} cards, tapping one twice for a second copy.',
  'match.mulligan': 'Mulligan',
  'match.mulligan.help':
    'First two — pick which of your opening hand went back, up to {max} at a time. Last two — the replacements you drew, once something has gone back.',
  'match.mulligan.over': '{count} sent back — Riftbound recycles at most {max}. Left as entered.',
  // Past tense, and not the same words as `game.result.*` — that pair labels a
  // control you are about to press, this one narrates what happened.
  'match.onPlay': 'On the play',
  'match.onDraw': 'On the draw',
  'match.won': 'Won',
  'match.lost': 'Lost',
  'match.drew': 'Drew',
  'match.detailSaved': 'Match detail saved',
  'match.pick.hand': 'Your opening hand',
  'match.pick.drewBack': 'What you drew back',
  'match.pick.whichBack': 'Which cards went back?',
  'match.pick.onlyDealt': 'Only the cards you were dealt.',
  'match.pick.fromDeck': 'From {deck}',
  'match.pick.partners': 'Champions that partner {legend}',
  'match.pick.thisDeck': 'this deck',
  'match.pick.noChampion': 'No Champion Unit in the library partners that Legend.',
  'match.pick.mulliganFirst':
    'Fill in the opening hand first — a card can only go back if it was dealt.',
  'match.pick.noMainDeck': 'This deck version has no main-deck cards the library can resolve.',
  'match.pick.libraryDownloading': 'The card library has not finished downloading.',
  'match.noBattlefields':
    'This deck’s current version has no Battlefields. Add them in the deck editor and they will show up here.',
  'match.slot.card': 'Card',
  'match.slot.mull': 'Mull',
  'match.slot.drew': 'Drew',
  'match.slot.dealt.a11y': 'Card {index} of the opening hand: {card}. Tap to choose the hand.',
  'match.slot.dealtEmpty.a11y':
    'Card {index} of the opening hand, not chosen. Tap to choose the hand.',
  'match.slot.mull.a11y': 'Sent back: {card}. Tap to change what went back.',
  'match.slot.mullEmpty.a11y':
    'Mulligan slot {index}, empty. Tap to choose which dealt cards went back.',
  'match.slot.drew.a11y': 'Replacement {index}: {card}. Tap to choose what you drew.',
  'match.slot.drewLocked.a11y': 'Replacement slot, unavailable until a card is sent back.',
  'match.score': 'Score',
  'match.score.notSet': 'Not set',
  'match.readBack.won': 'Won',
  'match.readBack.lost': 'Lost',
  'match.readBack.drew': 'Drew',
  'match.readBack.firstNotRecorded': 'went first not recorded',
  'match.readBack.youFirst': 'you went first',
  'match.readBack.theyFirst': 'they went first',
  'match.readBack.ourFieldMissing': 'yours not recorded',
  'match.readBack.theirFieldMissing': 'theirs not recorded',

  // ── A deck, and its overview ──────────────────────────────────────────────
  'deck.title': 'Deck',
  'deck.notFound.title': 'Deck not found',
  'deck.notFound.body': 'It may have been deleted.',
  'deck.goBack': 'Go back',
  'deck.inCollection': 'In your collection',
  'deck.preview': 'Deck preview',
  'deck.goldfish': 'Draw a test hand',
  'deck.goldfish.a11y': 'Draw a test hand from this version',
  'deck.details': 'Deck details',
  'deck.details.a11y': 'Rename this deck or edit its notes',
  'deck.duplicate': 'Copy this deck',
  'deck.edit': 'Edit deck',
  'deck.delete': 'Delete deck',
  'deck.noGames':
    'No games yet. Tap the + in the tab bar to log one — it attaches to whichever version this deck currently points at.',
  'deck.versionsHelp':
    'Every edit after your first match creates a new version here, with the exact cards that changed.',
  'deck.noStats':
    'Nothing to measure yet. Log a game and the record, the interval, and the per-version breakdown all appear here.',
  'deck.cardCount': '{count} cards',
  'deck.coverageCount': '{owned}/{required} cards',
  /* `deck.preview.list` / `.gallery` were the words the deck overview used to
     print in its toggle. The control is icons everywhere now, so only the
     screen-reader labels below still have a reader. */
  'deck.preview.list.a11y': 'List view',
  'deck.preview.gallery.a11y': 'Gallery view',
  'deck.legal': 'Legal',
  'deck.notLegal': '! Not legal',
  'version.compare': 'Compare',
  'version.compareTwo': 'Compare two versions',
  'version.compareTapTwo': 'Tap two versions to compare',
  'version.compareTapOneMore': 'Tap one more · v{version} selected',
  'build.mainMeta': '{count}/{target} cards',
  'build.sideboardMeta': '{count} cards — optional',
  'build.sideboardOptional': 'Optional — skip it',
  'deck.recordAllVersions': 'Record · all versions',
  'deck.byVersion': 'By version',
  'deck.compareHint': 'Use Compare in the Versions tab to see the cards behind the difference.',

  // ── The deck editor ───────────────────────────────────────────────────────
  'editor.cancel.a11y': 'Cancel editing',
  'editor.save.a11y': 'Save deck',
  'editor.name': 'Deck name',
  'editor.inDeck': 'In deck',
  'editor.inDeck.a11y': 'Show only cards already in the deck',
  'editor.noCardsMatch': 'No cards match.',
  'editor.searchBattlefields': 'Search Battlefields',
  'editor.searchToAdd': 'Search cards to add',
'editor.searchSideboard': 'Search cards for the sideboard',
  'editor.pickLegendFirst': 'Pick a Legend first',
  'editor.pickLegendFirst.body':
    'The Legend decides which domains the deck may hold, so there is nothing to offer until it is chosen.',
  'editor.leave.title': 'Leave without saving?',
  'editor.leave.body':
    'The draft is not stored anywhere. Under the version model an unsaved edit is not a lost keystroke, it is a deck that never existed.',
  'editor.leave.save': 'Save and leave',
  'editor.leave.discard': 'Discard and continue',
  'editor.leave.stay': 'Stay here',
  'editor.renamedTo': 'Renamed to {name}',

  // Why a card cannot go in. These lived in a module-scope constant holding
  // English, which froze the language at import — the same defect the roadmap
  // records for the tab labels. Keys now, translated where they are drawn.
  'blocked.offIdentity': 'Off identity',
  'blocked.copyLimit': 'Max {max}',
  'blocked.foreignSignature': 'Another Champion',
  'blocked.duplicate': 'Already in deck',
  'blocked.deckFull': 'Deck is full',

  'editor.identity.a11y': '{role}: {name}',
  'editor.identity.pick': 'Pick a {role}',
  'editor.identity.pickOne': 'Pick one',
  'editor.identity.legendFirst': 'Legend first',
  'editor.changeLegend': 'Change Legend',
  'editor.changeChampion': 'Change Champion',
  'editor.changeLegend.body':
    'Changing it changes the deck’s domains — cards that fall outside get flagged, not deleted',
  'editor.championsFor': 'Champions that partner {name}',
  'editor.noChampionPartner': 'No Champion Unit in the library partners this Legend.',
  'editor.libraryDownloading': 'The card library has not finished downloading.',

  'editor.overwriteTitle': 'Overwrite v{version}?',
  // Three bodies, not one with a nested ternary. Which form to use is itself a
  // translatable decision, and German does not pluralise where English does.
  'editor.overwriteBody.none': 'This version will be rewritten in place.',
  'editor.overwriteBody.one':
    'The match already logged on this version will be attributed to the edited list. This cannot be undone.',
  'editor.overwriteBody.other':
    'The {count} matches already logged on this version will be attributed to the edited list. This cannot be undone.',

  // ── Building a new deck ───────────────────────────────────────────────────
  'build.title': 'Build a deck',
  'build.save': 'Save deck',
  'build.name': 'Deck name',
  'build.prev': 'Previous step',
  'build.next': 'Next step',
  'build.search': 'Search cards',
  'build.searchIdentity': 'Search {domains} cards',
  'build.searchLegends': 'Search Legends',
  'build.searchBattlefields': 'Search Battlefields',
  'deck.goBack.a11y': 'Go back',
  'deck.copyCode.a11y': 'Copy this deck’s code to the clipboard',
  'deck.edit.a11y': 'Edit deck',
  'build.noCards': 'No cards yet',
  'build.libraryDownloading':
    'The card library has not finished downloading. Open the Collection tab to let it finish, then come back.',
  'build.noLegendMatch': 'No Legend matches that name.',
  'build.noChampion':
    'No Champion Unit in the library partners this Legend. You can continue without one.',
  'build.noRunes': 'No runes match this identity.',
  'build.runesHelp':
    'Started at an even split of your two domains. Change it, or pick a different art — every printing of a rune is the same card to the rules.',
  'build.saveAnyway': 'An unfinished deck saves fine — you can come back to it. Nothing here blocks saving.',

  // ── The collection, and one binder ────────────────────────────────────────
  "binder.fallbackName": "Binder",
  "binder.shown": "{count} shown",
  "binder.inLibrary": "{count} in library",
  "binder.syncing": "syncing",
  "binder.setAll": "All",
  "binder.nSets": "{count} sets",
  "binder.setValue": "Set · {value}",
  "binder.sortValue": "Sort · {value}",
  "binder.hint": "Tap a card to add or remove copies · foils show their sheen",
  "binder.hintGallery": "The library, every card in it. File copies into a binder to track what you own.",
  "binder.stillDownloading": "Still downloading",
  "binder.stillDownloading.body": "The card library is still coming down. What has arrived is already searchable.",
  "binder.nothingMatches": "Nothing matches",
  "binder.nothingMatches.body": "No card in the library matches those filters.",
  "binder.inThisBinder": "{count} in this binder",
  "binder.finish.sameTotal": "Counted in the same total",
  "binder.finish.regular": "Regular printing",
  "binder.finish.notPrinted": "Not printed in this finish",
  "binder.finish.add": "Add a {finish} copy",
  "binder.finish.remove": "Remove a {finish} copy",
  "binder.deleteTitle": "Delete {name}?",
  "binder.deleteThis": "this binder",
  "binder.deleteBody": "The {count} copies filed here stop counting towards what you own. The cards themselves are not affected — only this binder.",
  "binder.deleteBodyOne": "The one copy filed here stops counting towards what you own. The card itself is not affected — only this binder.",
  "binder.deleteEmpty": "It has nothing filed in it.",
  "binder.rename.a11y": "Binder name",
  "binder.filtersActive": "{count} filters active",
  'binder.notInLibrary': 'Not in the library',
  'binder.delete': 'Delete this binder',
  'binder.delete.body':
    'The cards go with it, so what you own drops by whatever was filed here. Nothing is removed from the library.',
  'binder.name': 'Binder name',
  'binder.namePlaceholder': 'Trade binder',
  'binder.search': 'Search name, text or keyword',
  'binder.searchLibrary': 'Search the card library',
  'binder.set': 'Set',
  'binder.allSets': 'All sets',
  'binder.sort': 'Sort',

  // ── Importing a deck from a code ──────────────────────────────────────────
  'import.title': 'Import a deck',
  'import.paste': 'Paste from clipboard',
  'import.read': 'Read code',
  'import.save': 'Save this deck',
  'import.codePlaceholder': 'Paste a deck code — extra text around it is fine',
  'import.code': 'Deck code',
  'import.name': 'Deck name',
  'import.namePlaceholder': 'Name this deck',
  'import.noChampion':
    'This code does not name a Chosen Champion — older codes often do not. Pick one in the editor after saving.',
  'import.different': 'Use a different code',

  // ── Stats hub ─────────────────────────────────────────────────────────────
  'stats.title': 'Stats',
  'stats.deck': 'Deck',
  'stats.noDecks': 'No decks yet',
  'stats.noDecks.body':
    'Stats are built from games, and a game is always attached to a deck. Build one first.',
  'stats.noGames': 'No games yet',
  'stats.noGames.all': 'Tap the + in the tab bar after a game.',
  'stats.noGames.deck':
    'Nothing logged for this deck yet. Tap the + in the tab bar, or pick another deck above.',
  // Separate keys rather than one string with a conditional "s" — the plural is
  // not a suffix in either of the other two languages.
  'stats.gameCount.one': '{count} game',
  'stats.gameCount.other': '{count} games',
  /** A deck in the picker that has never been played. */
  'stats.noRecord': 'No games',
  'stats.noEvents': 'No events yet',
  'stats.noEvents.body':
    'An event groups the rounds of one tournament or games night, so you can see how that day went rather than only how the deck does overall. Log a game, pick an organised game style, and name one.',
  'stats.event.a11y': '{name}, {rounds} rounds',
  'stats.event.placed': 'Placed {place}',

  // The history window, stated rather than silent — a list that hides rows
  // without saying so is worse than a slow one.
  'history.window': 'Showing the {shown} most recent of {total}.',
  'history.more': 'Show {count} more',
  'history.all': 'All {total} shown.',

  // ── Card gallery filters ──────────────────────────────────────────────────
  'filters.clearAll': 'Clear all',
  'filters.close': 'Close filters',
  'filters.hideAltArt': 'Hide alternate art',
  'filters.hideAltArt.help': 'Alternate printings duplicate cards already in the grid.',
  'filters.domain': 'Domain',
  'filters.type': 'Type',
  'filters.cost': 'Cost',
  'filters.rarity': 'Rarity',
  'filters.set': 'Set',
  'filters.sortBy': 'Sort by',

  // ── After-the-fact match detail ───────────────────────────────────────────
  'detail.title': 'Match detail',
  'detail.save': 'Save detail',
  'detail.help':
    'Everything here is optional and independent — a score with no opening hand still counts towards the score breakdown. Leave anything you do not remember blank rather than guessing at it.',
  'detail.notEditable':
    'Which matches were played is not editable here — the game result is derived from them, so adding one would let this screen contradict the record it describes. Correct the matches on the game itself.',
  'detail.noMatches': 'No matches recorded',
  'detail.noMatches.body':
    'This game was logged before per-match detail existed, or its matches were cleared. Detail attaches to a match, so there is nothing to attach it to yet.',

  // ── Goldfishing a test hand ───────────────────────────────────────────────
  'goldfish.title': 'Test hand',
  'goldfish.draw': 'Draw a card',
  'goldfish.draw.a11y': 'Draw one card',
  'goldfish.empty': 'The deck is empty — every card is in hand.',
  'goldfish.reshuffle': 'Shuffle up and deal again',
  'goldfish.reshuffle.a11y': 'Shuffle up and deal a new hand',
  'goldfish.nothing': 'Nothing to draw',
  'goldfish.nothing.body':
    'This version has no main deck yet, so there is no hand to open on. Add cards and come back.',

  // ── An event ──────────────────────────────────────────────────────────────
  'event.title': 'Event',
  'event.notFound': 'Event not found',
  'event.notFound.body':
    'It may have been deleted. Any games played at it are still in your history.',
  'event.edit': 'Edit event',
  'event.details': 'Event details',
  'event.delete': 'Delete event',
  'event.style': 'Event style',
  'event.deleteTitle': 'Delete {name}?',
  // Singular and plural as their own keys — German does not inflect where
  // English does, and the count sits in a different clause.
  'event.deleteBody.one':
    'The game played here is kept — it still counts towards your deck and overall records. Only the grouping goes.',
  'event.deleteBody.other':
    'The {count} games played here are kept — they still count towards your deck and overall records. Only the grouping goes.',
  'event.deleteBody.none': 'This event has no games logged against it.',
  'event.noRounds': 'No rounds yet',
  'event.roundsLogged.one': '1 round logged',
  'event.roundsLogged.other': '{count} rounds logged',
  'event.finished': 'Finished {place}',
  'event.ofScheduled': 'of {count} scheduled',
  'event.changePlacement': 'Change placement',
  'event.recordPlacement': 'Record where you placed',
  'event.name': 'Name',
  'event.notesPlaceholder': 'How did it go? What would you change?',
  'event.finalPlacement': 'Final placement',
  'event.roundsPlaceholder': 'Rounds scheduled, if you know',
  'event.placement': 'Where did you place?',

  // ── Decks tab ─────────────────────────────────────────────────────────────
  'decks.title': 'Decks',
  'decks.empty': 'Track a deck through every change',
  'decks.empty.body':
    'Matches stay attached to the exact list that played them, so editing a deck never rewrites its history.',
  'decks.import': 'Import a deck code',
  'decks.build': 'Build a deck',

  // ── Collection tab ────────────────────────────────────────────────────────
  'collection.title': 'Collection',
  "collection.copies": "copies",
  "collection.distinctOf": "{distinct} of {total} cards",
  "collection.searchCount": "Search {count} cards — offline",
  "collection.searchPlain": "Search the library",
  "collection.stillDownloading": "The library is still downloading, so the total will grow.",
  "collection.galleryRow": "Every card in the library · {copies} copies owned",
  "collection.binderRow": "{distinct} cards · {copies} copies",
  "collection.binderEmpty": "Empty — nothing filed here yet",
  "collection.showMoreSets": "Show {count} more sets",
  "collection.showOneMoreSet": "Show 1 more set",
  "collection.showFewerSets": "Show fewer sets",
  "collection.setProgress.a11y": "{label}, {owned} of {total} cards",
  'collection.newBinder': 'New binder',
  'collection.searchLibrary': 'Search the card library',

  // ── The editor's card-pool filters ────────────────────────────────────────
  'pool.clear': 'Clear filters',
  'pool.search': 'Search cards',
  'pool.sort': 'Sort',
  'pool.type': 'Type',
  'pool.set': 'Set',

  // ── Analytics ─────────────────────────────────────────────────────────────
  'analytics.casualGames': 'Casual games',
  'analytics.overall': "Overall",
  'analytics.record': 'RECORD',
  'analytics.format': 'FORMAT',
  'analytics.needs.scope': 'No games in this scope.',
  'analytics.needs.turnOrder':
    'Nothing recorded yet. Each match on the log form asks who went first; answer it and this fills in.',
  'analytics.needs.format':
    'No format recorded yet. Every game logged from here on records Bo1 or Bo3.',
  'analytics.needs.style': 'No games logged yet.',
  'analytics.needs.hands':
    'No opening deals recorded yet. Open a logged game, choose Add match detail, and tap the cards you were dealt — once for a card you kept, twice for one you sent back.',
  'analytics.needs.scores':
    'No scores recorded yet. Riftbound scores to 8, and winning 8–7 is a different match from winning 8–0 — the result column cannot tell them apart. Add it from a logged game.',
  'analytics.from.games': 'From {recorded} of {total} games where it was recorded.',
  'analytics.from.deals': 'From {recorded} of {total} matches where the deal was recorded.',
  'analytics.from.scores':
    'From {recorded} of {total} matches where the score was recorded. Close means decided by {margin} points or fewer.',
  'analytics.cardGone': 'No longer in the library',
  'analytics.casual.a11y.on': 'Casual games included',
  'analytics.casual.a11y.off': 'Casual games excluded',
  'analytics.noGamesYet': 'No games yet',
  'analytics.ci': '95% CI {low}–{high}%',
  'analytics.ci.provisional': '95% CI {low}–{high}% · under 20 games',
  'analytics.turnOrder': "TURN ORDER",
  'analytics.wentFirst': "Went first",
  'analytics.wentSecond': "Went second",
  'analytics.gameStyle': "GAME STYLE",
  'analytics.openingHands': "OPENING HANDS",
  'analytics.howClose': "HOW CLOSE",
  'analytics.cardsThrownBack': "CARDS YOU THROW BACK",
  'analytics.scoreMargin': "SCORE MARGIN",
  'analytics.theyScoredInWins': "They scored, in your wins",
  'analytics.youScoredInLosses': "You scored, in your losses",
  'analytics.currentStreak': "Current streak",
  'analytics.longestRun': "Longest run",
  'analytics.gamesCount': "{count} games",
  'analytics.winRate': 'win rate',
  'analytics.moreBreakdowns': 'More breakdowns',
  'analytics.opponent': 'Opponent',
  'analytics.empty': 'No games logged yet',
  'analytics.empty.body':
    'Win rate, findings, and breakdowns appear once you log your first game with this deck.',

  /*
   * ── Findings ──────────────────────────────────────────────────────────────
   *
   * The hardest strings in the app to translate, and the ones most worth doing
   * properly: these are sentences the app writes *about the player's own data*,
   * and they are the whole reason the analytics screen exists.
   *
   * Every one is split into a **headline** and its **evidence**, and both are
   * fully parameterised — no fragment is concatenated in code. That matters more
   * here than anywhere else: German puts the verb where English puts the object,
   * so a sentence assembled from pieces in English word order cannot be made to
   * read as German however the pieces are translated.
   */
  'finding.version.ahead': '{current} is beating {previous}.',
  'finding.version.behind': '{current} is behind {previous}.',
  'finding.version.evidence':
    '{current} {currentRate} over {currentGames} games · {previous} {previousRate} over {previousGames}',

  'finding.matchup.worse': '{opponent} decks beat you.',
  'finding.matchup.better': 'You beat {opponent} decks.',
  'finding.matchup.evidence':
    '{opponent} · {record} · {rate} against {restRate} in your other games',

  'finding.card.headline': 'You throw {card} back more often than you keep it.',
  'finding.card.evidence': '{mulliganed} of {seen} opening hands it was dealt in',

  'finding.margin.winClose': 'You win the close ones and lose the clear ones.',
  'finding.margin.winClear': 'Your wins are clear and your losses are close.',
  'finding.margin.evidence':
    'Close {close} · clear {clear} ({recorded} of {total} matches scored)',

  'finding.order.first': 'Going first measurably helps this deck.',
  'finding.order.second': 'Going second measurably helps this deck.',
  'finding.order.evidence':
    'On the play {onPlay} · on the draw {onDraw} ({recorded} of {total} games recorded)',

  'finding.nextStep': 'Nothing separates yet — about {more} more {games} would start to tell.',
  'finding.nextStep.uncapped':
    'Nothing separates yet. The differences so far are smaller than this many games can resolve.',
  'finding.game': 'game',
  'finding.games': 'games',

  /*
   * ── Zones, tabs and buttons ───────────────────────────────────────────────
   *
   * These were missed on the first pass and are the most visible strings in the
   * app: a scanner that looked for JSX text *with a space in it* skipped every
   * single-word button, and one that looked at known prop names never saw
   * `{ win: 'WIN' }`. Copy lives wherever someone put it.
   *
   * **Card data still stays English** — domain names, card types, rarities and
   * set names all appear on the physical card, and a decklist that disagrees
   * with the table is worse than an English one. The *labels for* those things
   * are the app's own words and are translated: "Rarity" is ours, "Epic" is the
   * card's.
   */
  'zone.legendChampion': 'Legend & Champion',
  'zone.legend': 'Legend',
  'zone.champion': 'Champion',
  'zone.main': 'Main deck',
  /*
   * Short forms for the editor's four-across zone tabs and the legality strip.
   *
   * German needs them more than English does: `Hauptdeck` and `Schlachtfelder`
   * are fine as section headings on the overview and far too long for a quarter
   * of a row, so the two are separate keys rather than one string doing both
   * jobs badly.
   */
  'zone.mainShort': 'Main',
  'zone.battlefieldsShort': 'Battlefields',
  'zone.runes': 'Runes',
  'zone.battlefields': 'Battlefields',
  'zone.sideboard': 'Sideboard',

  'tab.decks': 'Decks',
  'tab.collection': 'Collection',
  'tab.stats': 'Stats',
  /*
   * The tab bar draws this in 9.5px uppercase JetBrains Mono, monospace, in a
   * cell of roughly 76pt on a small phone — about eight characters. German
   * "Einstellungen" is thirteen and wraps to two lines, taking the bar's height
   * with it, so the shorter-but-still-correct "Optionen" is used there and on
   * the screen itself, rather than having the tab and its title disagree.
   */
  'tab.settings': 'Settings',
  'tab.logGame.hint': 'Opens the match log sheet',

  'deckTab.overview': 'Overview',
  'deckTab.versions': 'Versions',
  'deckTab.matches': 'Matches',
  'deckTab.stats': 'Stats',

  'statsTab.games': 'Games',
  'statsTab.analytics': 'Analytics',
  'statsTab.events': 'Events',
  'stats.allDecks': 'All decks',

  'action.share': 'Share',
  'action.edit': 'Edit',
  'action.save': 'Save',
  'action.done': 'Done',
  'action.clear': 'Clear',
  'action.next': 'Next',
  'action.new': 'New',
  'action.import': 'Import',
  'action.archive': 'Archive',
  'action.overwrite': 'Overwrite',
  'action.keepAsIs': 'Keep it as it is',
  'action.backToDecks': 'Back to decks',
  'action.openCollection': 'Open Collection',

  'deck.archived': 'Archived',
  'deck.current': 'Current',
  'deck.archiveThis': 'Archive this deck',
  'deck.restoreArchive': 'Restore from archive',
  'deck.archiveTitle': 'Archive {name}?',
  'deck.archiveBody':
    'It leaves the deck list. Its versions and match history are kept, and it still counts in your overall stats — “Show archived” on the Decks tab brings it back.',
  'deck.shareFailed': 'Something went wrong building the deck code.',
  'deck.shareTitle': 'Could not build a code',
  // Two keys rather than one with an optional tail: German puts the caveat list
  // where English does not, and a joined fragment cannot move.
  'deck.copied': 'Copied to clipboard',
  'deck.copiedWith': 'Copied to clipboard · {caveats}',
  'deck.deleteTitle': 'Delete this deck?',
  'deck.deleteBody': 'Its versions and match history go with it.',
  'version.deleteFailed': 'This version cannot be deleted',
  'version.hasGames':
    'It has matches logged against it, and those results only mean anything attached to the list that played them.',
  'version.lastOne': 'A deck has to keep at least one version.',
  'deck.legalRest': 'Everything else checks out.',
  'deck.pooledPrintings': 'Same cards, different printings — pooled',
  'deck.details.name': 'Name',
  'deck.details.namePlaceholder': 'Deck name',
  'deck.details.notesPlaceholder': 'What is this deck trying to do? What did you last change?',
  // The details sheet reuses the existing `version.label` below rather than
  // adding a second key for the same field.
  'version.notesPlaceholder': 'Why did you make this change?',
  'import.unreadable': 'That code could not be read.',

  'collection.binders': 'Binders',
  'collection.gallery': 'Gallery',
  'binder.sort.name': 'Name',
  'binder.sort.collector': 'Collector number',
  'binder.sort.energy': 'Energy',
  'binder.sort.rarity': 'Rarity',
  'filters.title': 'Filters',
  'filters.sort.relevance': 'Best match',
  'filters.sort.name': 'Name',
  'filters.sort.cost': 'Cost',
  'filters.sort.collector': 'Set order',
  'filters.sort.rarity': 'Rarity',
  'pool.sort.energy': 'Energy cost',
  'pool.sort.name': 'Name',

  'card.energy': 'Energy',
  'card.might': 'Might',
  'card.power': 'Power',

  'build.pickLegend': 'Pick a Legend',
  'build.pickChampion': 'Pick a Champion',
  'build.review': 'Review',

  'event.rounds': 'Rounds',

  // Result badges. Uppercase in English because the badge is set in the mono
  // face; the German and French forms keep that but are their own words.
  'result.win': 'WIN',
  'result.loss': 'LOSS',
  'result.draw': 'DRAW',

  // Card-library sync progress, shown in Profile.
  'sync.checking': 'Checking for new cards',
  'sync.downloading': 'Downloading cards',
  'sync.indexing': 'Building search index',
  'sync.failed': 'Sync failed',

  // Legality issues that are not built from counts.
  'legality.noLegend': 'Pick a Legend — it sets the deck’s domains',
  // ── Legality, from lib/legality.ts ───────────────────────────────────────
  // Whole sentences per case. The count messages used to be assembled from a
  // label, a fraction and a tail; German puts the shortfall before the noun, so
  // the pieces cannot be joined in one order and read correctly in the other.
  'legality.zone.main': 'Main deck',
  'legality.zone.runes': 'Runes',
  'legality.zone.battlefields': 'Battlefields',
  'legality.short.one': '{zone} {actual}/{required} — 1 more card',
  'legality.short.other': '{zone} {actual}/{required} — {count} more cards',
  'legality.over': '{zone} {actual}/{required} — {count} too many',
  'legality.championNotUnit': '{name} is not a Champion Unit',
  'legality.championName': '{name} does not match {legend}',
  'legality.championDomain': '{name} is outside {domains}',
  'legality.battlefieldDuplicate': '{count} copies of {name} — Battlefields must be different',
  'legality.copyLimit': '{count} copies of {name} — the limit is {limit}',
  'legality.signatureLimit': '{count} Signature cards — the limit is {limit}',
  'legality.foreignSignature.one': '{name} is another Champion’s Signature card',
  'legality.foreignSignature.other': '{count} Signature cards belong to another Champion',
  'legality.offIdentity.one': '{name} is outside {domains}',
  'legality.offIdentity.other': '{count} cards are outside {domains}',

  // ── Deck codes, from lib/deck-code.ts ────────────────────────────────────
  'deckCode.unknownCard': 'An unknown card',
  'deckCode.nothingToShare': 'There is nothing in this deck a code can carry yet.',
  'deckCode.pasteFirst': 'Paste a deck code first.',
  'deckCode.noneFound': 'No deck code found in that text.',
  'deckCode.notValidLooking': 'That does not look like a valid deck code.',
  'deckCode.importedName': 'Imported deck',
  'deckCode.enterOne': 'Enter a deck code.',
  'deckCode.notValid': 'That is not a valid deck code.',

  // ── Card library sync ────────────────────────────────────────────────────
  'sync.downloadingCount': 'Downloading cards ({done}/{total})',
  // Replaces the raw exception text that used to reach the Settings screen —
  // including Zod's own English output. The detail is still written to
  // `sync_meta.last_error` for diagnosis.
  'sync.offline': 'Could not reach the card library. Your saved cards are unaffected.',

  // ── Analytics phrasing ───────────────────────────────────────────────────
  'hands.keptOpening': 'Kept the opening hand',
  'hands.decidedBy': 'Decided by {margin} or fewer',
  'analytics.bestOf': 'Best of {count}',
  'diff.newArt': 'New art for {name}',

  // ── Printing treatments ──────────────────────────────────────────────────
  // App vocabulary, not card data: none of these words is printed on a card,
  // and the collection filter already says "Alternative Artworks ausblenden" in
  // German — so leaving the badge English would contradict the filter above it.
  // `Alternate Art` and `Overnumbered` are NOT here: they are parsed out of
  // the card's own name and matched against it, so they are card data. See the
  // note in scan.ts's CARD_VOCABULARY.
  'finish.foil': 'Foil',
  'finish.standard': 'Standard',
  'legality.noChampion': 'Pick a Champion Unit',

  'hands.decidedByMore': 'Decided by more',

  // ── Shared UI chrome ──────────────────────────────────────────────────────
  'ui.dismiss': 'Dismiss',
  'ui.close': 'Close',
  'ui.goBack': 'Go back',
  'ui.notes': 'Notes',
  'ui.logGame': 'Log a game',

  // ── Onboarding ────────────────────────────────────────────────────────────
  'onboarding.step': 'Step {step} of {total}',
  'onboarding.welcome': 'Welcome to Riftbound Tracker',
  'onboarding.welcome.body':
    'Track your decks, log your games, and see which changes actually helped — all on your device.',
  // The disclaimer. Stated on the first screen a user ever sees, because a
  // half-built app that says so is a different thing from one that does not.
  'onboarding.wip': 'In development',
  'onboarding.wip.body':
    'An unfinished project, built in the open — expect things to change or break between updates. Your decks and games live only on this device.',
  // The library's state on first launch. The point of every one of these is the
  // same: it is arriving, and nothing is waiting on it.
  'onboarding.library.downloading': 'Fetching the card library — {count} cards so far.',
  'onboarding.library.starting': 'Fetching the card library.',
  'onboarding.library.updating': '{count} cards ready. Checking for new ones in the background.',
  'onboarding.library.ready': '{count} cards on this device. Browsing and deckbuilding work offline.',
  'onboarding.library.failed':
    '{count} cards on this device. Could not check for new ones — everything still works offline.',
  'onboarding.library.failedEmpty':
    'The card library could not be fetched. You can build decks once it arrives; try again from Settings.',
  'profile.replay': 'Show the welcome again',
  'profile.replay.body':
    'Walks back through the first-run screens. Your name and language stay as they are unless you change them.',
  'onboarding.start': 'Get started',

  'onboarding.setup': 'Set up your profile',
  'onboarding.setup.body': 'You can change any of this later in Settings.',
  'onboarding.name': 'Screen name',
  'onboarding.name.placeholder': 'e.g. Master Yi Main',
  'onboarding.name.help': 'Only stored on this device. Nothing is sent anywhere.',
  'onboarding.name.next': 'Continue',
  'onboarding.language': 'Language',
  'onboarding.language.default': 'Default',
  'onboarding.firstDeck': 'First deck',
  'onboarding.import': 'Import a deck',
  'onboarding.import.body': 'Paste a deck code you already have',
  'onboarding.new': 'Create a new deck',
  'onboarding.new.body': 'Start empty and build it up card by card',
  'onboarding.skip': 'I’ll look around first',

  // ── Settings ──────────────────────────────────────────────────────────────
  'profile.name': 'Your name',
  'profile.namePlaceholder': 'Not set',
  'profile.name.a11y': 'Your display name',
  'profile.nameHelp':
    'Only used on this device for now. When cloud sync arrives it will be the name on your account.',

  'profile.report': 'Feedback',
  // States what is *not* collected, because that is the surprising part. The
  // app attaches nothing — no device, no version, no counts.
  'profile.report.body':
    'Found a bug, or want something added? Only what you write here is included — nothing about your device is collected.',
  'profile.report.kind': 'What is this?',
  'profile.report.kind.bug': 'Bug',
  'profile.report.kind.feature': 'Feature wish',
  'profile.report.placeholder': 'What happened, or what you would like to see',
  'profile.report.a11y': 'Your feedback',
  'profile.report.copy': 'Copy',
  'profile.report.copied': 'Copied — paste it wherever you send it',
  // Honest about the state of things rather than pretending at a Send button.
  'profile.report.noBackend':
    'There is nowhere to send this from inside the app yet. Copying is the whole of it for now.',

  'profile.library': 'Card library',
  'profile.library.stored':
    '{count} cards stored on this device. Browsing, searching, and deckbuilding all work without a connection.',
  'profile.library.empty': 'No cards stored yet.',
  'profile.library.refresh': 'Refresh card library',
  'profile.library.refreshing': 'Refreshing…',
  'profile.about': 'About',
  'profile.about.unofficial':
    'Riftbound Tracker is an unofficial fan project. It is not affiliated with, endorsed by, or sponsored by Riot Games.',
  'profile.about.attribution':
    'Card data comes from Riftcodex. Card images, names, and game text are the property of Riot Games, used under Riot’s Legal Jibber Jabber policy for non-commercial fan content.',

  // ── A single card ─────────────────────────────────────────────────────────
  'card.notFound': 'Card not found',
  'card.notFound.body':
    'It may have been removed from the card library. Refreshing the library in Settings usually fixes this.',

  // ── Binders ───────────────────────────────────────────────────────────────
  'binder.new': 'New binder',
  'binder.new.subtitle': 'Somewhere to file cards you own — a trade binder, a deck box, a shelf.',

  // ── Legality readout ──────────────────────────────────────────────────────
  'legality.legal': 'Legal deck',
  /*
   * `legality.verdictOk`, `verdictBad` and `summary` lived here and are gone.
   *
   * The verdict read *"Legal — every zone is within its limits."*, was shortened
   * to *"Legal"*, and then stopped existing at all: the editor's card renders
   * **nothing** when there is nothing wrong, so there is no passing sentence
   * left to write. `summary` went with the two count readouts the zone tabs
   * replaced.
   *
   * Deleted rather than kept warm. A key nobody looks up is a translation three
   * people have to maintain for a string that never appears.
   */
  'legality.moreToFix': '{count} more to fix.',
  'legality.unresolved':
    '{count} cards in this deck are not in the library, so the zone counts are short by that much. They are kept when you save.',
  'legality.unresolvedOne':
    '1 card in this deck is not in the library, so the zone counts are short by that much. It is kept when you save.',
  'legality.main': 'Main',
  'legality.runes': 'Runes',
  'legality.fields': 'Fields',

  // ── Versions ──────────────────────────────────────────────────────────────
  'version.ahead': 'v{number} is measurably ahead — the intervals do not overlap.',
  'version.mainCount': '{count}/{target} main',
  'version.changeCount': '{count} changes',
  'version.a11y': 'Version {number}{label}, {count} matches',
  'version.hint.pick': 'Tap to pick this version for the comparison',
  'version.hint.compare': 'Long press to compare with another version',
  'version.untitled': 'Untitled change',
  'version.firstBuild': 'First build',
  'version.forkedFrom': 'Forked from v{number}',
  'version.legal': 'Legal',
  'version.incomplete': 'Incomplete',
  'version.locked': 'Locked',
  'version.noGamesYet': 'No games yet',
  'version.current': 'Current',
  'version.matchCount.one': '1 match',
  'version.matchCount.other': '{count} matches',
  'version.nothingToCompare': 'One of these has no games logged yet, so there is nothing to compare.',
  'version.tooClose':
    'Too close to call — the intervals overlap, and no realistic number of matches would separate them.',
  'version.tooCloseWithEstimate':
    'Too close to call — the intervals overlap. About {count} more {games} would start to separate them.',
  'version.earlier': 'Earlier',
  'version.later': 'Later',
  'version.printingsOnly': 'Only the printings changed — the same cards.',
  'version.whereItStarted': 'Where the deck started.',
  'version.currentList': 'Current list',
  'version.openList': 'Open this list',
  'version.firstBuildMeta': 'First build · {count} {cards}',
  'version.saveAs': 'Save as v{number}',
  'version.saveChanges': 'Save changes',
  'version.save': 'Save',
  'version.amendMeta.one': 'Rewrites v{number} in place. Its 1 match will describe the edited list.',
  'version.amendMeta.other':
    'Rewrites v{number} in place. Its {count} matches will describe the edited list.',
  'version.forkExplain.one':
    'v{number} has 1 match logged against it, so it stays exactly as it was played and this change becomes v{next}.',
  'version.forkExplain.other':
    'v{number} has {count} matches logged against it, so it stays exactly as it was played and this change becomes v{next}.',
  'version.forkExplain.locked':
    'v{number} is locked, so it stays exactly as it is and this change becomes v{next}.',
  'diff.noChanges': 'No changes',
  'diff.nothingChanged': 'Nothing changed',
  'diff.reprinted.one': '1 card swapped to a different printing',
  'diff.reprinted.other': '{count} cards swapped to a different printing',
  'diff.moved.one': '1 card in and out',
  'diff.moved.other': '{count} cards in and out',
  'goldfish.openingHand': 'Opening hand',
  'goldfish.hand': 'Hand',
  'goldfish.keep': 'Keep this hand',
  'goldfish.recycle': 'Recycle {count}',
  'goldfish.recycleAndDraw': 'Recycle {count} and draw',
  'build.legendMeta': 'It sets the deck’s two domains',
  'build.championMeta': 'Partners {name}',
  'build.reviewMeta': 'Name it and save',
  'build.cancel': 'Cancel',
  'import.checkOver': 'Check it over, then save',
  'import.pasteCode': 'Paste a deck code',
  'import.noCards': 'That code resolved to no cards this app knows about.',
  'import.noLegend': 'This code has no Legend, so there is no deck to build from it.',
  'import.defaultName': 'Imported deck',
  'picker.tapAgain': '· tap again to add a copy, once more to clear',
  'picker.nothingToChoose': 'Nothing to choose from.',
  'picker.tapHint': 'Tap to add a copy, tap past the limit to clear',
  'slot.tapToChoose': 'Tap to choose',
  'slot.draw': 'DRAW',
  'slot.mull': 'MULL',
  'analytics.none': 'None',
  'analytics.findings': 'FINDINGS',
  'analytics.against': 'AGAINST',
  'deck.promoSent.one': '1 promo printing sent as standard',
  'deck.promoSent.other': '{count} promo printings sent as standard',
  'deck.unknownCard': 'an unknown card',
  'decks.hideArchived': 'Hide archived',
  'decks.showArchived.one': 'Show 1 archived deck',
  'decks.showArchived.other': 'Show {count} archived decks',
  'filters.noCardsMatch': 'No cards match',
  'filters.showCards.one': 'Show 1 card',
  'filters.showCards.other': 'Show {count} cards',
  'card.removeCopy': 'Remove a copy of {name}',
  'card.addCopy': 'Add a copy of {name}',
  'picker.chosenOf': '{chosen} of {limit} chosen',
  'analytics.streak.none': 'None',
  'matchup.you': 'YOU',
  'matchup.them': 'THEM',
  'binder.default': 'DEFAULT',
  'binder.create': 'Create',
  'legality.legalA11y': 'Deck is legal',
  'legality.issuesA11y.one': '1 issue. {headline}',
  'legality.issuesA11y.other': '{count} issues. {headline}',
  'game.unknownLegend': 'Unknown',
  'game.unknownOpponent': 'Unknown opponent',
  'event.openA11y': 'Open {name}',
  'editor.lockedBanner.one.long':
    'v{number} · 1 game tracked — saving will create v{next}. v{number} stays exactly as it was played, so its result still means something. Your changes become v{next}.',
  'editor.lockedBanner.other.long':
    'v{number} · {count} games tracked — saving will create v{next}. v{number} stays exactly as it was played, so its results still mean something. Your changes become v{next}.',
  'editor.lockedBanner.locked.long':
    'v{number} · locked — saving will create v{next}. v{number} stays exactly as it is, and your changes become v{next}.',
  'editor.lockedBanner.one': 'v{number} · 1 match tracked — saving will create v{next}',
  'editor.lockedBanner.other': 'v{number} · {count} matches tracked — saving will create v{next}',
  'editor.lockedBanner.locked': 'v{number} · locked — saving will create v{next}',
  'save.noChanges': 'No changes to save',
  'save.forked': 'Saved as v{version} · your earlier version is untouched',
  // The first fork names the games left behind — a fact about their deck rather
  // than a statement of policy. One key per plural, as everywhere else.
  'save.forkedFirst.one': 'Saved as v{version} · v{parent} keeps its 1 game',
  'save.forkedFirst.other': 'Saved as v{version} · v{parent} keeps its {count} games',
  'save.amended': 'v{version} overwritten · its games now count for this list',
  'version.keepEditing': 'Keep editing',
  'version.nameThis': 'Name this version',
  'version.label': 'Version label',
  'version.fork': 'Fork from here',
  'version.labelNotes': 'Label & notes',
  'version.delete': 'Delete version',
  'version.noChanges': 'No card changes',
  'version.didItHelp': 'Did it help?',
  'version.correlational':
    'Correlational, not causal. The metagame moves and pilots improve, so a version that looks better may simply have been played later.',
  'version.whatChanged': 'What changed',
  'version.identical': 'These two lists are identical.',

  // ── Small readouts ────────────────────────────────────────────────────────
  'winRate.noMatches': 'No matches',
  'deckCard.legendArt': 'Legend art',
  'deckPreview.yourDeck': 'Your deck',

  // ── One match, read back ──────────────────────────────────────────────────
  // Past tense, and a *word* rather than a colour: win-green against loss-red
  // is the pairing this app has banned since M1, so these have to survive
  // greyscale on their own.
  'match.outcome.won': 'WON',
  'match.outcome.lost': 'LOST',
  'match.outcome.drew': 'DREW',
  'match.youWentFirst': 'You went first',
  'match.theyWentFirst': 'They went first',
  'match.score.you': 'You',
  'match.score.them': 'Them',
  'match.hand.dealt': 'Dealt {count}',
  'match.hand.sentBack': '{count} sent back',
  'match.hand.keptAll': 'kept them all',
  'match.hand.drewBack': 'Drew back',
  'match.hand.cardGone': 'No longer in the library',

  // ── Profile ───────────────────────────────────────────────────────────────
  'profile.title': 'Settings',
  'profile.localOnly': 'Local only',
  'profile.nothingLeaves': 'Nothing leaves this device',
  'profile.language': 'Language',
  'profile.languageHelp':
    'Card names and rules text stay in English — they have to match the cards in your hand.',
} as const;
