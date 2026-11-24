import { describe, expect, it } from "vitest";

import { TILE, hasMap, isServedTile, tilesFor, worldPixel } from "./tiles";

describe("map tiles", () => {
  it("places points on the world map", () => {
    expect(worldPixel(0, 0, 0)).toEqual({ x: 128, y: 128 });
    const lahore = worldPixel(31.55, 74.34, 7);
    expect(Math.floor(lahore.x / TILE)).toBe(90);
    expect(Math.floor(lahore.y / TILE)).toBe(52);
  });

  it("covers the whole view with no gaps, centred on the place", () => {
    for (const zoom of [5, 7, 9]) {
      const tiles = tilesFor(31.55, 74.34, zoom, 768, 432);
      const left = Math.min(...tiles.map((t) => t.left));
      const top = Math.min(...tiles.map((t) => t.top));
      const right = Math.max(...tiles.map((t) => t.left + TILE));
      const bottom = Math.max(...tiles.map((t) => t.top + TILE));
      expect(left).toBeLessThanOrEqual(0);
      expect(top).toBeLessThanOrEqual(0);
      expect(right).toBeGreaterThanOrEqual(768);
      expect(bottom).toBeGreaterThanOrEqual(432);
      // Every tile is needed: none lies wholly outside the view.
      for (const t of tiles) {
        expect(t.left).toBeGreaterThan(-TILE);
        expect(t.top).toBeGreaterThan(-TILE);
        expect(t.left).toBeLessThan(768);
        expect(t.top).toBeLessThan(432);
      }
      expect(new Set(tiles.map((t) => `${t.x}/${t.y}`)).size).toBe(tiles.length);
    }
  });

  it("serves only real tiles near Pakistan, at the map's zooms", () => {
    expect(isServedTile(7, 90, 52)).toBe(true);
    expect(isServedTile(5, 22, 13)).toBe(true);
    expect(isServedTile(7, 1, 1)).toBe(false); // the Arctic, off America
    expect(isServedTile(7, 113, 50)).toBe(false); // Tokyo
    expect(isServedTile(4, 11, 6)).toBe(false); // too far out
    expect(isServedTile(10, 723, 418)).toBe(false); // too far in
    expect(isServedTile(7, 128, 52)).toBe(false); // off the edge of the world
    expect(isServedTile(7, 90.5, 52)).toBe(false);
  });

  it("gives Pakistani places a map, and not places elsewhere", () => {
    expect(hasMap(31.55, 74.34)).toBe(true); // Lahore
    expect(hasMap(24.86, 67.01)).toBe(true); // Karachi
    expect(hasMap(35.3, 75.63)).toBe(true); // Skardu
    expect(hasMap(35.68, 139.69)).toBe(false); // Tokyo
    expect(hasMap(51.51, -0.13)).toBe(false); // London
  });
});
