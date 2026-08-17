import { wclGraphql } from '../wcl/client/graphql-client.mjs';
import { CORPUS_DEEP_EVENTS_QUERY, CORPUS_DEEP_EVENTS_CONTINUATION_QUERY } from '../wcl/queries/corpus.mjs';
import { paginatorEvents } from '../wcl/normalization/events.mjs';

export const DEEP_STREAM_PAGINATION_POLICY_VERSION = 'deep-stream-pagination-v1';
export const DEEP_STREAM_KEYS = Object.freeze([
  'enemyCasts',
  'friendDamage',
  'interrupts',
  'debuffs',
  'buffs',
  'enemyBuffs',
  'enemyDebuffs',
  'deaths',
]);

const finiteCursor = value => Number.isFinite(Number(value)) ? Number(value) : null;

function continuationVariables({code,fightIDs,cursors,active}) {
  const vars = { code:String(code), fightIDs:[...(fightIDs || [])] };
  for (const key of DEEP_STREAM_KEYS) {
    vars[`${key}On`] = active.has(key);
    vars[`${key}Start`] = active.has(key) ? finiteCursor(cursors[key]) : null;
  }
  return vars;
}

function streamSnapshot(report = {}, key) {
  return {
    events:paginatorEvents(report?.[key]),
    cursor:finiteCursor(report?.[key]?.nextPageTimestamp),
  };
}

/**
 * Fetch complete canonical Deep event streams for exact fightIDs.
 *
 * WCL paginates each aliased event stream independently. The initial multiplex query
 * retrieves page 1 of all eight streams; continuation requests then advance only the
 * aliases that still expose nextPageTimestamp, each from its own cursor.
 *
 * If a cursor stalls or the safety round limit is reached, the merged response retains
 * a non-null nextPageTimestamp for that stream. normalizeDeepProfile therefore keeps
 * completeness=false and canonical Deep correctly refuses to count the report.
 */
export async function fetchCompleteDeepEventData({
  code,
  fightIDs = [],
  maxContinuationRounds = 12,
} = {}) {
  const ids = [...new Set((fightIDs || []).map(Number).filter(Number.isFinite))];
  if (!code || !ids.length) throw new Error('Deep event pagination requires report code and exact fightIDs');

  const first = await wclGraphql(CORPUS_DEEP_EVENTS_QUERY, { code:String(code), fightIDs:ids });
  const firstReport = first?.reportData?.report;
  if (!firstReport) {
    return {
      data:first,
      pagination:{
        policyVersion:DEEP_STREAM_PAGINATION_POLICY_VERSION,
        queryCount:1,
        continuationRounds:0,
        complete:false,
        reason:'missing-report',
        streams:{},
      },
    };
  }

  const events = {};
  const cursors = {};
  const pages = {};
  const stalled = new Set();
  for (const key of DEEP_STREAM_KEYS) {
    const snap = streamSnapshot(firstReport, key);
    events[key] = [...snap.events];
    cursors[key] = snap.cursor;
    pages[key] = 1;
  }

  let lastRateLimit = first?.rateLimitData || null;
  let queryCount = 1;
  let continuationRounds = 0;

  while (continuationRounds < Math.max(0, Number(maxContinuationRounds) || 0)) {
    const active = new Set(DEEP_STREAM_KEYS.filter(key => cursors[key] != null && !stalled.has(key)));
    if (!active.size) break;

    const before = Object.fromEntries([...active].map(key => [key, Number(cursors[key])]));
    const page = await wclGraphql(CORPUS_DEEP_EVENTS_CONTINUATION_QUERY, continuationVariables({
      code,
      fightIDs:ids,
      cursors,
      active,
    }));
    queryCount++;
    continuationRounds++;
    if (page?.rateLimitData) lastRateLimit = page.rateLimitData;
    const report = page?.reportData?.report || {};

    for (const key of active) {
      const snap = streamSnapshot(report, key);
      events[key].push(...snap.events);
      pages[key]++;
      if (snap.cursor == null) {
        cursors[key] = null;
        continue;
      }
      if (!(Number(snap.cursor) > Number(before[key]))) {
        // Never loop forever or pretend a truncated stream is complete.
        cursors[key] = Number(before[key]);
        stalled.add(key);
        continue;
      }
      cursors[key] = Number(snap.cursor);
    }
  }

  const remaining = DEEP_STREAM_KEYS.filter(key => cursors[key] != null);
  const maxRoundsReached = remaining.length > 0 && continuationRounds >= Math.max(0, Number(maxContinuationRounds) || 0);
  const mergedReport = { ...firstReport };
  for (const key of DEEP_STREAM_KEYS) {
    mergedReport[key] = {
      data:events[key],
      nextPageTimestamp:cursors[key] == null ? null : Number(cursors[key]),
    };
  }

  return {
    data:{
      ...first,
      ...(lastRateLimit ? { rateLimitData:lastRateLimit } : {}),
      reportData:{
        ...(first?.reportData || {}),
        report:mergedReport,
      },
    },
    pagination:{
      policyVersion:DEEP_STREAM_PAGINATION_POLICY_VERSION,
      queryCount,
      continuationRounds,
      complete:remaining.length === 0,
      reason:remaining.length === 0 ? 'complete' : (stalled.size ? 'stalled-cursor' : (maxRoundsReached ? 'max-continuation-rounds' : 'incomplete')),
      remainingStreams:remaining,
      stalledStreams:[...stalled],
      streams:Object.fromEntries(DEEP_STREAM_KEYS.map(key => [key, {
        pages:Number(pages[key] || 0),
        events:Number(events[key]?.length || 0),
        complete:cursors[key] == null,
        nextPageTimestamp:cursors[key] == null ? null : Number(cursors[key]),
      }])),
    },
  };
}
