// Shareable state: JSON input + expression, deflate-compressed and base64url
// encoded into the URL hash as `#s=<payload>`.

export interface ShareState {
  json: string;
  expr: string;
}

const PREFIX = 's=';

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const response = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

export async function encodeState(state: ShareState): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify({ j: state.json, e: state.expr }));
  return PREFIX + toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')));
}

/** Returns null for an absent or malformed hash. Accepts the hash with or without '#'. */
export async function decodeState(hash: string): Promise<ShareState | null> {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bytes = await pipe(fromBase64Url(text.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { j?: unknown; e?: unknown };
    if (typeof parsed.j !== 'string' || typeof parsed.e !== 'string') return null;
    return { json: parsed.j, expr: parsed.e };
  } catch {
    return null;
  }
}
