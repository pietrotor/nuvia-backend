const MAX_LENGTH = 500;

// The owner writes business facts in a free text field, and that text lands inside the
// system prompt. Line breaks and markdown are stripped so the note cannot look like a new
// prompt section: it has to read as one quoted paragraph of data.
export function sanitizeBusinessNotes(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;

  const collapsed = raw
    .replace(/[#*_`~>[\]{}]/g, ' ')
    .replace(/["']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH)
    .trim();

  return collapsed.length > 0 ? collapsed : null;
}
