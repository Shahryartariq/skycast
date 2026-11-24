/**
 * Map tiles: which 256 px squares of the standard web map cover a view, and which ones the
 * weather layer may be fetched for. Plain Web Mercator maths, no map library.
 */

export const TILE = 256;

/** The weather layers, by the names used in our URLs. */
export const LAYERS = { rain: "precipitation_new", clouds: "clouds_new" } as const;
export type Layer = keyof typeof LAYERS;
export const isLayer = (value: string): value is Layer => Object.hasOwn(LAYERS, value);

/** Country-wide (5) to about 200 km across (9). */
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 9;
export const DEFAULT_ZOOM = 7;

/**
 * Pakistan with a margin. The tile route only fetches weather tiles that touch this box, so it
 * can't be used as a free proxy for the whole world's tiles.
 */
export const BOUNDS = { south: 18, north: 42, west: 55, east: 85 };

/** A point's position in pixels on the whole world map at a zoom level. */
export function worldPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export interface PlacedTile {
  x: number;
  y: number;
  /** Where the tile's top-left corner goes in the view, in view pixels. */
  left: number;
  top: number;
}

/** The tiles covering a `width` × `height` view centred on a point. */
export function tilesFor(lat: number, lon: number, zoom: number, width: number, height: number): PlacedTile[] {
  const centre = worldPixel(lat, lon, zoom);
  const originX = centre.x - width / 2;
  const originY = centre.y - height / 2;
  const count = 2 ** zoom;
  const tiles: PlacedTile[] = [];
  for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + height - 1) / TILE); ty++) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + width - 1) / TILE); tx++) {
      tiles.push({
        x: ((tx % count) + count) % count,
        y: ty,
        left: Math.round(tx * TILE - originX),
        top: Math.round(ty * TILE - originY),
      });
    }
  }
  return tiles;
}

/** The latitude and longitude of a tile's edges. */
function tileBounds(x: number, y: number, zoom: number) {
  const count = 2 ** zoom;
  const lon = (tx: number) => (tx / count) * 360 - 180;
  const lat = (ty: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / count))) * 180) / Math.PI;
  return { west: lon(x), east: lon(x + 1), north: lat(y), south: lat(y + 1) };
}

/** Whether the tile route serves this tile: a real tile, at a zoom we use, near Pakistan. */
export function isServedTile(zoom: number, x: number, y: number): boolean {
  if (![zoom, x, y].every(Number.isInteger)) return false;
  if (zoom < MIN_ZOOM || zoom > MAX_ZOOM) return false;
  const count = 2 ** zoom;
  if (x < 0 || y < 0 || x >= count || y >= count) return false;
  const tile = tileBounds(x, y, zoom);
  return tile.east > BOUNDS.west && tile.west < BOUNDS.east && tile.north > BOUNDS.south && tile.south < BOUNDS.north;
}

/** Whether a place gets a map at all: the weather layer only covers Pakistan and its edges. */
export const hasMap = (lat: number, lon: number) =>
  lat > BOUNDS.south + 2 && lat < BOUNDS.north - 2 && lon > BOUNDS.west + 2 && lon < BOUNDS.east - 2;

/** Our own route for a weather tile; it adds the API key on the server. */
export const weatherTileUrl = (layer: Layer, zoom: number, x: number, y: number) => `/api/map/${layer}/${zoom}/${x}/${y}`;

/** The street map underneath, from CARTO (OpenStreetMap data). Retina tiles keep labels sharp. */
export const baseTileUrl = (zoom: number, x: number, y: number) =>
  `https://${"abcd"[(x + y) % 4]}.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}@2x.png`;
