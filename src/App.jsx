import React, { useMemo, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from "react-leaflet";
import "./App.css";
import useSubdistricts from "./hooks/useSubdistricts";

// Custom map marker: a themed circle instead of Leaflet's default PNG pin.
const appMarkerIcon = L.divIcon({
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -16],
  html: '<div class="app-marker"></div>',
});

// Pans to the location only when it is off screen (e.g. typed coordinates);
// points picked on the map are handled by ZoomToPoint.
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!isNaN(nLat) && !isNaN(nLng) && !map.getBounds().contains([nLat, nLng])) {
      map.setView([nLat, nLng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

// How long a touch must be held on the map to pick a location.
const LONG_PRESS_MS = 1000;
// Finger movement (px) that turns a hold into a pan and cancels it.
const LONG_PRESS_MOVE_TOLERANCE = 10;
// Clicks this soon after a touch are the browser's synthetic tap clicks.
const TOUCH_CLICK_WINDOW_MS = 1500;

// Picks a location from the map: a mouse click on desktop, a long press on
// touch screens (a plain tap does nothing, so panning and tapping popups
// never move the location by accident).
function MapLocationPicker({ onPick }) {
  const map = useMap();
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    const container = map.getContainer();
    let timer = null;
    let start = null;
    let lastTouchAt = 0;
    let swallowClickUntil = 0;

    const cancel = () => {
      clearTimeout(timer);
      timer = null;
    };

    const onTouchStart = (e) => {
      lastTouchAt = Date.now();
      cancel();
      if (e.touches.length !== 1) return; // pinch zoom
      const touch = e.touches[0];
      start = { clientX: touch.clientX, clientY: touch.clientY };
      timer = setTimeout(() => {
        timer = null;
        swallowClickUntil = Date.now() + TOUCH_CLICK_WINDOW_MS;
        onPickRef.current(map.mouseEventToLatLng(start));
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (e) => {
      if (!timer) return;
      const touch = e.touches[0];
      const moved = Math.hypot(touch.clientX - start.clientX, touch.clientY - start.clientY);
      if (e.touches.length !== 1 || moved > LONG_PRESS_MOVE_TOLERANCE) cancel();
    };

    const onTouchEnd = () => {
      lastTouchAt = Date.now();
      cancel();
    };

    const onClick = (e) => {
      if (Date.now() - lastTouchAt < TOUCH_CLICK_WINDOW_MS) return;
      onPickRef.current(e.latlng);
    };

    // The marker moves under the finger on a long press, so the tap click sent
    // when the finger lifts would open its popup; drop that one click.
    const onClickCapture = (e) => {
      if (Date.now() < swallowClickUntil) {
        swallowClickUntil = 0;
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // A contextmenu listener makes Leaflet suppress the browser's long-press menu.
    const onContextMenu = () => {};

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);
    container.addEventListener("click", onClickCapture, true);
    map.on("click", onClick);
    map.on("contextmenu", onContextMenu);
    return () => {
      cancel();
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      container.removeEventListener("click", onClickCapture, true);
      map.off("click", onClick);
      map.off("contextmenu", onContextMenu);
    };
  }, [map]);

  return null;
}

// Ray-casting test of a [lng, lat] point against one GeoJSON linear ring.
const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

// Inside the outer ring and outside every hole.
const pointInPolygon = (point, rings) =>
  pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole));

const subdistrictAt = (geo, lat, lng) => {
  const feature = geo?.features?.find(({ geometry }) =>
    geometry.type === "Polygon"
      ? pointInPolygon([lng, lat], geometry.coordinates)
      : geometry.coordinates.some((rings) => pointInPolygon([lng, lat], rings)),
  );
  return feature ? feature.properties.name : "";
};

// Zooms to target.name whenever a new target object is set, so the same
// subdistrict can be zoomed to again.
function FitToGeoJSON({ geo, target }) {
  const map = useMap();
  useEffect(() => {
    if (!geo || !target?.name) return;
    const feature = geo.features?.find((f) => f.properties.name === target.name);
    if (!feature) return;
    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }
  }, [geo, target, map]);
  return null;
}

// Zoom used when a location is picked on the map (about 1:8,000 here; the
// tile layer goes up to 18, about 1:2,000).
const PICK_ZOOM = 16;

// Centres on target and zooms in close whenever a new target object is set.
function ZoomToPoint({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], PICK_ZOOM);
  }, [target, map]);
  return null;
}


