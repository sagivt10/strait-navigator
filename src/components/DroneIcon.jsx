export default function DroneIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', zIndex: 2 }}>
      {/* X-wing arms */}
      <line x1="4" y1="4" x2="20" y2="20" stroke="#4a4a4a" strokeWidth="1.8" />
      <line x1="20" y1="4" x2="4" y2="20" stroke="#4a4a4a" strokeWidth="1.8" />
      {/* Central body */}
      <rect x="9" y="9" width="6" height="6" rx="1" fill="#3a3a3a" stroke="#555" strokeWidth="0.6" />
      {/* Camera eye */}
      <circle cx="12" cy="12" r="1.5" fill="#ff3300" opacity="0.9" />
      {/* Rotors at 4 tips */}
      <circle cx="4" cy="4" r="2.5" fill="none" stroke="#666" strokeWidth="0.8" opacity="0.7" />
      <circle cx="20" cy="4" r="2.5" fill="none" stroke="#666" strokeWidth="0.8" opacity="0.7" />
      <circle cx="4" cy="20" r="2.5" fill="none" stroke="#666" strokeWidth="0.8" opacity="0.7" />
      <circle cx="20" cy="20" r="2.5" fill="none" stroke="#666" strokeWidth="0.8" opacity="0.7" />
      {/* Rotor hubs */}
      <circle cx="4" cy="4" r="0.8" fill="#555" />
      <circle cx="20" cy="4" r="0.8" fill="#555" />
      <circle cx="4" cy="20" r="0.8" fill="#555" />
      <circle cx="20" cy="20" r="0.8" fill="#555" />
    </svg>
  );
}
