import React, { useMemo, useState, useEffect } from "react";
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

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!isNaN(nLat) && !isNaN(nLng)) {
      map.setView([nLat, nLng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

function FitToGeoJSON({ geo, name }) {
  const map = useMap();
  useEffect(() => {
    if (!geo || !name) return;
    const feature = geo.features?.find((f) => f.properties.name === name);
    if (!feature) return;
    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }
  }, [geo, name, map]);
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

  // fetch the subdistrict boundary GeoJSON from the backend once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/subdistricts`);
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const data = await resp.json();
        if (!cancelled) setSubdistrictGeo(data);
      } catch (err) {
        console.error("Failed to load subdistrict boundaries", err);
      }
    })();
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
        }),
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data = await resp.json();
      setRecommendation(data);
      showMessage("Recommendation received from backend.", 2200);
    } catch (err) {
      console.error("Recommendation API error", err);
      const msg =
        "Could not reach the backend. Make sure it is running on http://localhost:8000.";
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
  
  // boundary highlighting: detected subdistrict (from the backend) wins,
  // otherwise the one selected in the dropdown
  const highlightName = recommendation?.subdistrict || subdistrict;

  const boundaryStyle = (feature) => {
    const active = feature.properties.name === highlightName;
    return {
      color: active ? "#ea580c" : "#1d4ed8",
      weight: active ? 4 : 1.5,
      fillColor: active ? "#f59e0b" : "#93c5fd",
      fillOpacity: active ? 0.4 : 0.1,
    };
  };

  const onEachBoundary = (feature, layer) => {
    layer.bindPopup(`<strong>${feature.properties.name}</strong>`);
    layer.on({ click: () => loadSubdistrict(feature.properties.name) });
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
                  key={highlightName || "all"}
                  data={subdistrictGeo}
                  style={boundaryStyle}
                  onEachFeature={onEachBoundary}
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
              <FitToGeoJSON geo={subdistrictGeo} name={highlightName} />
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
              suggested water structure.
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
