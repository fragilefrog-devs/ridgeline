/**
 * Guarded JSON fetch for the RidgeLine API.
 *
 * Every API call in the app goes through here so that a missing or misrouted
 * backend produces a readable error instead of the browser's cryptic
 * `Unexpected token 'T', "The page c"... is not valid JSON` — which is what a
 * plain `await res.json()` yields when the host answers an unknown `/api/*`
 * path with a 404 `text/plain` (or HTML) error page.
 *
 * The helper is dependency-free. It does not alter the caller's success-path
 * contract: on a 2xx JSON response it resolves with the parsed body, exactly
 * like `fetch(...).then(r => r.json())` did.
 */

const MAX_SNIPPET_LENGTH = 200;

function snippet(body: string): string {
  const trimmed = (body || '').trim();
  if (!trimmed) return '(empty response body)';
  return trimmed.length > MAX_SNIPPET_LENGTH
    ? `${trimmed.slice(0, MAX_SNIPPET_LENGTH)}…`
    : trimmed;
}

async function readBodyText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '(response body could not be read)';
  }
}

function statusLabel(res: Response): string {
  return res.statusText ? `${res.status} ${res.statusText}` : `${res.status}`;
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: options.credentials ?? 'include',
  });

  if (!res.ok) {
    throw new Error(
      `Request to ${path} failed with HTTP ${statusLabel(res)} — ${snippet(await readBodyText(res))}`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(
      `Request to ${path} returned a non-JSON response (content-type: ${contentType || 'not set'}) — ${snippet(await readBodyText(res))}`
    );
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    throw new Error(
      `Request to ${path} returned a body that is not valid JSON (${(err as Error).message})`
    );
  }
}
