import { useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import { scaleLinear } from "d3-scale";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Hotspot {
  name: string;
  coordinates: [number, number];
  risk: string;
  detail: string;
  count: number;
}

interface WorldMapProps {
  hotspots: Hotspot[];
  onCountryClick?: (countryName: string) => void;
}

export function InteractiveWorldMap({ hotspots, onCountryClick }: WorldMapProps) {
  const [tooltipContent, setTooltipContent] = useState("");
  const [position, setPosition] = useState({ coordinates: [0, 20], zoom: 1 });

  // Map country name to a hotspot for coloring
  const hotspotMap = useMemo(() => {
    const map: Record<string, Hotspot> = {};
    hotspots.forEach(h => {
      map[h.name] = h;
    });
    return map;
  }, [hotspots]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...hotspots.map(h => h.count));
  }, [hotspots]);

  const colorScale = scaleLinear<string>()
    .domain([1, maxCount])
    .range(["#c9a227", "#dc3545"]); // Yellow to Red based on event count

  function handleMoveEnd(position: any) {
    setPosition(position);
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 120 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={position.zoom} center={position.coordinates as [number, number]} onMoveEnd={handleMoveEnd} maxZoom={8}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const countryName = geo.properties.name;
                const hotspot = hotspotMap[countryName];
                
                const fill = hotspot ? colorScale(hotspot.count) : "var(--surface-3)";
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => {
                      if (hotspot) {
                        setTooltipContent(`${countryName} - ${hotspot.detail}`);
                      } else {
                        setTooltipContent(countryName);
                      }
                    }}
                    onMouseLeave={() => {
                      setTooltipContent("");
                    }}
                    onClick={() => {
                      if (onCountryClick) {
                        onCountryClick(countryName);
                      }
                    }}
                    style={{
                      default: { fill, outline: "none", stroke: "var(--line)", strokeWidth: 0.5, transition: "fill 0.2s" },
                      hover: { fill: "var(--accent)", outline: "none", stroke: "var(--bg)", strokeWidth: 1, cursor: "pointer" },
                      pressed: { fill: "var(--accent-2)", outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {/* Add markers for exact coordinate points if needed */}
          {hotspots.map(h => (
            <Marker key={h.name} coordinates={h.coordinates}>
              <circle r={position.zoom > 3 ? 2 : 4} fill={h.risk === "critical" ? "var(--critical)" : h.risk === "high" ? "var(--high)" : "var(--medium)"} opacity={0.8} />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      
      {/* Tooltip display */}
      {tooltipContent && (
        <div style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface-4)",
          color: "var(--text)",
          padding: "6px 12px",
          borderRadius: "4px",
          fontSize: "0.8rem",
          fontWeight: 600,
          pointerEvents: "none",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--line)",
          zIndex: 10
        }}>
          {tooltipContent}
        </div>
      )}
    </div>
  );
}
