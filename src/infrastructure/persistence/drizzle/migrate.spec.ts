import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

describe('migration journal', () => {
  it('keeps timestamps strictly increasing so Drizzle cannot skip a file', () => {
    const journal = JSON.parse(
      readFileSync(
        join(__dirname, '../../../../drizzle/migrations/meta/_journal.json'),
        'utf8',
      ),
    ) as { entries: JournalEntry[] };

    for (let index = 1; index < journal.entries.length; index += 1) {
      const previous = journal.entries[index - 1];
      const entry = journal.entries[index];
      expect(entry.when).toBeGreaterThan(previous.when);
    }
  });
});
