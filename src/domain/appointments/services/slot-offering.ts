import { DateTime } from 'luxon';

export interface FreeWindow {
  // Bookable start range: the client can begin between these two clock times inclusive.
  firstStart: Date;
  lastStart: Date;
}

// Contiguous or overlapping starts become one stretch the client can read as
// "podés empezar entre 9 y 11". A booking that removes the middle of the day splits
// the window there. We merge by treatment occupancy, then expose start bounds only —
// the occupancy end is never a bookable hour.
export function mergeFreeWindows(
  slots: ReadonlyArray<{ startsAt: Date }>,
  durationMinutes: number,
): FreeWindow[] {
  if (slots.length === 0) return [];

  const ordered = [...slots].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  const endOf = (start: Date): Date =>
    new Date(start.getTime() + durationMinutes * 60_000);

  const windows: FreeWindow[] = [];
  let firstStart = ordered[0].startsAt;
  let lastStart = ordered[0].startsAt;
  let occupancyEnd = endOf(ordered[0].startsAt);

  for (let i = 1; i < ordered.length; i += 1) {
    const nextStart = ordered[i].startsAt;
    const nextEnd = endOf(nextStart);
    // Contiguous when the next start falls inside or right at the end of the current
    // window: a 15-minute grid for a 60-minute service overlaps heavily, and that is
    // still one free stretch.
    if (nextStart.getTime() <= occupancyEnd.getTime()) {
      if (nextStart > lastStart) lastStart = nextStart;
      if (nextEnd > occupancyEnd) occupancyEnd = nextEnd;
      continue;
    }

    windows.push({ firstStart, lastStart });
    firstStart = nextStart;
    lastStart = nextStart;
    occupancyEnd = nextEnd;
  }

  windows.push({ firstStart, lastStart });
  return windows;
}

// Spread a handful of concrete offers across the day instead of dumping the first N of
// the 15-minute grid. Prefers :00, then :30, then whatever is free.
export function pickSpreadSlots<T extends { startsAt: Date }>(
  slots: ReadonlyArray<T>,
  limit: number,
  timezone: string,
): T[] {
  if (slots.length === 0 || limit <= 0) return [];
  if (slots.length <= limit) {
    return [...slots].sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );
  }

  const ordered = [...slots].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
  const first = ordered[0].startsAt.getTime();
  const last = ordered[ordered.length - 1].startsAt.getTime();
  const span = last - first;
  const picked: T[] = [];
  const used = new Set<number>();

  for (let i = 0; i < limit; i += 1) {
    const target =
      limit === 1 ? first : first + Math.round((span * i) / (limit - 1));
    const candidate = bestNearTarget(ordered, target, used, timezone);
    if (!candidate) continue;
    picked.push(candidate);
    used.add(candidate.startsAt.getTime());
  }

  // A target may have landed on a slot already claimed by a neighbour. Fill the remaining
  // seats with the free slots farthest from what we already chose.
  while (picked.length < limit) {
    const remaining = ordered.filter(
      (slot) => !used.has(slot.startsAt.getTime()),
    );
    if (remaining.length === 0) break;

    const farthest = remaining.reduce((best, slot) => {
      const distance = minDistance(slot.startsAt.getTime(), used);
      const bestDistance = minDistance(best.startsAt.getTime(), used);
      if (distance !== bestDistance)
        return distance > bestDistance ? slot : best;
      return preferRounder(slot, best, timezone);
    });

    picked.push(farthest);
    used.add(farthest.startsAt.getTime());
  }

  return picked.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function bestNearTarget<T extends { startsAt: Date }>(
  ordered: T[],
  target: number,
  used: ReadonlySet<number>,
  timezone: string,
): T | null {
  const free = ordered.filter((slot) => !used.has(slot.startsAt.getTime()));
  if (free.length === 0) return null;

  // Roundness only wins inside a neighbourhood of the target: otherwise a :00 at 17:00
  // would steal the morning seat. One hour either side is enough for a 15-minute grid.
  const NEIGHBOURHOOD_MS = 60 * 60 * 1000;

  return free.reduce((best, slot) => {
    const bestDistance = Math.abs(best.startsAt.getTime() - target);
    const slotDistance = Math.abs(slot.startsAt.getTime() - target);
    const bestNear = bestDistance <= NEIGHBOURHOOD_MS;
    const slotNear = slotDistance <= NEIGHBOURHOOD_MS;

    if (slotNear && bestNear) {
      const bestRound = roundness(localMinute(best.startsAt, timezone));
      const slotRound = roundness(localMinute(slot.startsAt, timezone));
      if (slotRound !== bestRound) return slotRound < bestRound ? slot : best;
    }

    if (slotDistance !== bestDistance) {
      return slotDistance < bestDistance ? slot : best;
    }
    return slot.startsAt.getTime() < best.startsAt.getTime() ? slot : best;
  });
}

function preferRounder<T extends { startsAt: Date }>(
  a: T,
  b: T,
  timezone: string,
): T {
  const aRound = roundness(localMinute(a.startsAt, timezone));
  const bRound = roundness(localMinute(b.startsAt, timezone));
  if (aRound !== bRound) return aRound < bRound ? a : b;
  return a.startsAt.getTime() <= b.startsAt.getTime() ? a : b;
}

// Lower is better: on the hour, then half past, then everything else.
function roundness(minute: number): number {
  if (minute === 0) return 0;
  if (minute === 30) return 1;
  return 2;
}

function localMinute(at: Date, timezone: string): number {
  return DateTime.fromJSDate(at, { zone: timezone }).minute;
}

function minDistance(at: number, used: ReadonlySet<number>): number {
  if (used.size === 0) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const other of used) {
    const distance = Math.abs(at - other);
    if (distance < best) best = distance;
  }
  return best;
}
