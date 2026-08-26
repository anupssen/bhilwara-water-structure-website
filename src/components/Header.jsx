import React from 'react';
import { NavLink } from 'react-router-dom';

const ICONS = {
  home: '🏠',
  info: 'ⓘ',
};

function Header() {
  return (
    <header className="topbar">
      <div className="brand">
        <div>
          <h1>Water Structure Recommendation System</h1>
          <p>Bhilwara District, Rajasthan</p>
        </div>
      </div>

      <nav>
        <NavLink to="/" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
          {ICONS.home}
          <span>Home</span>
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
          {ICONS.info}
          <span>About</span>
        </NavLink>
      </nav>
    </header>
  );
}

export default Header;