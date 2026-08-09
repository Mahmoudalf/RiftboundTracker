import { newId } from '@/lib/id';

import { conn } from '../connection';
import type { EventRow, EventStyle, MatchRow } from '../schema/matches';

import { hydrateEvent } from './hydrate';
import { listMatches } from './matches';

/**
 * Events — a specific tournament, Nexus Night or Skirmish.
 *
 * Distinct from `matches.event_type`, which has been recorded since M4 and is a
 * *category*: "this was a Nexus Night". An event is the *instance*: "the Nexus
 * Night on 9 August, five rounds, finished third". The category answers how you
 * do at Nexus Nights in general; the instance answers how that night went, and
 * carries the one number a tournament produces that nothing else stores —
 * where you placed.
 *
 * The table has existed since migration 6 with nothing able to write it, so
 * `matches.event_id` has been null on every row ever logged. This is what makes
 * it real.
 */

const now = () => new Date().toISOString();

export interface EventSummary extends EventRow {
  wins: number;
  losses: number;
  draws: number;
  /** Matches logged into it — the round count actually played. */
  total: number;
}

export interface CreateEventInput {
  name: string;
  eventType: EventStyle;
  location?: string | null;
  /** Defaults to now. Set explicitly when back-filling last week's tournament. */
  startedAt?: string;
}

/**
 * Record columns, shared by the list and the single-event read.
 *
 * Deleted matches are excluded here the same way they are everywhere else: an
 * undone match never happened, and an event that still counts it would disagree
 * with every other number in the app.
 */
const RECORD_SELECT = /* sql */ `
  COALESCE(SUM(CASE WHEN m.result = 'win'  THEN 1 ELSE 0 END), 0) AS wins,
  COALESCE(SUM(CASE WHEN m.result = 'loss' THEN 1 ELSE 0 END), 0) AS losses,
  COALESCE(SUM(CASE WHEN m.result = 'draw' THEN 1 ELSE 0 END), 0) AS draws,
  COUNT(m.id) AS total
`;

function toSummary(row: Record<string, unknown>): EventSummary {
  return {
    ...hydrateEvent(row),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    draws: Number(row.draws ?? 0),
    total: Number(row.total ?? 0),
  };
}

export function listEvents(): EventSummary[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT e.*, ${RECORD_SELECT}
         FROM events e
         LEFT JOIN matches m ON m.event_id = e.id AND m.deleted_at IS NULL
        WHERE e.deleted_at IS NULL
        GROUP BY e.id
        ORDER BY e.started_at DESC, e.rowid DESC`
    )
    .map(toSummary);
}

export function getEvent(eventId: string): EventSummary | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    `SELECT e.*, ${RECORD_SELECT}
       FROM events e
       LEFT JOIN matches m ON m.event_id = e.id AND m.deleted_at IS NULL
      WHERE e.id = ? AND e.deleted_at IS NULL
      GROUP BY e.id`,
    [eventId]
  );
  return row?.id ? toSummary(row) : null;
}

export function createEvent(input: CreateEventInput): string {
  const id = newId();
  const timestamp = now();

  conn().runSync(
    `INSERT INTO events
       (id, name, event_type, started_at, location, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      input.name.trim() || 'Event',
      input.eventType,
      input.startedAt ?? timestamp,
      input.location?.trim() || null,
      timestamp,
      timestamp,
    ]
  );
  return id;
}

export interface EventPatch {
  name?: string;
  eventType?: EventStyle;
  location?: string | null;
  rounds?: number | null;
  finalPlacement?: number | null;
  notes?: string | null;
}

export function updateEvent(eventId: string, patch: EventPatch): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  const put = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  // Blank clears, matching every other text setter in the app.
  if (patch.name !== undefined) put('name', patch.name.trim() || 'Event');
  if (patch.eventType !== undefined) put('event_type', patch.eventType);
  if (patch.location !== undefined) put('location', patch.location?.trim() || null);
  if (patch.notes !== undefined) put('notes', patch.notes?.trim() || null);
  if (patch.rounds !== undefined) put('rounds', patch.rounds);
  if (patch.finalPlacement !== undefined) put('final_placement', patch.finalPlacement);
  if (sets.length === 0) return;

  put('updated_at', now());
  conn().runSync(`UPDATE events SET ${sets.join(', ')}, dirty = 1 WHERE id = ?`, [
    ...params,
    eventId,
  ]);
}

/**
 * Soft delete. The matches are left attached and completely untouched.
 *
 * They happened, and detaching them would rewrite history to tidy up a label.
 * Because every read filters on `events.deleted_at IS NULL`, a match whose event
 * is deleted simply reports no event — and the link survives for sync, exactly
 * as a deleted binder keeps its cards.
 */
export function deleteEvent(eventId: string): void {
  const timestamp = now();
  conn().runSync('UPDATE events SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    timestamp,
    timestamp,
    eventId,
  ]);
}

/** The rounds, oldest first — an event reads forwards, unlike a match list. */
export function eventMatches(eventId: string): MatchRow[] {
  return listMatches({ eventId }).slice().reverse();
}
