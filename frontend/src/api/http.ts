export async function readJson<T>(response: Response, fallback: T): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(text) as T;
  } catch (_error) {
    return fallback;
  }
}
