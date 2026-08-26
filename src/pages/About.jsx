import React from 'react';

const ICONS = {
  droplet: '◈',
  home: '🏠',
  info: 'ⓘ',
  pin: '⌖',
  globe: '◎',
  chart: '⌁',
  check: '✓',
};

function About() {
  return (
    <div className="app-shell">
      <main className="about-page">
        <section className="panel about-hero">
          <div className="panel-title">
            <span>{ICONS.globe}</span>
            <h2>About the Project</h2>
          </div>

          <h3 className="about-title">Smart planning for water conservation and groundwater recharge</h3>
          <p className="about-intro">
            This project is designed to support government departments, planners, and field officers in
            identifying the most suitable water harvesting and recharge structures for a given location.
            By using district, subdistrict, and area-level inputs along with geographic coordinates, the
            system helps in making informed decisions about structures such as check dams, farm ponds,
            percolation tanks, and nala bunds.
          </p>
        </section>

        <section className="about-grid">
          <div className="panel about-card">
            <div className="panel-title">
              <span>{ICONS.pin}</span>
              <h2>Our Mission</h2>
            </div>
            <p>
              To strengthen water security in rural and semi-urban regions by combining local geospatial
              data with practical engineering knowledge. The platform aims to reduce water loss, improve
              groundwater recharge, and promote sustainable land and water resource planning.
            </p>
          </div>

          <div className="panel about-card">
            <div className="panel-title">
              <span>{ICONS.chart}</span>
              <h2>How it Works</h2>
            </div>
            <ul className="feature-list">
              <li><span>{ICONS.check}</span>Select the district, subdistrict, and area</li>
              <li><span>{ICONS.check}</span>Use latitude and longitude or map-based location selection</li>
              <li><span>{ICONS.check}</span>Analyze terrain, runoff, soil, and drainage conditions</li>
              <li><span>{ICONS.check}</span>Recommend the best water structure with alternatives</li>
            </ul>
          </div>
        </section>

        <section className="panel about-section">
          <div className="panel-title">
            <span>{ICONS.droplet}</span>
            <h2>Why this system matters</h2>
          </div>

          <div className="impact-grid">
            <div className="impact-item">
              <strong>Water Security</strong>
              <p>Supports long-term groundwater recharge and efficient use of rainwater.</p>
            </div>
            <div className="impact-item">
              <strong>Evidence-Based Planning</strong>
              <p>Helps officials make decisions using structured data and GIS-informed analysis.</p>
            </div>
            <div className="impact-item">
              <strong>Rural Development</strong>
              <p>Improves resilience in agricultural and water-stressed areas through better structure planning.</p>
            </div>
            <div className="impact-item">
              <strong>Government Use</strong>
              <p>Suitable for decision support in public planning, watershed management, and infrastructure prioritization.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default About;