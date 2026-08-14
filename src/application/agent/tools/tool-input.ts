export function asObject(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Tool input must be an object');
  }
  return input as Record<string, unknown>;
}

export function requiredString(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

export function requiredUuid(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = requiredString(input, key);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`${key} must be a UUID`);
  }
  return value;
}

export function optionalString(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  return input[key] === undefined || input[key] === null
    ? undefined
    : requiredString(input, key);
}

export function optionalUuid(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  return input[key] === undefined || input[key] === null
    ? undefined
    : requiredUuid(input, key);
}

export function optionalIsoDate(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  return input[key] === undefined || input[key] === null
    ? undefined
    : requiredIsoDate(input, key);
}

export function requiredIsoDate(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = requiredString(input, key);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${key} must be an ISO 8601 date`);
  }
  return value;
}
