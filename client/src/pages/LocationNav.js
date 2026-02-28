import React from 'react';

const LOCATIONS = [
  { id: 'village', name: '마을', icon: '🏠', desc: '안전한 마을. 상점과 여관이 있다.' },
  { id: 'dungeon', name: '던전', icon: '⚔️', desc: '위험한 던전. 몬스터를 처치하고 보상을 얻자.' },
];

function LocationNav({ currentLocation, onLocationChange, disabled }) {
  return (
    <nav className="location-nav">
      {LOCATIONS.map((loc) => (
        <button
          key={loc.id}
          className={`location-tab ${currentLocation === loc.id || (currentLocation !== 'village' && loc.id === 'dungeon') ? 'active' : ''}`}
          onClick={() => onLocationChange(loc.id)}
          disabled={disabled}
        >
          <span className="loc-icon">{loc.icon}</span>
          <span className="loc-name">{loc.name}</span>
        </button>
      ))}
    </nav>
  );
}

export { LOCATIONS };
export default LocationNav;
