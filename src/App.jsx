import React, { useMemo, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "./App.css";
import useSubdistricts from "./hooks/useSubdistricts";

// Fix Leaflet's default icon paths when bundlers don't copy asset images automatically
// (This uses require which works with most bundlers used in React apps)

try {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
    iconUrl: require("leaflet/dist/images/marker-icon.png"),
    shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
  });
} catch (e) {
  // ignore in environments that don't support require for images
}

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

function App() {
  const [district, setDistrict] = useState("Bhilwara");
  const [subdistrict, setSubdistrict] = useState("Shahpura");
  const [lat, setLat] = useState(String(DATA.Bhilwara.Shahpura.lat));
  const [lng, setLng] = useState(String(DATA.Bhilwara.Shahpura.lng));
  const [mapMode, setMapMode] = useState("Satellite");
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [area, setSelectedArea] = useState("");

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

  const result = DATA[district]?.[subdistrict] || DATA.Bhilwara.Shahpura;
  const [locating, setLocating] = useState(false);

  const handleAreaSelect = async (areaName) => {
    setSelectedArea(areaName);
    if (!areaName) return;

    // try to geocode area to lat/lng using Nominatim
    try {
      setLocating(true);
      showMessage("Locating area...", 3000);
      const q = encodeURIComponent(
        `${areaName}, ${subdistrict}, Bhilwara, Rajasthan, India`,
      );
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      const json = await resp.json();
      if (json && json.length > 0) {
        const { lat: glat, lon: glon } = json[0];
        setLat(Number(glat).toFixed(4));
        setLng(Number(glon).toFixed(4));
        showMessage("Area located on map.", 2200);
      } else {
        showMessage("Could not locate the selected area.", 3000);
      }
    } catch (e) {
      console.error("Geocode error", e);
      showMessage("Error locating area. Try again later.", 3000);
    } finally {
      setLocating(false);
    }
  };

  const districtData = useSubdistricts();

  const groupedData = Object.values(
    (districtData.records || []).reduce((acc, item) => {
      const subDistrict = item.sub_district_name;

      if (!acc[subDistrict]) {
        acc[subDistrict] = {
          sub_district_name: subDistrict,
          areas: [],
        };
      }

      acc[subDistrict].areas.push({
        area_name: item.area_name,
        mdds_plcn: item.mdds_plcn,
      });

      return acc;
    }, {}),
  );

  const loadSubdistrict = (name) => {
    setSubdistrict(name);
    const item = DATA[district][name];
    setLat(String(item.lat));
    setLng(String(item.lng));
    showMessage(`Loaded demo data for ${name}`, 1800);
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

  const scoreLabel =
    result.score >= 80
      ? "High Suitability"
      : result.score >= 65
        ? "Moderate Suitability"
        : "Low Suitability";
  

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
            onChange={(e) => {
              // when a subdistrict is selected, load its demo coordinates (if available)
              const name = e.target.value;
              setSelectedArea("");
              loadSubdistrict(name);
            }}
          >
            <option value="">Select Subdistrict</option>

            {groupedData.map((item) => (
              <option
                key={item.sub_district_name}
                value={item.sub_district_name}
              >
                {item.sub_district_name}
              </option>
            ))}
          </select>

          <h3>4. Area</h3>

          <label className="field-label">Select Area</label>

          <select
            value={area}
            disabled={!subdistrict || locating}
            onChange={(e) => handleAreaSelect(e.target.value)}
          >
            <option value="">Select Area</option>

            {groupedData
              .find((item) => item.sub_district_name === subdistrict)
              ?.areas.map((item) => (
                <option key={item.mdds_plcn} value={item.area_name}>
                  {item.area_name}
                </option>
              ))}
          </select>

          <div className="details-card">
            <h4>Selected Area Details</h4>
            <Detail icon="◉" label="District" value={district} />
            <Detail icon="⌖" label="Subdistrict" value={subdistrict} />
            <Detail
              icon="⌾"
              label="Coordinates"
              value={`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}
            />
          </div>
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

              <Marker
                key={`marker-${lat}-${lng}`}
                position={[Number(lat), Number(lng)]}
              >
                <Popup>
                  {area || subdistrict || "Selected location"}
                  <br />
                  {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                </Popup>
              </Marker>

              <Recenter lat={Number(lat)} lng={Number(lng)} />
            </MapContainer>

            <div className="map-credit">
              OpenStreetMap (Leaflet) — interactive map
            </div>
          </div>
          <div className="map-stats">
            <Stat
              icon="⌖"
              label="Area (Approx.)"
              value={`${result.area} km²`}
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
          <div className="recommend-card">
            <div className="recommend-icon">≋</div>
            <div>
              <p>Recommended Water Structure</p>
              <h2>{result.structure}</h2>
              <div className="thin-line" />
              <p className="score-label">Suitability Score</p>
              <strong>{result.score}%</strong>
              <div className="progress">
                <span style={{ width: `${result.score}%` }} />
              </div>
              <p className="high">{scoreLabel}</p>
            </div>
          </div>
          <h3 className="why-title">Why this structure?</h3>
          <ul className="reasons">
            {result.reasons.map((reason) => (
              <li key={reason}>
                <span>{ICONS.check}</span>
                {reason}
              </li>
            ))}
          </ul>
          <div className="alternatives">
            <h3>Other Suitable Options</h3>
            {result.alternatives.map(([name, score]) => (
              <div className="alt-row" key={name}>
                <span>{name}</span>
                <b className={score >= 70 ? "good" : "warn"}>{score}%</b>
              </div>
            ))}
          </div>
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
