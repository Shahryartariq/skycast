"use client";

import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  TILE,
  baseTileUrl,
  tilesFor,
  weatherTileUrl,
  type Layer,
} from "@/lib/tiles";

/** The map's own coordinate space; CSS scales it to the page. 16:9, like the tiles' 256 px grid. */
const WIDTH = 768;
const HEIGHT = 432;

const LAYER_NAMES: Record<Layer, string> = { rain: "Rain", clouds: "Clouds" };

/**
 * Current rain or cloud cover around a place, on a street map. An SVG of map tiles rather than a
 * map library: nothing to download, nothing to set inline styles (the CSP blocks those), and
 * tiles load only once the map scrolls near the screen.
 */
export function RainMap({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [layer, setLayer] = useState<Layer>("rain");

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tiles = visible ? tilesFor(lat, lon, zoom, WIDTH, HEIGHT) : [];

  return (
    <div className="rain-map">
      <div className="map-tools">
        <div className="map-layers" role="group" aria-label="Map layer">
          {(Object.keys(LAYER_NAMES) as Layer[]).map((key) => (
            <button key={key} type="button" aria-pressed={layer === key} onClick={() => setLayer(key)}>
              {LAYER_NAMES[key]}
            </button>
          ))}
        </div>
        <div className="map-zoom" role="group" aria-label="Zoom">
          <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
            −
          </button>
        </div>
      </div>

      <div className="map-frame" ref={frame}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={`${LAYER_NAMES[layer]} map around ${name}`}
          data-layer={layer}
          data-zoom={zoom}
        >
          <g className="map-base">
            {tiles.map((t) => (
              <image key={`b${zoom}-${t.x}-${t.y}`} href={baseTileUrl(zoom, t.x, t.y)} x={t.left} y={t.top} width={TILE} height={TILE} />
            ))}
          </g>
          <g className={`map-weather map-${layer}`}>
            {tiles.map((t) => (
              <image
                key={`${layer}${zoom}-${t.x}-${t.y}`}
                href={weatherTileUrl(layer, zoom, t.x, t.y)}
                x={t.left}
                y={t.top}
                width={TILE}
                height={TILE}
              />
            ))}
          </g>
          <circle className="map-pin-halo" cx={WIDTH / 2} cy={HEIGHT / 2} r="11" />
          <circle className="map-pin" cx={WIDTH / 2} cy={HEIGHT / 2} r="5" />
        </svg>
      </div>

      <div className="map-foot">
        {layer === "rain" ? (
          <span className="map-legend map-legend-rain">
            Light <span className="map-scale" aria-hidden="true" /> Heavy rain
          </span>
        ) : (
          <span className="map-legend map-legend-clouds">
            Clear <span className="map-scale" aria-hidden="true" /> Overcast
          </span>
        )}
        <span className="map-credit">
          Map ©{" "}
          <a href="https://www.openstreetmap.org/copyright" rel="noopener">
            OpenStreetMap
          </a>{" "}
          contributors, ©{" "}
          <a href="https://carto.com/attributions" rel="noopener">
            CARTO
          </a>
          . Weather © OpenWeather.
        </span>
      </div>
    </div>
  );
}
