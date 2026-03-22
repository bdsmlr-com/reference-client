export function resolveBinding(model: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cursor: unknown = model;

  for (const part of parts) {
    if (cursor === null || typeof cursor !== 'object') {
      throw new Error(`Unknown binding path: ${path}`);
    }
    const obj = cursor as Record<string, unknown>;
    if (!(part in obj)) {
      throw new Error(`Unknown binding path: ${path}`);
    }
    cursor = obj[part];
  }

  return cursor;
}
