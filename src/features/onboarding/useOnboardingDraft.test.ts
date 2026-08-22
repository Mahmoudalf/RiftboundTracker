import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTestConnection } from '@/db/connection';
import { MIGRATIONS } from '@/db/migrations';
import { applyMigrationsUpTo, createTestDatabase, type TestDatabase } from '@/db/testing';
import { useLocale } from '@/i18n';

import { setupRevealed, useOnboardingDraft } from './useOnboardingDraft';

/**
 * The language-picker loop.
 *
 * Choosing a language on step 2 sent the flow back to step 1, every time, with
 * no way past it. The root layout keys its `Stack` on the locale, so a language
 * change remounts the navigator and unmounts the onboarding screen — and the
 * step was `useState` inside it.
 *
 * These tests hold the two halves of that apart: the draft must not live in the
 * component (it survives here, in module scope), and changing the locale must
 * not touch it. A regression in either direction brings the loop back.
 */

let db: TestDatabase;

beforeEach(() => {
  db = createTestDatabase();
  applyMigrationsUpTo(db, MIGRATIONS, MIGRATIONS[MIGRATIONS.length - 1]!.version);
  setTestConnection(db);
  useOnboardingDraft.getState().reset();
  useLocale.setState({ locale: 'en' });
});

afterEach(() => {
  setTestConnection(null);
  db.close();
});

describe('the draft', () => {
  it('starts at step one, empty', () => {
    const s = useOnboardingDraft.getState();
    expect(s.step).toBe(1);
    expect(s.name).toBe('');
    expect(s.nameCommitted).toBe(false);
  });

  it('only commits a name with something in it', () => {
    useOnboardingDraft.getState().commitName();
    expect(useOnboardingDraft.getState().nameCommitted).toBe(false);

    useOnboardingDraft.getState().setName('   ');
    useOnboardingDraft.getState().commitName();
    // Whitespace must not reveal the language rows — the field looks empty and
    // the flow would appear to advance on nothing.
    expect(useOnboardingDraft.getState().nameCommitted).toBe(false);

    useOnboardingDraft.getState().setName('Linus');
    useOnboardingDraft.getState().commitName();
    expect(useOnboardingDraft.getState().nameCommitted).toBe(true);
  });

  it('clears on reset, so a second run starts clean', () => {
    const d = useOnboardingDraft.getState();
    d.setStep(2);
    d.setName('Linus');
    d.commitName();

    d.reset();

    expect(useOnboardingDraft.getState()).toMatchObject({
      step: 1,
      name: '',
      nameCommitted: false,
    });
  });
});

describe('replaying from Settings', () => {
  it('carries the stored name in, already committed', () => {
    /*
     * The trap this guards: `finish()` writes the draft's name back to the
     * database. A replay that started blank would therefore **erase** a name
     * the player set months ago — a settings screen deleting a setting because
     * you looked at it. Seeding also means the rest of the flow is open
     * immediately, since the gate is "a committed name".
     */
    useOnboardingDraft.getState().beginReplay('Linus');

    const s = useOnboardingDraft.getState();
    expect(s.name).toBe('Linus');
    expect(s.nameCommitted).toBe(true);
    expect(setupRevealed(s)).toBe(true);
    expect(s.replaying).toBe(true);
  });

  it('starts at step one even if the last run was abandoned midway', () => {
    const d = useOnboardingDraft.getState();
    d.setStep(2);
    d.setName('Stale');
    d.commitName();

    useOnboardingDraft.getState().beginReplay('Linus');

    // Without the reset the flow would resume mid-form on a screen the user
    // opened expecting the beginning.
    expect(useOnboardingDraft.getState().step).toBe(1);
    expect(useOnboardingDraft.getState().name).toBe('Linus');
  });

  it('handles a player who never set a name', () => {
    useOnboardingDraft.getState().beginReplay(null);

    const s = useOnboardingDraft.getState();
    expect(s.name).toBe('');
    expect(s.nameCommitted).toBe(false);
    // Nothing to write back, so nothing to erase — and the gate stays shut
    // exactly as it would on a first run.
    expect(setupRevealed(s)).toBe(false);
  });

  it('survives a language change like every other part of the draft', () => {
    useOnboardingDraft.getState().beginReplay('Linus');
    useLocale.getState().setLocale('de');

    // `replaying` decides where the flow hands back to, and it is read at the
    // very end — after any number of remounts.
    expect(useOnboardingDraft.getState().replaying).toBe(true);
    expect(useOnboardingDraft.getState().name).toBe('Linus');
  });

  it('is cleared by reset, so the next first-run is not treated as a replay', () => {
    useOnboardingDraft.getState().beginReplay('Linus');
    useOnboardingDraft.getState().reset();

    expect(useOnboardingDraft.getState().replaying).toBe(false);
  });
});