const DATA = {
  Bhilwara: {
    Shahpura: {
      area: "1,285",
      lat: 25.3467,
      lng: 74.6333,
      score: 87,
      structure: "Check Dam",
      reasons: [
        "Suitable slope and elevation",
        "Good rainfall and runoff potential",
        "Favorable soil and geological condition",
        "Nearby water flow accumulation",
        "High groundwater recharge potential",
      ],
      alternatives: [
        ["Farm Pond", 72],
        ["Percolation Tank", 64],
        ["Nala Bund", 58],
      ],
    },
    Banera: {
      area: "735",
      lat: 25.8431,
      lng: 74.9482,
      score: 79,
      structure: "Farm Pond",
      reasons: [
        "Moderate slope and suitable terrain",
        "Good runoff potential",
        "Suitable soil condition",
        "Nearby drainage network",
      ],
      alternatives: [
        ["Check Dam", 75],
        ["Nala Bund", 67],
        ["Percolation Tank", 61],
      ],
    },
    Asind: {
      area: "1,112",
      lat: 25.7356,
      lng: 74.3279,
      score: 83,
      structure: "Nala Bund",
      reasons: [
        "Strong drainage-line connectivity",
        "Suitable terrain and elevation",
        "Good runoff concentration",
        "Favorable recharge potential",
      ],
      alternatives: [
        ["Check Dam", 77],
        ["Farm Pond", 70],
        ["Percolation Tank", 63],
      ],
    },
  },
};

