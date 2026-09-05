"use client";

type GoogleMapsNamespace = typeof google.maps;

let mapsPromise: Promise<GoogleMapsNamespace> | null = null;

export function getGoogleMapsBrowserKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim();
  return key || null;
}

/**
 * Lazy-load Maps JavaScript API once per page. Planner-only — not global layout.
 */
export function loadGoogleMapsBrowserApi(): Promise<GoogleMapsNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Maps JS is browser-only"));
  }

  const existing = (window as Window & { google?: { maps?: GoogleMapsNamespace } }).google?.maps;
  if (existing) return Promise.resolve(existing);

  if (mapsPromise) return mapsPromise;

  const key = getGoogleMapsBrowserKey();
  if (!key) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is missing"));
  }

  mapsPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const callbackName = `__theallMapsInit_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      const maps = (window as Window & { google?: { maps?: GoogleMapsNamespace } }).google?.maps;
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (!maps) {
        mapsPromise = null;
        reject(new Error("Google Maps failed to initialize"));
        return;
      }
      resolve(maps);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=ko&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsPromise = null;
      delete (window as unknown as Record<string, unknown>)[callbackName];
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}