describe('what opens the rest of the setup', () => {
  it('opens on the name alone, with no language chosen', () => {
    /*
     * The dead end this replaced: the design gated the deck choice on *choosing*
     * a language, and English is preselected. An English speaker had nothing to
     * tap, so the deck options never appeared and the flow stopped.
     *
     * Asserted without touching the locale at all — that is the whole point.
     */
    expect(setupRevealed({ name: 'Linus', nameCommitted: true })).toBe(true);
  });

  it('stays shut until the name is committed', () => {
    expect(setupRevealed({ name: '', nameCommitted: false })).toBe(false);
    // Typed but not yet committed — the field is still being filled in.
    expect(setupRevealed({ name: 'Linus', nameCommitted: false })).toBe(false);
    // Committed against a blank field cannot happen through the store, but the
    // predicate is exported and must not depend on that.
    expect(setupRevealed({ name: '   ', nameCommitted: true })).toBe(false);
  });
});

describe('choosing a language mid-flow', () => {
  it('leaves every part of the draft standing', () => {
    const d = useOnboardingDraft.getState();
    d.setStep(2);
    d.setName('Linus');
    d.commitName();

    // The exact call the language rows make. In the app this remounts the
    // navigator; here it stands in for everything that change sets off.
    useLocale.getState().setLocale('de');

    const s = useOnboardingDraft.getState();
    expect(useLocale.getState().locale).toBe('de');
    // The bug, stated as an assertion: this was 1.
    expect(s.step).toBe(2);
    expect(s.name).toBe('Linus');
    expect(s.nameCommitted).toBe(true);
    // And the sections stay open across it.
    expect(setupRevealed(s)).toBe(true);
  });

  it('survives switching language repeatedly', () => {
    const d = useOnboardingDraft.getState();
    d.setStep(2);
    d.setName('Linus');
    d.commitName();

    for (const l of ['de', 'fr', 'en', 'de'] as const) useLocale.getState().setLocale(l);

    // The loop was not a one-off reset — every press cost the user their place,
    // which is what made it inescapable rather than merely annoying.
    expect(useOnboardingDraft.getState().step).toBe(2);
    expect(setupRevealed(useOnboardingDraft.getState())).toBe(true);
  });
});

/**
 * The deck handoff — the fix for a navigation bug with two faces.
 *
 * `finish()` used to hand over with `router.replace('/deck/import')`. `replace`
 * swaps the current screen, so import became the **root** of the Decks stack
 * and the deck list was never in it. That produced two reports at once: the
 * Decks tab always came back to the paste form, and the deck opened after
 * importing had nothing beneath it, so the back control did nothing.
 *
 * The choice now travels here and the Decks tab pushes it once mounted. These
 * tests hold the two properties that make that safe.
 */
describe('the deck handoff', () => {
  beforeEach(() => useOnboardingDraft.getState().reset());

  it('is read exactly once, so a remount cannot navigate again', () => {
    useOnboardingDraft.getState().setHandoff('import');

    expect(useOnboardingDraft.getState().takeHandoff()).toBe('import');
    // The navigator remounts on every language change. A handoff that survived
    // would push a screen nobody asked for, long after onboarding ended.
    expect(useOnboardingDraft.getState().takeHandoff()).toBeNull();
    expect(useOnboardingDraft.getState().takeHandoff()).toBeNull();
  });

  it('is cleared by reset, so an abandoned run leaves nothing armed', () => {
    useOnboardingDraft.getState().setHandoff('new');
    useOnboardingDraft.getState().reset();
    expect(useOnboardingDraft.getState().takeHandoff()).toBeNull();
  });

  it('is cleared by a replay, which is a fresh run and not a resumed one', () => {
    useOnboardingDraft.getState().setHandoff('import');
    useOnboardingDraft.getState().beginReplay('Linus');
    expect(useOnboardingDraft.getState().takeHandoff()).toBeNull();
  });

  it('survives a language change, because that is when it is most likely set', () => {
    // Onboarding's whole reason for living in module scope: the locale keys the
    // navigator. A handoff set before the last language tap must still arrive.
    useOnboardingDraft.getState().setHandoff('import');
    for (const l of ['de', 'fr', 'en'] as const) useLocale.getState().setLocale(l);
    expect(useOnboardingDraft.getState().takeHandoff()).toBe('import');
  });

  it('starts empty, so nothing fires for a player who skipped the choice', () => {
    expect(useOnboardingDraft.getState().takeHandoff()).toBeNull();
  });
});