const ICONS = {
  droplet: "◈",
  home: "🏠",
  info: "ⓘ",
  pin: "⌖",
  globe: "◎",
  target: "⊙",
  chart: "⌁",
  check: "✓",
  map: "▧",
  maximize: "⛶",
  plus: "+",
  minus: "−",
  user: "♙",
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function App() {
  const [district, setDistrict] = useState("Bhilwara");
  const [subdistrict, setSubdistrict] = useState("");
  const [lat, setLat] = useState("25.3345");
  const [lng, setLng] = useState("74.6166");
  const [mapMode, setMapMode] = useState("Satellite");
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [subdistrictGeo, setSubdistrictGeo] = useState(null);
  // Subdistrict the map fits to; set from the dropdown.
  const [fitTarget, setFitTarget] = useState(null);
  // Point the map zooms in to; set when a location is picked on the map.
  const [zoomTarget, setZoomTarget] = useState(null);

  // fetch the subdistrict boundary GeoJSON from the backend once.
  // Water bodies are not drawn; the backend detects them for a location.
  useEffect(() => {
    let cancelled = false;
    const load = async (path, setter, label) => {
      try {
        const resp = await fetch(`${API_BASE_URL}${path}`);
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const data = await resp.json();
        if (!cancelled) setter(data);
      } catch (err) {
        console.error(`Failed to load ${label}`, err);
      }
    };
    load("/api/subdistricts", setSubdistrictGeo, "subdistrict boundaries");
    return () => {
      cancelled = true;
    };
  }, []);

  // timer ref for auto-dismissing toast messages
  const messageTimerRef = React.useRef(null);

  const showMessage = (msg, duration = 2000) => {
    setMessage(msg);
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = setTimeout(() => {
      setMessage("");
      messageTimerRef.current = null;
    }, duration);
  };

  // clear pending timer on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }
    };
  }, []);

  const districtData = useSubdistricts();

  const selectedRecord = (districtData.records || []).find(
    (r) => r.subdistrict === subdistrict,
  );

  const loadSubdistrict = (name) => {
    setSubdistrict(name);
    setFitTarget({ name });
    const record = (districtData.records || []).find((r) => r.subdistrict === name);
    if (record) {
      setLat(String(record.latitude));
      setLng(String(record.longitude));
      showMessage(`Loaded ${name}`, 1800);
    } else {
      const item = DATA[district]?.[name];
      if (item) {
        setLat(String(item.lat));
        setLng(String(item.lng));
        showMessage(`Loaded demo data for ${name}`, 1800);
      } else {
        showMessage(`Selected subdistrict: ${name}`, 1800);
      }
    }
    setRecommendation(null);
    setAnalysisError("");
  };

  // A point picked on the map: set the coordinates and the subdistrict under it.
  const pickLocation = (latlng) => {
    const name = subdistrictAt(subdistrictGeo, latlng.lat, latlng.lng);
    setLat(latlng.lat.toFixed(5));
    setLng(latlng.lng.toFixed(5));
    setZoomTarget({ lat: latlng.lat, lng: latlng.lng });
    setSubdistrict(name);
    setRecommendation(null);
    setAnalysisError("");
    showMessage(
      name
        ? `Location set in ${name}`
        : "Location set outside the Bhilwara subdistricts",
      2200,
    );
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLat(coords.latitude.toFixed(4));
        setLng(coords.longitude.toFixed(4));
        // auto-dismiss this confirmation after 2.5 seconds
        showMessage("Current browser location loaded.", 2500);
      },
      () =>
        setMessage(
          "Location permission was not available. Demo coordinates remain active.",
        ),
    );
  };

  // Last structure shown, sent back so the (random, mock) recommendation
  // shows a different name on every click.
  const lastStructureRef = useRef(null);

  const getRecommendation = async () => {
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      const msg = "Latitude must be a number between -90 and 90.";
      setAnalysisError(msg);
      showMessage(msg, 3500);
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      const msg = "Longitude must be a number between -180 and 180.";
      setAnalysisError(msg);
      showMessage(msg, 3500);
      return;
    }
    if (!subdistrict) {
      const msg = "Please select a subdistrict.";
      setAnalysisError(msg);
      showMessage(msg, 3500);
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");
    setRecommendation(null);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: latNum,
          longitude: lngNum,
          subdistrict,
          previous_recommendation: lastStructureRef.current,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.water_body) lastStructureRef.current = data.recommendation;
      setRecommendation(data);
      showMessage("Recommendation received from backend.", 2200);
    } catch (err) {
      console.error("Recommendation API error", err);
      const msg =
        `Could not reach the backend at ${API_BASE_URL}. If it was idle it may be starting up; try again in a minute.`;
      setAnalysisError(msg);
      showMessage(msg, 4000);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const scoreLabel =
    recommendation && typeof recommendation.score === "number"
      ? recommendation.score >= 80
        ? "High Suitability"
        : recommendation.score >= 65
          ? "Moderate Suitability"
          : "Low Suitability"
      : "";

  // Every subdistrict boundary looks the same; the selected one is not highlighted.
  const boundaryStyle = {
    color: "#1d4ed8",
    weight: 1.5,
    fillColor: "#93c5fd",
    fillOpacity: 0.1,
  };

  return (
    <div className="app-shell">
      <main className="dashboard">

        
        <section className="panel selection-panel">
          <PanelTitle icon={ICONS.pin} title="Location & Area Selection" />
          <h3>1. Location (Latitude & Longitude)</h3>
          <Field
            label="Latitude"
            value={lat}
            onChange={setLat}
            icon={ICONS.pin}
          />
          <Field
            label="Longitude"
            value={lng}
            onChange={setLng}
            icon={ICONS.pin}
          />
          <button className="outline-green" onClick={useCurrentLocation}>
            {ICONS.target}
            <span>Use Current Location</span>
          </button>
          <div className="divider" />
          <h3>2. District</h3>

          <label className="field-label">Select District</label>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            <option value="Bhilwara">Bhilwara</option>
          </select>

          <h3>3. Subdistrict (Tehsil)</h3>

          <label className="field-label">Select Subdistrict</label>

          <select
            value={subdistrict}
            onChange={(e) => loadSubdistrict(e.target.value)}
          >
            <option value="">Select Subdistrict</option>

            {(districtData.records || []).map((item) => (
              <option key={item.subdistrict} value={item.subdistrict}>
                {item.subdistrict}
              </option>
            ))}
          </select>

          {districtData.error && (
            <div className="error-note">
              <span>{ICONS.info}</span>
              <div>
                Could not load subdistricts from the backend ({districtData.error}).
              </div>
            </div>
          )}

          <div className="details-card">
            <h4>Selected Subdistrict Details</h4>
            <Detail icon="◉" label="District" value={district} />
            <Detail icon="⌖" label="Subdistrict" value={subdistrict} />
            <Detail
              icon="▣"
              label="Area (Shapefile)"
              value={selectedRecord ? `${selectedRecord.area_km2} km²` : "—"}
            />
            <Detail
              icon="⌾"
              label="Coordinates"
              value={`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
            />
          </div>

          <button
            className="btn-primary"
            onClick={getRecommendation}
            disabled={analysisLoading}
          >
            {analysisLoading ? (
              <>
                <span className="spinner" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>{ICONS.chart}</span>
                <span>Get Recommendation</span>
              </>
            )}
          </button>
        </section>

        
        <section
          className={`panel map-panel ${fullscreen ? "map-fullscreen" : ""}`}
        >
          <PanelTitle
            icon={ICONS.globe}
            title="Selected Area Boundary (Leaflet Map)"
          />
          <div className={`map ${mapMode.toLowerCase()}`}>
            <div className="map-toggle">
              <button
                className={mapMode === "Map" ? "selected" : ""}
                onClick={() => setMapMode("Map")}
              >
                Map
              </button>
              <button
                className={mapMode === "Satellite" ? "selected" : ""}
                onClick={() => setMapMode("Satellite")}
              >
                Satellite
              </button>
            </div>
            <button
              className="map-control fullscreen"
              onClick={() => setFullscreen((v) => !v)}
            >
              {ICONS.maximize}
            </button>

            <MapContainer
              center={[Number(lat), Number(lng)]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {subdistrictGeo && (
                <GeoJSON
                  data={subdistrictGeo}
                  style={boundaryStyle}
                  interactive={false}
                />
              )}

              <Marker
                key={`marker-${lat}-${lng}`}
                position={[Number(lat), Number(lng)]}
                icon={appMarkerIcon}
              >
                <Popup>
                  {subdistrict || "Selected location"}
                  <br />
                  {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                </Popup>
              </Marker>

              <Recenter lat={Number(lat)} lng={Number(lng)} />
              <FitToGeoJSON geo={subdistrictGeo} target={fitTarget} />
              <ZoomToPoint target={zoomTarget} />
              <MapLocationPicker onPick={pickLocation} />
            </MapContainer>

            <div className="map-credit">
              OpenStreetMap (Leaflet) — interactive map
            </div>
          </div>
          <div className="map-stats">
            <Stat
              icon="⌖"
              label="Area (Approx.)"
              value={`${recommendation?.area_km2 || selectedRecord?.area_km2 || "—"} km²`}
              tone="purple"
            />
            <Stat
              icon="▣"
              label="Location"
              value={`${subdistrict}, Bhilwara`}
              tone="green"
            />
            <Stat
              icon="⌾"
              label="Coordinates"
              value={`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
              tone="blue"
            />
          </div>
        </section>

        
        <section className="panel result-panel">
          <PanelTitle icon={ICONS.chart} title="Recommendation Result" />

          {analysisError && (
            <div className="error-note">
              <span>{ICONS.info}</span>
              <div>{analysisError}</div>
            </div>
          )}

          {analysisLoading ? (
            <div className="loading-note">
              Analyzing the selected location...
            </div>
          ) : recommendation?.water_body ? (
            <WaterBodyDetails body={recommendation.water_body} />
          ) : recommendation ? (
            <>
              <div className="recommend-card">
                <div className="recommend-icon">≋</div>
                <div>
                  <p>Recommended Water Structure</p>
                  <h2>{recommendation.recommendation}</h2>
                  {recommendation.message && (
                    <p className="api-message">
                      {recommendation.message}
                    </p>
                  )}
                  {typeof recommendation.score === "number" && (
                    <>
                      <div className="thin-line" />
                      <p className="score-label">Suitability Score</p>
                      <strong>{recommendation.score}%</strong>
                      <div className="progress">
                        <span style={{ width: `${recommendation.score}%` }} />
                      </div>
                      <p className="high">{scoreLabel}</p>
                    </>
                  )}
                </div>
              </div>

              {recommendation.reasons?.length > 0 && (
                <>
                  <h3 className="why-title">Why this structure?</h3>
                  <ul className="reasons">
                    {recommendation.reasons.map((reason) => (
                      <li key={reason}>
                        <span>{ICONS.check}</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {recommendation.alternatives?.length > 0 && (
                <div className="alternatives">
                  <h3>Other Suitable Options</h3>
                  {recommendation.alternatives.map((alt) => (
                    <div className="alt-row" key={alt.name}>
                      <span>{alt.name}</span>
                      <b className={alt.score >= 70 ? "good" : "warn"}>
                        {alt.score}%
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty-note">
              Select a location and click “Get Recommendation” to see the
              suggested water structure, or the details of an existing water
              body at that location.
            </div>
          )}

          <div className="info-note">
            <span>{ICONS.info}</span>Recommendation is based on GIS analysis,
            environmental factors, and suitability criteria.
          </div>
        </section>
      </main>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

// Details of the existing water body at the selected location. Its data comes
// from the structure point on it, or the nearest one when none lies on it.
function WaterBodyDetails({ body }) {
  const rows = [
    ["Work name", body.work_name],
    ["Village", body.village],
    ["Gram Panchayat", body.gram_panchayat],
    ["Panchayat", body.panchayat],
    ["Ar", body.ar],
    ["Length", body.length],
    ["Depth", body.depth],
    ["Structure Sr. no", body.sr_no],
  ];
  const source =
    body.match_type === "inside"
      ? `From the structure point on this water body (${body.points_on_body} point${body.points_on_body > 1 ? "s" : ""} on it).`
      : `No structure point lies on this water body; showing the nearest one, ${Math.round(body.point_distance_m)} m away.`;

  return (
    <>
      <div className="recommend-card">
        <div className="recommend-icon">≋</div>
        <div>
          <p>Existing Water Body</p>
          <h2>{body.activity || "Water body"}</h2>
          <p className="api-message">
            This location is on an existing water body, so no new structure is
            recommended here.
          </p>
          <div className="thin-line" />
          <p className="score-label">Water Body Area</p>
          <strong>{(body.area_m2 / 10000).toFixed(2)} ha</strong>
          <p>{Math.round(body.area_m2).toLocaleString("en-IN")} m²</p>
        </div>
      </div>

      <div className="alternatives">
        <h3>Water Body Details</h3>
        {rows.map(([label, value]) => (
          <div className="alt-row" key={label}>
            <span>{label}</span>
            <span>{value ?? "Not recorded"}</span>
          </div>
        ))}
      </div>

      <div className="info-note">
        <span>{ICONS.info}</span>
        {source}
      </div>
    </>
  );
}

function PanelTitle({ icon, title }) {
  return (
    <div className="panel-title">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}
function Field({ label, value, onChange, icon }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <div className="input-wrap">
        <input value={value} onChange={(e) => onChange(e.target.value)} />
        <span>{icon}</span>
      </div>
    </div>
  );
}
function Detail({ icon, label, value }) {
  return (
    <div className="detail">
      <span className="detail-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Stat({ icon, label, value, tone }) {
  return (
    <div className="stat">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

export default App;
