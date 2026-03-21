// ============================================================
// SocialIcons.jsx
// ============================================================
// Offizielle SVG-Logos für Nostr, Telegram, X (Twitter), Email.
// Pfad: src/components/ui/SocialIcons.jsx
//
// Usage:
//   import { SocialIcon, identityIcon } from '../components/ui/SocialIcons';
//
//   <SocialIcon type="nostr" size={16} />
//   <SocialIcon type="telegram" size={20} />
//   <SocialIcon type="twitter" size={16} />
//   <SocialIcon type="email" size={16} />
//
//   // Oder als Drop-in Ersatz für die alte identityIcon Funktion:
//   {identityIcon(reg.identity_type, 14)}
// ============================================================
import React from 'react';

// ── Nostr (offizielles Logo, vereinfacht) ──
const NostrIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M199.5 95.4c-1.8-25.3-13.1-47.5-36.3-58.1-15.8-7.2-32.6-8.2-49.4-5.4-28 4.7-47.8 20.4-58.6 46.9-5.1 12.5-6.6 25.7-5.7 39.1 1.2 18.2 7 34.9 18.3 49.5 6.9 8.9 15.2 16.1 24.4 22.3 4.3 2.9 5.2 6.2 4.4 10.9-1.3 7.7-2.3 15.4-3.3 23.2-.4 3 .3 4.3 3.3 3.1 13.5-5.4 26.2-12.2 37.5-21.3 2.3-1.9 4.4-2.4 7.3-2.1 11.2 1.3 22.2.1 32.8-3.7 26.6-9.5 42.1-28.5 47.3-56.2 3.2-17.2 2.1-34.2-2-48.2zm-26.3 47.2c-2.4 6.5-7 11.1-12.8 14.6-5.8 3.5-12.2 5.4-18.8 6.5-10.6 1.7-21.2 1.3-31.7-.8-6.5-1.3-12.7-3.5-18.2-7.2-8.2-5.5-12.2-13.1-11.5-23.1.4-6 2.5-11.4 6.1-16.2 5.8-7.7 13.5-12.4 22.3-15.5 10.4-3.6 21.2-4.6 32.1-3.7 7.9.7 15.6 2.4 22.5 6.4 8.5 5 13.1 12.3 12.7 22.3-.2 5.7-1.1 11.2-2.7 16.7z" fill="#8B5CF6"/>
  </svg>
);

// ── Telegram (offizielles Logo) ──
const TelegramIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="120" cy="120" r="120" fill="#2AABEE"/>
    <path d="M98 175c-3.9 0-3.2-1.5-4.6-5.2L82 131.8l76-46.8" fill="#C8DAEA"/>
    <path d="M98 175c3 0 4.3-1.4 6-3l16-15.6-20-12" fill="#A9C9DD"/>
    <path d="M100 144.4l48.4 35.7c5.5 3 9.5 1.5 10.9-5.1l19.7-92.8c2-8.1-3.1-11.7-8.4-9.3l-116 44.7c-7.9 3.2-7.9 7.6-1.4 9.6l29.8 9.3 69-43.5c3.3-2 6.3-.9 3.8 1.3" fill="white"/>
  </svg>
);

// ── X / Twitter (offizielles X-Logo) ──
const XIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="white"/>
  </svg>
);

// ── Email (Briefumschlag) ──
const EmailIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="2" y="4" width="20" height="16" rx="3" stroke="#9CA3AF" strokeWidth="1.5" fill="none"/>
    <path d="M2 7l8.9 5.3c.7.4 1.5.4 2.2 0L22 7" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ── Haupt-Komponente: Rendert das richtige Icon basierend auf type ──
export const SocialIcon = ({ type, size = 16, className = '' }) => {
  switch (type) {
    case 'nostr':    return <NostrIcon size={size} className={className} />;
    case 'telegram': return <TelegramIcon size={size} className={className} />;
    case 'twitter':  return <XIcon size={size} className={className} />;
    case 'email':    return <EmailIcon size={size} className={className} />;
    default:         return <EmailIcon size={size} className={className} />;
  }
};

// ── Drop-in Ersatz für die alte identityIcon() Funktion ──
// Statt:  {identityIcon(reg.identity_type)}
// Neu:    {identityIcon(reg.identity_type, 14)}
export const identityIcon = (type, size = 14) => <SocialIcon type={type} size={size} />;

export default SocialIcon;
