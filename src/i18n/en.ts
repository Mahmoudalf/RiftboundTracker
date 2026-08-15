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
  'deck.preview.list': 'List',
  'deck.preview.gallery': 'Gallery',
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
  'stats.noEvents': 'No events yet',
  'stats.noEvents.body':
    'An event groups the rounds of one tournament or games night, so you can see how that day went rather than only how the deck does overall. Log a game, pick an organised game style, and name one.',

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
  'tab.you': 'You',
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
  'deck.shareFailed': 'Something went wrong building the deck code.',
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
  'legality.noChampion': 'Pick a Champion Unit',

  'hands.decidedByMore': 'Decided by more',

  // ── Shared UI chrome ──────────────────────────────────────────────────────
  'ui.dismiss': 'Dismiss',
  'ui.close': 'Close',
  'ui.goBack': 'Go back',
  'ui.notes': 'Notes',
  'ui.logGame': 'Log a game',

  // ── Profile cards ─────────────────────────────────────────────────────────
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
  'profile.title': 'You',
  'profile.localOnly': 'Local only',
  'profile.nothingLeaves': 'Nothing leaves this device',
  'profile.language': 'Language',
  'profile.languageHelp':
    'Card names and rules text stay in English — they have to match the cards in your hand.',
} as const;
