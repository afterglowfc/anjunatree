// Apple Music catalog search — for resolving a "Listen on Apple Music"
// link, not for playback. Deliberately NOT MusicKit JS: catalog search only
// ever needed the developer token (never a per-user Music-User-Token), and
// Apple's REST API supports direct browser fetches (CORS-enabled — it's
// what MusicKit JS itself calls under the hood), so there's no reason to
// load a third-party SDK just to look up a track. That also means this
// works for every visitor, with no "connect" step at all — a real
// improvement over Spotify here, which can only offer an exact link to the
// small number of accounts it's allowed to authenticate (see musicLinks.ts).
//
// Storefront is a fixed approximation ('us'), not detected: Apple has no
// anonymous storefront-lookup endpoint, only an authenticated
// /v1/me/storefront. The vast majority of this catalogue is broadly
// available regardless, so this is a reasonable default, not a guarantee
// for every locale.

const DEV_TOKEN = (import.meta.env.VITE_APPLE_DEV_TOKEN as string | undefined) ?? ''
const STOREFRONT = 'us'

export const isConfigured = (): boolean => DEV_TOKEN.length > 0

interface CatalogSearchResponse {
  results?: {
    songs?: {
      data?: { attributes?: { url?: string } }[]
    }
  }
}

/** Resolve a catalog song's canonical web URL by artist/title. Null if
 *  unconfigured, not found, or the request fails — callers fall back to a
 *  plain search link either way, so this never needs to throw. */
export async function findAppleMusicLink(artist: string, title: string): Promise<string | null> {
  if (!DEV_TOKEN) return null
  const term = encodeURIComponent(`${artist} ${title}`)
  try {
    const res = await fetch(
      `https://api.music.apple.com/v1/catalog/${STOREFRONT}/search?term=${term}&types=songs&limit=1`,
      { headers: { Authorization: `Bearer ${DEV_TOKEN}` } },
    )
    if (!res.ok) return null
    const json = (await res.json()) as CatalogSearchResponse
    return json.results?.songs?.data?.[0]?.attributes?.url ?? null
  } catch {
    return null
  }
}
