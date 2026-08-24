import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import useSubdistricts from './hooks/useSubdistricts';



const DATA = {
  Bhilwara: {
    Shahpura: {
      area: '1,285',
      lat: 25.3467,
      lng: 74.6333,
      score: 87,
      structure: 'Check Dam',
      reasons: ['Suitable slope and elevation', 'Good rainfall and runoff potential', 'Favorable soil and geological condition', 'Nearby water flow accumulation', 'High groundwater recharge potential'],
      alternatives: [['Farm Pond', 72], ['Percolation Tank', 64], ['Nala Bund', 58]]
    },
    Banera: { area: '735', lat: 25.8431, lng: 74.9482, score: 79, structure: 'Farm Pond', reasons: ['Moderate slope and suitable terrain', 'Good runoff potential', 'Suitable soil condition', 'Nearby drainage network'], alternatives: [['Check Dam', 75], ['Nala Bund', 67], ['Percolation Tank', 61]] },
    Asind: { area: '1,112', lat: 25.7356, lng: 74.3279, score: 83, structure: 'Nala Bund', reasons: ['Strong drainage-line connectivity', 'Suitable terrain and elevation', 'Good runoff concentration', 'Favorable recharge potential'], alternatives: [['Check Dam', 77], ['Farm Pond', 70], ['Percolation Tank', 63]] }
  }
};

const ICONS = {
  droplet: '◈', home: '🏠', info: 'ⓘ', pin: '⌖', globe: '◎', target: '⊙', chart: '⌁', check: '✓', map: '▧', maximize: '⛶', plus: '+', minus: '−', user: '♙'
};

function App() {
  const [district, setDistrict] = useState('Bhilwara');
  const [subdistrict, setSubdistrict] = useState('Shahpura');
  const [lat, setLat] = useState(String(DATA.Bhilwara.Shahpura.lat));
  const [lng, setLng] = useState(String(DATA.Bhilwara.Shahpura.lng));
  const [mapMode, setMapMode] = useState('Satellite');
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState('');
  const [area, setSelectedArea] = useState("");

  const result = DATA[district]?.[subdistrict] || DATA.Bhilwara.Shahpura;

  const districtData = useSubdistricts();
  console.log(districtData.records);

  const groupedData = Object.values(
    (districtData.records || []).reduce((acc, item) => {
      const subDistrict = item.sub_district_name;

      if (!acc[subDistrict]) {
        acc[subDistrict] = {
          sub_district_name: subDistrict,
          areas: []
        };
      }

      acc[subDistrict].areas.push({
        area_name: item.area_name,
        mdds_plcn: item.mdds_plcn
      });

      return acc;
    }, {})
  );

  const loadSubdistrict = (name) => {
    setSubdistrict(name);
    const item = DATA[district][name];
    setLat(String(item.lat));
    setLng(String(item.lng));
    setMessage(`Loaded demo data for ${name}`);
    setTimeout(() => setMessage(''), 1800);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLat(coords.latitude.toFixed(4));
        setLng(coords.longitude.toFixed(4));
        setMessage('Current browser location loaded.');
      },
      () => setMessage('Location permission was not available. Demo coordinates remain active.')
    );
  };

  const scoreLabel = result.score >= 80 ? 'High Suitability' : result.score >= 65 ? 'Moderate Suitability' : 'Low Suitability';
  const polygonPoints = useMemo(() => '12,25 23,20 35,27 47,18 58,24 70,18 83,29 91,42 84,51 90,63 77,67 71,81 58,73 48,88 37,77 24,82 20,68 8,61 13,48 5,37', []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">{ICONS.droplet}</div>
          <div><h1>Water Structure Recommendation System</h1><p>Bhilwara District, Rajasthan</p></div>
        </div>
        <nav><button className="nav-btn active">{ICONS.home}<span>Home</span></button><button className="nav-btn">{ICONS.info}<span>About</span></button></nav>
      </header>

      <main className="dashboard">
        <section className="panel selection-panel">
          <PanelTitle icon={ICONS.pin} title="Location & Area Selection" />
          <h3>1. Location (Latitude & Longitude)</h3>
          <Field label="Latitude" value={lat} onChange={setLat} icon={ICONS.pin} />
          <Field label="Longitude" value={lng} onChange={setLng} icon={ICONS.pin} />
          <button className="outline-green" onClick={useCurrentLocation}>{ICONS.target}<span>Use Current Location</span></button>
          <div className="divider" />
          <h3>2. District</h3>

          <label className="field-label">Select District</label>

          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="Bhilwara">Bhilwara</option>
          </select>

          <h3>3. Subdistrict (Tehsil)</h3>

          <label className="field-label">Select Subdistrict</label>

          <select
            value={subdistrict}
            onChange={(e) => {
              setSubdistrict(e.target.value);
              setSelectedArea("");
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
            disabled={!subdistrict}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            <option value="">Select Area</option>

            {groupedData
              .find(
                (item) =>
                  item.sub_district_name === subdistrict
              )
              ?.areas.map((item) => (
                <option
                  key={item.mdds_plcn}
                  value={item.area_name}
                >
                  {item.area_name}
                </option>
              ))}
          </select>

          <div className="details-card">
            <h4>Selected Area Details</h4>
            <Detail icon="◉" label="District" value={district} />
            <Detail icon="⌖" label="Subdistrict" value={subdistrict} />
            <Detail icon="⌾" label="Coordinates" value={`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`} />
          </div>
        </section>

        <section className={`panel map-panel ${fullscreen ? 'map-fullscreen' : ''}`}>
          <PanelTitle icon={ICONS.globe} title="Selected Area Boundary (Google Earth)" />
          <div className={`map ${mapMode.toLowerCase()}`}>
            <div className="map-toggle"><button className={mapMode === 'Map' ? 'selected' : ''} onClick={() => setMapMode('Map')}>Map</button><button className={mapMode === 'Satellite' ? 'selected' : ''} onClick={() => setMapMode('Satellite')}>Satellite</button></div>
            <button className="map-control fullscreen" onClick={() => setFullscreen(v => !v)}>{ICONS.maximize}</button>
            <div className="terrain-label label-a">Aravalli</div><div className="terrain-label label-b">Shahpura</div><div className="terrain-label label-c">Bhilwara</div>
            <svg className="boundary" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={polygonPoints} /></svg>
            <div className="location-ring"><div className="marker">{ICONS.pin}</div><div className="coord-bubble">{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</div></div>
            <div className="map-controls"><button>{ICONS.plus}</button><button>{ICONS.minus}</button></div><div className="peg">{ICONS.user}</div>
            <div className="map-credit">Demo map preview · Replace with Google Maps / Google Earth integration</div>
          </div>
          <div className="map-stats"><Stat icon="⌖" label="Area (Approx.)" value={`${result.area} km²`} tone="purple" /><Stat icon="▣" label="Location" value={`${subdistrict}, Bhilwara`} tone="green" /><Stat icon="⌾" label="Coordinates" value={`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`} tone="blue" /></div>
        </section>

        <section className="panel result-panel">
          <PanelTitle icon={ICONS.chart} title="Recommendation Result" />
          <div className="recommend-card"><div className="recommend-icon">≋</div><div><p>Recommended Water Structure</p><h2>{result.structure}</h2><div className="thin-line" /><p className="score-label">Suitability Score</p><strong>{result.score}%</strong><div className="progress"><span style={{ width: `${result.score}%` }} /></div><p className="high">{scoreLabel}</p></div></div>
          <h3 className="why-title">Why this structure?</h3><ul className="reasons">{result.reasons.map(reason => <li key={reason}><span>{ICONS.check}</span>{reason}</li>)}</ul>
          <div className="alternatives"><h3>Other Suitable Options</h3>{result.alternatives.map(([name, score]) => <div className="alt-row" key={name}><span>{name}</span><b className={score >= 70 ? 'good' : 'warn'}>{score}%</b></div>)}</div>
          <div className="info-note"><span>{ICONS.info}</span>Recommendation is based on GIS analysis, environmental factors, and suitability criteria.</div>
        </section>
      </main>
      <footer>© 2024 Water Structure Recommendation System | Bhilwara District, Rajasthan <span>Water Structure Recommendation System · Demo Frontend</span></footer>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

function PanelTitle({ icon, title }) { return <div className="panel-title"><span>{icon}</span><h2>{title}</h2></div>; }
function Field({ label, value, onChange, icon }) { return <div className="field-wrap"><label className="field-label">{label}</label><div className="input-wrap"><input value={value} onChange={e => onChange(e.target.value)} /><span>{icon}</span></div></div>; }
function Detail({ icon, label, value }) { return <div className="detail"><span className="detail-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>; }
function Stat({ icon, label, value, tone }) { return <div className="stat"><span className={`stat-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>; }


export default App;