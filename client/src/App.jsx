import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { io } from "socket.io-client";

// Auto-detect server URL — supports custom production URL via environment variables
const SERVER_URL = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

(() => {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(l);
})();

function createSocket() {
  return io(SERVER_URL, { transports: ["websocket", "polling"], forceNew: true });
}

// ── Image compression — resize to max 800px wide, 70% quality JPEG ────────────
// Keeps payload under ~80KB so socket.io handles it fine on localhost
function compressImage(dataURL, maxW = 800, quality = 0.7) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataURL); // fallback: keep original
    img.src = dataURL;
  });
}

// ── Audio ──────────────────────────────────────────────────────────────────────
let _ac = null;
function tone(f, d, t = "sine", v = 0.2) {
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = t; o.frequency.value = f;
    g.gain.setValueAtTime(v, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + d);
    o.start(); o.stop(_ac.currentTime + d);
  } catch (e) { }
}
const SFX = {
  join: () => { tone(520, .08); setTimeout(() => tone(680, .12), 80); },
  locked: () => { tone(600, .08); setTimeout(() => tone(820, .14), 90); },
  correct: () => { tone(523, .08); setTimeout(() => tone(659, .08), 90); setTimeout(() => tone(784, .2), 180); },
  wrong: () => { tone(180, .1, "sawtooth"); setTimeout(() => tone(140, .18, "sawtooth"), 110); },
  tick: () => tone(440, .05, "square", .12),
  start: () => { [0, 1, 2].forEach(i => setTimeout(() => tone(440 + i * 110, .1), i * 130)); },
};

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: "#f9f9fe",
  white: "#ffffff",
  navy: "#222831",
  muted: "#64748b",
  border: "#e4e4f0",
  grad: "linear-gradient(90deg, #7C5CFA, #FF4EC3)",
  gradD: "linear-gradient(135deg, #7C5CFA 0%, #FF4EC3 100%)",
  purple: "#7C5CFA",
  purpleD: "#5b3fd4",
  pink: "#FF4EC3",
  red: "#FF4D4D",
  blue: "#4D8AFF",
  yellow: "#FFB830",
  green: "#2EC97A",
};

const OPTS = [
  { color: C.red, bg: "#fff0f0", border: "#FFB3B3", shape: "▲", label: "A" },
  { color: C.blue, bg: "#f0f5ff", border: "#B3CBFF", shape: "◆", label: "B" },
  { color: C.yellow, bg: "#fffbf0", border: "#FFE0A0", shape: "●", label: "C" },
  { color: C.green, bg: "#f0fff8", border: "#A0EFD0", shape: "■", label: "D" },
];

const AVATARS = [
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7C5CFA"/><stop offset="100%" stopColor="#A78BFA"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG1)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#1E293B"/>
      <circle cx="50" cy="44" r="18" fill="#FDBA74"/>
      <path d="M32 38 C30 18, 52 8, 58 20 C64 10, 72 22, 68 38 C60 36, 50 33, 50 38 Z" fill="#EA580C"/>
      <rect x="36" y="40" width="28" height="6" rx="3" fill="#0F172A"/>
      <circle cx="41" cy="43" r="5.5" fill="#0F172A"/><circle cx="59" cy="43" r="5.5" fill="#0F172A"/>
      <line x1="41" y1="43" x2="44" y2="43" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
      <line x1="59" y1="43" x2="62" y2="43" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#F472B6"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG2)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#312E81"/>
      <circle cx="50" cy="44" r="18" fill="#FED7AA"/>
      <path d="M30 35 C28 20, 72 20, 70 35 C70 48, 62 46, 50 44 Z" fill="#8B5CF6"/>
      <path d="M28 42 C28 35, 72 35, 72 42" fill="none" stroke="#DB2777" strokeWidth="4.5" strokeLinecap="round"/>
      <rect x="25" y="39" width="7" height="12" rx="3.5" fill="#DB2777"/>
      <rect x="68" y="39" width="7" height="12" rx="3.5" fill="#DB2777"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#60A5FA"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG3)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#065F46"/>
      <circle cx="50" cy="45" r="18" fill="#FDBA74"/>
      <path d="M47 56 C44 56, 42 54, 42 52 C42 50, 48 48, 50 48 C52 48, 58 50, 58 52 C58 54, 56 56, 53 56 Z" fill="#9A3412" opacity="0.3"/>
      <path d="M30 36 C32 18, 68 18, 70 36 Z" fill="#475569"/>
      <rect x="28" y="33" width="44" height="6" rx="3" fill="#334155"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FBBF24"/><stop offset="100%" stopColor="#F59E0B"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG4)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#020617"/>
      <circle cx="50" cy="44" r="18" fill="#7C2D12"/>
      <circle cx="50" cy="38" r="23" fill="#1C1917"/>
      <circle cx="50" cy="44" r="18" fill="#7C2D12"/>
      <rect x="34" y="40" width="32" height="7" rx="3.5" fill="#10B981" opacity="0.8"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#34D399"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG5)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#991B1B"/>
      <circle cx="50" cy="44" r="18" fill="#F59E0B"/>
      <circle cx="31" cy="45" r="5.5" stroke="#FBBF24" strokeWidth="2.5" fill="none"/>
      <circle cx="69" cy="45" r="5.5" stroke="#FBBF24" strokeWidth="2.5" fill="none"/>
      <path d="M30 38 C32 20, 68 20, 70 38 Z" fill="#0F172A"/>
      <circle cx="50" cy="22" r="9" fill="#0F172A"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG6" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#06B6D4"/><stop offset="100%" stopColor="#22D3EE"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG6)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#3730A3"/>
      <circle cx="50" cy="45" r="18" fill="#FFD2A1"/>
      <path d="M30 38 C32 18, 58 10, 68 24 C72 32, 68 40, 66 42 C56 36, 44 38, 30 38 Z" fill="#FCD34D"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG7" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F97316"/><stop offset="100%" stopColor="#FB923C"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG7)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#1E3A8A"/>
      <circle cx="50" cy="44" r="18" fill="#D97706"/>
      <path d="M32 36 C34 32, 66 32, 68 36 L68 40 L32 40 Z" fill="#EF4444"/>
      <circle cx="34" cy="38" r="2.5" fill="#EF4444"/><circle cx="66" cy="38" r="2.5" fill="#EF4444"/>
      <path d="M32 32 C32 20, 68 20, 68 32 Z" fill="#3F2B18"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG8" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#818CF8"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG8)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#475569"/>
      <circle cx="50" cy="44" r="18" fill="#FED7AA"/>
      <path d="M30 38 C32 18, 68 18, 70 38 Z" fill="#E2E8F0"/>
      <path d="M32 30 C34 30, 36 34, 36 38" stroke="#E2E8F0" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M68 30 C66 30, 64 34, 64 38" stroke="#E2E8F0" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <rect x="34" y="41" width="32" height="5" rx="2.5" fill="#06B6D4" opacity="0.9"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG9" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#14B8A6"/><stop offset="100%" stopColor="#5EEAD4"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG9)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#3F3F46"/>
      <circle cx="50" cy="45" r="18" fill="#FDBA74"/>
      <path d="M32 36 C34 22, 66 22, 68 36 Z" fill="#DC2626"/>
      <path d="M45 22 L24 28" stroke="#DC2626" strokeWidth="4.5" strokeLinecap="round"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG10" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A855F7"/><stop offset="100%" stopColor="#C084FC"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG10)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#D97706"/>
      <circle cx="50" cy="44" r="18" fill="#FFD2A1"/>
      <path d="M28 36 C28 20, 72 20, 72 36 Z" fill="#78350F"/>
      <circle cx="40" cy="43" r="5.5" stroke="#1E293B" strokeWidth="2" fill="none"/>
      <circle cx="60" cy="43" r="5.5" stroke="#1E293B" strokeWidth="2" fill="none"/>
      <line x1="45.5" y1="43" x2="54.5" y2="43" stroke="#1E293B" strokeWidth="2"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG11" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F43F5E"/><stop offset="100%" stopColor="#FDA4AF"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG11)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#0F766E"/>
      <circle cx="50" cy="44" r="18" fill="#9A3412"/>
      <rect x="25" y="26" width="8" height="36" rx="4" fill="#451A03"/>
      <rect x="67" y="26" width="8" height="36" rx="4" fill="#451A03"/>
      <circle cx="34" cy="24" r="6" fill="#451A03"/>
      <circle cx="66" cy="24" r="6" fill="#451A03"/>
      <path d="M30 36 C32 20, 68 20, 70 36 Z" fill="#451A03"/>
    </svg>
  ),
  (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs><linearGradient id="avG12" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0F172A"/><stop offset="100%" stopColor="#334155"/></linearGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#avG12)"/>
      <path d="M20 92 C20 74, 35 68, 50 68 C65 68, 80 74, 80 92 Z" fill="#111827"/>
      <circle cx="50" cy="44" r="18" fill="#FEE2E2"/>
      <path d="M30 34 C30 20, 70 20, 70 34 Z" fill="#1E293B"/>
      <rect x="30" y="38" width="40" height="9" rx="4.5" fill="#3B82F6" stroke="#60A5FA" strokeWidth="1"/>
      <line x1="30" y1="42.5" x2="70" y2="42.5" stroke="#00D2FF" strokeWidth="1.5" strokeDasharray="3 2"/>
    </svg>
  ),
];



// Category SVG icons — clean minimal SVGs, no emojis
const CAT_ICONS = {
  Endless: (
    <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" rx="24" fill="#0b090f" />
      <path d="M16 38 c0 -4 3 -7 7 -7 h3 C31 31 35 28 37 25 C40 20 45 15 52 15 h18 c6 0 10 3 10 8 s-4 8 -10 8 H48 c-4 0 -7 3 -7 7 v1 c0 4 -3 7 -7 7 H23 c-4 0 -7 -3 -7 -7 z" fill="#ffffff" />
      <rect x="44" y="44" width="40" height="14" rx="7" fill="#ffffff" />
      <path d="M16 62 c0 4 3 7 7 7 h3 C31 69 35 72 37 75 C40 80 45 85 52 85 h18 c6 0 10 -3 10 -8 s-4 -8 -10 -8 H48 c-4 0 -7 -3 -7 -7 v-1 c0 -4 -3 -7 -7 -7 H23 c-4 0 -7 3 -7 7 z" fill="#ffffff" />
    </svg>
  ),
  Luffa: (
    <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="luffaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="50%" stopColor="#7C5CFA" />
          <stop offset="100%" stopColor="#FF4EC3" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#luffaGrad)" />
      <polygon points="50,15 32,32 68,32" fill="#ffffff" opacity="0.45" />
      <polygon points="32,32 15,48 32,58" fill="#ffffff" opacity="0.6" />
      <polygon points="68,32 85,48 68,58" fill="#ffffff" opacity="0.6" />
      <polygon points="32,32 68,32 50,55" fill="#ffffff" opacity="0.8" />
      <polygon points="15,48 15,68 32,58" fill="#ffffff" opacity="0.5" />
      <polygon points="85,48 85,68 68,58" fill="#ffffff" opacity="0.5" />
      <polygon points="32,58 50,55 68,58" fill="#ffffff" opacity="0.95" />
      <polygon points="32,58 68,58 50,82" fill="#ffffff" opacity="0.8" />
      <polygon points="15,68 50,82 32,58" fill="#ffffff" opacity="0.7" />
      <polygon points="85,68 50,82 68,58" fill="#ffffff" opacity="0.7" />
      <polygon points="15,68 50,82 50,92" fill="#ffffff" opacity="0.3" />
      <polygon points="85,68 50,82 50,92" fill="#ffffff" opacity="0.3" />
    </svg>
  ),
  General: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#7C5CFA" strokeWidth="1.5" fill="none" />
      <ellipse cx="9" cy="9" rx="3" ry="7" stroke="#7C5CFA" strokeWidth="1.5" fill="none" />
      <line x1="2" y1="9" x2="16" y2="9" stroke="#7C5CFA" strokeWidth="1.5" />
    </svg>
  ),
  Sports: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#2EC97A" strokeWidth="1.5" fill="none" />
      <path d="M4 5.5 C6 7 7 11 9 12 S13 12 14 9" stroke="#2EC97A" strokeWidth="1.5" fill="none" />
      <path d="M4 12.5 C6 11 9 10 11 8 S13 5 14 6" stroke="#2EC97A" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  Music: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M7 13V5l8-2v8" stroke="#FF4EC3" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="5" cy="13" r="2" stroke="#FF4EC3" strokeWidth="1.5" fill="none" />
      <circle cx="13" cy="11" r="2" stroke="#FF4EC3" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  Movies: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="#FFB830" strokeWidth="1.5" fill="none" />
      <path d="M7 7l5 2.5L7 12V7z" fill="#FFB830" />
    </svg>
  ),
  Tech: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="14" height="9" rx="2" stroke="#4D8AFF" strokeWidth="1.5" fill="none" />
      <line x1="5" y1="15" x2="13" y2="15" stroke="#4D8AFF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="12" x2="9" y2="15" stroke="#4D8AFF" strokeWidth="1.5" />
      <path d="M6 8l2-2 2 2 2-2" stroke="#4D8AFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  ),
  Geography: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2C6.24 2 4 5.13 4 9c0 3.5 2 6.5 5 7 3-0.5 5-3.5 5-7 0-3.87-2.24-7-5-7z" stroke="#2EC97A" strokeWidth="1.5" fill="none" />
      <line x1="4" y1="9" x2="14" y2="9" stroke="#2EC97A" strokeWidth="1.2" />
      <line x1="9" y1="2" x2="9" y2="16" stroke="#2EC97A" strokeWidth="1.2" />
    </svg>
  ),
  Art: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke="#FF4EC3" strokeWidth="1.5" fill="none" />
      <circle cx="6" cy="8" r="1.5" fill="#FF4EC3" />
      <circle cx="12" cy="8" r="1.5" fill="#7C5CFA" />
      <circle cx="9" cy="12" r="1.5" fill="#FFB830" />
    </svg>
  ),
  Food: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M5 2v5a4 4 0 0 0 8 0V2" stroke="#FFB830" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="9" y1="11" x2="9" y2="16" stroke="#FFB830" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Nature: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 15V8" stroke="#2EC97A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 8C9 8 4 7 3 3c0 0 4 0 6 5z" fill="#2EC97A" opacity="0.8" />
      <path d="M9 10C9 10 14 9 15 5c0 0-4 0-6 5z" fill="#2EC97A" />
    </svg>
  ),
  Custom: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M12 3l3 3-8 8H4v-3L12 3z" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <line x1="10" y1="5" x2="13" y2="8" stroke="#64748b" strokeWidth="1.5" />
    </svg>
  ),
};

const CATEGORIES = [
  { label: "Endless" },
  { label: "Luffa" },
  { label: "General" },
  { label: "Sports" },
  { label: "Music" },
  { label: "Movies" },
  { label: "Tech" },
  { label: "Geography" },
  { label: "Art" },
  { label: "Food" },
  { label: "Nature" },
  { label: "Custom" },
];

// ── SVG Icons (no emojis) ──────────────────────────────────────────────────────
const Icon = {
  Build: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="16" fill="url(#ig1)" />
      <defs><linearGradient id="ig1" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C5CFA" /><stop offset="1" stopColor="#A78BFA" />
      </linearGradient></defs>
      <rect x="14" y="14" width="24" height="24" rx="4" stroke="white" strokeWidth="2" fill="none" />
      <line x1="19" y1="20" x2="33" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="25" x2="29" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="30" x2="26" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Share: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="16" fill="url(#ig2)" />
      <defs><linearGradient id="ig2" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF4EC3" /><stop offset="1" stopColor="#7C5CFA" />
      </linearGradient></defs>
      <circle cx="36" cy="16" r="4" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="16" cy="26" r="4" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="36" cy="36" r="4" stroke="white" strokeWidth="2" fill="none" />
      <line x1="20" y1="24" x2="32" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="28" x2="32" y2="34" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Compete: () => (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect width="52" height="52" rx="16" fill="url(#ig3)" />
      <defs><linearGradient id="ig3" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFB830" /><stop offset="1" stopColor="#FF4EC3" />
      </linearGradient></defs>
      <path d="M26 14 L28.5 21.5 L36 21.5 L30 26.5 L32.5 34 L26 29.5 L19.5 34 L22 26.5 L16 21.5 L23.5 21.5 Z" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  Speed: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke={C.yellow} strokeWidth="2" fill={C.yellow + "18"} />
      <path d="M18 10 L18 18 L24 18" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="2" fill={C.yellow} />
    </svg>
  ),
  Lock: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="10" y="17" width="16" height="12" rx="3" stroke={C.red} strokeWidth="2" fill={C.red + "18"} />
      <path d="M13 17 V14 a5 5 0 0 1 10 0 V17" stroke={C.red} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="23" r="2" fill={C.red} />
    </svg>
  ),
  Chart: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="8" y="8" width="20" height="20" rx="3" stroke={C.purple} strokeWidth="2" fill={C.purple + "18"} />
      <line x1="12" y1="24" x2="12" y2="18" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="18" y1="24" x2="18" y2="14" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="24" y1="24" x2="24" y2="20" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  Trophy: () => (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <path d="M22 16 H50 V38 a14 14 0 0 1-28 0 Z" stroke={C.yellow} strokeWidth="2.5" fill={C.yellow + "22"} strokeLinejoin="round" />
      <path d="M22 22 H12 V30 a10 10 0 0 0 10 8" stroke={C.yellow} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M50 22 H60 V30 a10 10 0 0 1-10 8" stroke={C.yellow} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="36" y1="52" x2="36" y2="58" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="26" y1="58" x2="46" y2="58" stroke={C.yellow} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  QuizBg: () => (
    <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: .07 }}>
      <circle cx="60" cy="60" r="40" stroke="white" strokeWidth="3" />
      <circle cx="340" cy="240" r="55" stroke="white" strokeWidth="3" />
      <rect x="300" y="30" width="60" height="60" rx="12" stroke="white" strokeWidth="3" />
      <path d="M30 200 L60 170 L90 200 L120 160" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="200" cy="150" r="8" fill="white" />
      <circle cx="160" cy="80" r="5" fill="white" />
      <circle cx="240" cy="220" r="6" fill="white" />
    </svg>
  ),
};

// ── Global CSS ─────────────────────────────────────────────────────────────────
const gcss = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:${C.bg};font-family:'Fredoka',sans-serif;color:${C.navy};-webkit-font-smoothing:antialiased}
  input,textarea,select,button{font-family:'Fredoka',sans-serif}
  @keyframes fadeUp {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn  {from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}
  @keyframes slideL {from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes bounce {0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
  @keyframes pulse  {0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
  @keyframes float  {0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-18px) rotate(6deg)}}
  @keyframes glow   {0%,100%{box-shadow:0 0 12px #7C5CFA44}50%{box-shadow:0 0 28px #7C5CFA88}}
  @keyframes scoreUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes revealOpt{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
  @keyframes floatUp {0%{transform:translateY(0) rotate(0deg);opacity:0}10%{opacity:0.12}90%{opacity:0.12}100%{transform:translateY(-110vh) rotate(360deg);opacity:0}}
  @keyframes pulseGlow{0%,100%{transform:scale(1);opacity:0.25}50%{transform:scale(1.08);opacity:0.55}}
  @keyframes lockPulse{0%,100%{box-shadow:0 4px 16px rgba(124,92,250,.2);transform:scale(1)}50%{box-shadow:0 4px 22px rgba(124,92,250,.45);transform:scale(1.025)}}
  @keyframes cdRing{0%,100%{transform:scale(1);box-shadow:0 4px 14px rgba(124,92,250,.4)}50%{transform:scale(1.12);box-shadow:0 4px 22px rgba(124,92,250,.65)}}
  .fu {animation:fadeUp .42s cubic-bezier(.22,1,.36,1) both}
  .pop{animation:popIn  .32s cubic-bezier(.34,1.56,.64,1) both}
  .sl {animation:slideL .32s ease both}
  .btn-h:hover {transform:translateY(-2px) scale(1.03);filter:brightness(1.05)}
  .btn-h:active{transform:scale(.97)}
  .card-h:hover{transform:translateY(-3px);box-shadow:0 14px 40px rgba(124,92,250,.16)!important}
  .opt-b:hover {transform:scale(1.03);filter:brightness(1.05)}
  .opt-b:active{transform:scale(.97)}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-thumb{background:${C.purpleD}44;border-radius:4px}
  
  .navbar {
    background: rgba(255,255,255,.94);
    backdrop-filter: blur(12px);
    border-bottom: 1.5px solid ${C.border}55;
    padding: 0 28px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 200;
    box-shadow: 0 2px 16px rgba(124,92,250,.07);
    transition: all 0.22s ease;
  }
  .nav-btn-container {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .btn-text-short {
    display: none;
  }
  .btn-text-long {
    display: inline;
  }
  
  .pin-card {
    background: rgba(255,255,255,.18);
    backdrop-filter: blur(18px);
    border-radius: 24px;
    padding: 28px 32px;
    max-width: 460px;
    margin: 0 auto;
    border: 1.5px solid rgba(255,255,255,.3);
  }
  .pin-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }
  .pin-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: 15px 18px;
    border-radius: 14px;
    outline: none;
    border: 2px solid rgba(255,255,255,.38);
    background: rgba(255,255,255,.22);
    color: #fff;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: .35em;
    text-align: center;
    font-family: 'Fredoka', sans-serif;
    transition: border-color .2s;
  }
  .pin-input:focus {
    border-color: rgba(255,255,255,.7) !important;
  }
  .pin-btn {
    padding: 0 28px;
    border-radius: 14px;
    background: #fff;
    color: ${C.purple};
    border: none;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(0,0,0,.16);
    white-space: nowrap;
    transition: all .18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  @media(max-width:640px){
    .g2{grid-template-columns:1fr!important}
    .g3{grid-template-columns:1fr!important}
    .g4{grid-template-columns:1fr 1fr!important}
    .hcol{grid-template-columns:1fr!important}
    .hero-h{font-size:clamp(28px,8vw,44px)!important}
    .code-d{font-size:50px!important;letter-spacing:.22em!important}
    .hide-sm{display:none!important}
    .pin-card {
      padding: 20px 20px !important;
    }
    .pin-row {
      flex-direction: column !important;
    }
    .pin-btn {
      width: 100% !important;
      padding: 14px 28px !important;
    }
    .navbar {
      padding: 0 14px !important;
      height: 58px !important;
    }
    .navbar .logo-text {
      font-size: 24px !important;
    }
    .nav-btn-container {
      gap: 6px !important;
    }
    .navbar button {
      padding: 8px 12px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
    }
    .btn-text-long {
      display: none !important;
    }
    .btn-text-short {
      display: inline !important;
    }
  }

  .hero-flank-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
    margin-bottom: 20px;
    position: relative;
  }
  .hero-decor {
    flex-shrink: 0;
    transition: all 0.3s ease;
  }
  @media (max-width: 768px) {
    .hero-decor {
      display: none !important;
    }
    .hero-flank-container {
      gap: 0;
    }
  }

  @media (max-width: 600px) {
    .footer-sig {
      position: static !important;
      margin-top: 14px !important;
      justify-content: center !important;
    }
  }
`;
const GCss = () => <style>{gcss}</style>;

// ── Floating background shapes ─────────────────────────────────────────────────
function BgShapes() {
  const shapes = [
    { w: 220, h: 220, top: -60, left: -70, color: "rgba(255, 255, 255, 0.08)", delay: 0 },
    { w: 160, h: 160, top: 60, right: -50, color: "rgba(255, 255, 255, 0.05)", delay: 2.5 },
    { w: 100, h: 100, top: 220, left: "40%", color: "rgba(255, 255, 255, 0.04)", delay: 1.5 },
    { w: 180, h: 180, bottom: -50, right: 60, color: "rgba(255, 255, 255, 0.06)", delay: 1 },
    { w: 70, h: 70, top: 80, left: "65%", color: "rgba(255, 255, 255, 0.05)", delay: 3.5 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {shapes.map((s, i) => (
        <div key={i} style={{
          position: "absolute", width: s.w, height: s.h, borderRadius: "50%",
          background: s.color, top: s.top, left: s.left, right: s.right, bottom: s.bottom,
          animation: `float ${9 + i * 1.8}s ease-in-out ${s.delay}s infinite`,
          filter: "blur(6px)",
          border: "1.5px solid rgba(255, 255, 255, 0.09)",
          boxShadow: "inset 0 0 24px rgba(255, 255, 255, 0.06)"
        }} />
      ))}
    </div>
  );
}

function ThemeBg({ category }) {
  const particles = useMemo(() => {
    let emojis = ["⭐", "✨", "🌀", "🔮", "🪄", "💫"];
    if (category === "Sports") emojis = ["⚽", "🏀", "🏈", "⚾", "🎾", "🏆", "🥇"];
    else if (category === "Music") emojis = ["🎵", "🎶", "🎸", "🎹", "🎧", "🎤", "🎼"];
    else if (category === "Movies") emojis = ["🎬", "🍿", "🎥", "⭐", "🎟️", "📽️", "🍿"];
    else if (category === "Tech") emojis = ["💻", "⚙️", "🔌", "📡", "🔋", "⌨️", "🚀", "🖥️"];
    else if (category === "Geography") emojis = ["🌍", "🗺️", "🧭", "🏔️", "🌋", "🏝️", "⛵"];
    else if (category === "Art") emojis = ["🎨", "🖌️", "🖼️", "✏️", "🎭", "✒️", "🌈"];
    else if (category === "Food") emojis = ["🍕", "🍔", "🍟", "🍩", "🍪", "🍓", "🍉", "🍰"];
    else if (category === "Nature") emojis = ["🍃", "🍁", "🌸", "🦋", "🍄", "🍀", "🌻", "🌿"];

    return Array.from({ length: 12 }).map((_, i) => ({
      emoji: emojis[i % emojis.length],
      left: `${(i * 8) + Math.random() * 4}%`,
      delay: Math.random() * 10,
      duration: 12 + Math.random() * 8,
      size: 36 + Math.random() * 32,
    }));
  }, [category]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: -50,
          left: p.left,
          fontSize: p.size,
          opacity: 0.12,
          animation: `floatUp ${p.duration}s linear ${p.delay}s infinite`,
          filter: "blur(0.5px)",
        }}>
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

function Typewriter({ text, speed = 25, onComplete }) {
  const [displayed, setDisplayed] = useState("");
  const speakRef = useRef(null);
  
  // Use a stable ref for onComplete callback so changing references don't re-trigger typewriter
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setDisplayed("");

    // 1. Speak the question text using Web Speech API in parallel
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel(); // Cancel any active narration first to prevent overlap
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95; // Slightly slower, premium speed for clearer narration
        utterance.pitch = 1.0;
        speakRef.current = utterance;
        
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("Speech synthesis failed to start:", e);
      }
    }

    // 2. Smooth character-by-character time-based typing animation
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.substring(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        if (onCompleteRef.current) onCompleteRef.current();
      }
    }, speed);

    return () => {
      clearInterval(interval);
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    };
  }, [text, speed]); // Trigger ONLY when text or speed changes!

  return <span>{displayed}</span>;
}

// ── Atoms ──────────────────────────────────────────────────────────────────────
const Logo = ({ size = 28, onClick, style = {} }) => (
  <span className="logo-text" onClick={onClick} style={{
    fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: size,
    background: C.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    letterSpacing: ".02em", cursor: onClick ? "pointer" : "default", ...style
  }}>EndPlays Quiz</span>
);

function Card({ children, style = {}, cls = "", hover = false }) {
  return (
    <div className={`${cls}${hover ? " card-h" : ""}`} style={{
      background: C.white, borderRadius: 22, border: `1.5px solid ${C.border}`,
      boxShadow: "0 2px 18px rgba(124,92,250,.07)", padding: 24,
      transition: "all .22s ease", ...style
    }}>
      {children}
    </div>
  );
}

function GCard({ children, style = {}, cls = "" }) {
  return (
    <div className={cls} style={{
      background: C.gradD, borderRadius: 22, border: "none", padding: 28,
      boxShadow: "0 8px 32px rgba(124,92,250,.3)", position: "relative",
      overflow: "hidden", ...style
    }}>
      <Icon.QuizBg />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, v = "primary", disabled = false, style = {}, full = true, sz = "md", cls = "" }) {
  const pad = sz === "sm" ? "9px 18px" : sz === "lg" ? "16px 36px" : "12px 26px";
  const fs = sz === "sm" ? 14 : sz === "lg" ? 19 : 16;
  const base = {
    border: "none", borderRadius: 14, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, fontSize: fs, padding: pad, opacity: disabled ? .5 : 1,
    width: full ? "100%" : "auto", display: "inline-block", textAlign: "center",
    transition: "all .18s ease", letterSpacing: ".02em"
  };
  const vs = {
    primary: { background: C.grad, color: "#fff", boxShadow: disabled ? "none" : "0 4px 18px rgba(124,92,250,.38)" },
    outline: { background: "transparent", color: C.purple, border: `2px solid ${C.purple}` },
    ghost: { background: "transparent", color: C.muted, border: `1.5px solid ${C.border}` },
    white: { background: "#fff", color: C.purple, boxShadow: "0 4px 18px rgba(0,0,0,.12)" },
    danger: { background: "#fff0f0", color: "#e53e3e", border: `1.5px solid #fca5a5` },
  };
  return (
    <button className={`btn-h ${cls}`} onClick={disabled ? undefined : onClick}
      style={{ ...base, ...vs[v], ...style }}>
      {children}
    </button>
  );
}

function Inp({ ph, val, set, kd, type = "text", style = {}, ml, rows, autoFocus = false }) {
  const base = {
    width: "100%", padding: "12px 16px", borderRadius: 12, fontSize: 16, fontWeight: 500,
    border: `2px solid ${C.border}`, background: "#fafaff", color: C.navy, outline: "none",
    transition: "border-color .2s, box-shadow .2s", ...style
  };
  const ev = {
    onFocus: e => { e.target.style.borderColor = C.purple; e.target.style.boxShadow = `0 0 0 3px ${C.purple}18`; },
    onBlur: e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; },
  };
  if (rows) return <textarea placeholder={ph} value={val} rows={rows} autoFocus={autoFocus}
    onChange={e => set(e.target.value)} style={{ ...base, resize: "vertical" }} {...ev} />;
  return <input type={type} placeholder={ph} value={val} maxLength={ml} autoFocus={autoFocus}
    onChange={e => set(e.target.value)} onKeyDown={kd} style={base} {...ev} />;
}

function Lbl({ children, color = C.muted, mb = 7 }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: mb }}>{children}</div>;
}
function Pill({ children, color = C.purple }) {
  return <span style={{
    background: color + "18", color, border: `1.5px solid ${color}33`,
    borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 600
  }}>{children}</span>;
}
function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{
    background: "#fff0f0", border: "1.5px solid #fca5a5", borderRadius: 12,
    padding: "12px 16px", fontSize: 15, color: "#dc2626", fontWeight: 600
  }}>Warning: {msg}</div>;
}
function Av({ name, size = 40, avatarIndex }) {
  const hashIdx = name ? (name.charCodeAt(0) + name.length) % AVATARS.length : 0;
  const idx = typeof avatarIndex === 'number' ? avatarIndex : hashIdx;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: C.gradD, display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(124,92,250,.2)", overflow: "hidden"
    }}>
      {AVATARS[idx]}
    </div>
  );
}

// ── Gradient text ──────────────────────────────────────────────────────────────
const GT = ({ children, size, weight = 700, style = {} }) => (
  <span style={{
    fontWeight: weight, fontSize: size, background: C.grad,
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", ...style
  }}>
    {children}
  </span>
);

// ── Copy hook ──────────────────────────────────────────────────────────────────
function useCopy() {
  const [done, setDone] = useState(false);
  function copy(txt) {
    navigator.clipboard?.writeText(txt).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); });
  }
  return [done, copy];
}

// ── Image uploader ─────────────────────────────────────────────────────────────
function ImgUp({ value, onChange }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  function readFile(file) {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpe?g|gif|webp)$/i)) {
      alert("Please upload a PNG, JPG, GIF, or WEBP image."); return;
    }
    const r = new FileReader();
    r.onload = ev => onChange(ev.target.result);
    r.readAsDataURL(file);
  }
  return (
    <div>
      <Lbl>Question Image (optional)</Lbl>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}
        onClick={() => !value && ref.current.click()}
        style={{
          border: `2px dashed ${drag ? C.purple : value ? "#22c55e" : C.border}`,
          borderRadius: 14, padding: value ? "10px" : "26px 18px",
          textAlign: "center", cursor: value ? "default" : "pointer",
          background: drag ? "#f0eeff" : value ? "#f0fff8" : "#fafaff",
          transition: "all .2s", minHeight: 70,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12
        }}>
        {value
          ? <>
            <img src={value} alt="preview"
              style={{ maxHeight: 110, maxWidth: "100%", borderRadius: 10, objectFit: "contain" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Btn v="outline" sz="sm" full={false} onClick={e => { e.stopPropagation(); ref.current.click(); }}>Change</Btn>
              <Btn v="danger" sz="sm" full={false} onClick={e => { e.stopPropagation(); onChange(""); }}>Remove</Btn>
            </div>
          </>
          : <div>
            <div style={{ fontSize: 28, marginBottom: 6, color: C.purple }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ verticalAlign: "middle" }}>
                <rect x="2" y="6" width="24" height="18" rx="4" stroke={C.purple} strokeWidth="2" fill="none" />
                <circle cx="9" cy="12" r="2.5" stroke={C.purple} strokeWidth="1.5" fill="none" />
                <path d="M2 20 L8 14 L13 19 L18 15 L26 20" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.muted }}>Drag & drop or click to upload</div>
            <div style={{ fontSize: 12, color: C.border, marginTop: 4 }}>PNG, JPG, GIF, WEBP</div>
          </div>
        }
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        style={{ display: "none" }} onChange={e => readFile(e.target.files[0])} />
    </div>
  );
}

// ── Room theme image uploader — wider, landscape-oriented banner upload ────────
function ThemeImgUploader({ value, onChange }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  function readFile(file) {
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpe?g|gif|webp)$/i)) {
      alert("Please upload a PNG, JPG, GIF, or WEBP image."); return;
    }
    const r = new FileReader();
    r.onload = ev => onChange(ev.target.result);
    r.readAsDataURL(file);
  }
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}
      onClick={() => !value && ref.current.click()}
      style={{
        border: `2px dashed ${drag ? C.purple : value ? "#22c55e" : C.border}`,
        borderRadius: 14, overflow: "hidden", cursor: value ? "default" : "pointer",
        background: drag ? "#f0eeff" : value ? "#f0fff8" : "#fafaff",
        transition: "all .2s", height: 180,
        display: "flex", alignItems: value ? "stretch" : "center", justifyContent: "center", gap: 14
      }}>
      {value
        ? <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
          <img src={value} alt="theme"
            style={{ width: "100%", height: "100%", minHeight: "100%", display: "block", objectFit: "cover", flex: 1 }} />
          <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
            <button style={{
              padding: "5px 12px", borderRadius: 8, background: "rgba(255,255,255,.9)",
              border: `1.5px solid ${C.border}`, fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.purple
            }}
              onClick={e => { e.stopPropagation(); ref.current.click(); }}>Change</button>
            <button style={{
              padding: "5px 12px", borderRadius: 8, background: "rgba(255,255,255,.9)",
              border: `1.5px solid #fca5a5`, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#dc2626"
            }}
              onClick={e => { e.stopPropagation(); onChange(""); }}>Remove</button>
          </div>
        </div>
        : <div style={{ textAlign: "center", padding: "20px" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: "0 auto 8px", display: "block" }}>
            <rect x="2" y="7" width="28" height="20" rx="4" stroke={C.purple} strokeWidth="2" fill="none" />
            <circle cx="10" cy="14" r="3" stroke={C.purple} strokeWidth="1.5" fill="none" />
            <path d="M2 23 L10 16 L16 22 L22 17 L30 23" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.muted }}>Click or drag to upload a banner image</div>
          <div style={{ fontSize: 12, color: C.border, marginTop: 3 }}>PNG, JPG, GIF, WEBP — shown in the lobby</div>
        </div>
      }
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        style={{ display: "none" }} onChange={e => readFile(e.target.files[0])} />
    </div>
  );
}

// ── Question preview ───────────────────────────────────────────────────────────
function QPreview({ q }) {
  const isTextInput = q.qType === "typed" || q.qType === "fillinblank";
  const isReorder = q.qType === "reorder";
  const opts = [...(q.incorrectAnswers || []), q.correctAnswer || ""].filter(Boolean)
    .sort(() => Math.random() - .5).slice(0, 4);

  const reorderItems = (q.reorderItems || []).filter(Boolean);
  const hasReorderItems = reorderItems.length > 0;
  const itemsToRender = hasReorderItems ? reorderItems : ["Item 1", "Item 2", "Item 3", "Item 4"];

  return (
    <div style={{ background: "#fafaff", borderRadius: 14, padding: 16, border: `1.5px solid ${C.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Preview</div>
      {q.image && <img src={q.image} alt="" style={{ width: "100%", maxHeight: 90, objectFit: "contain", borderRadius: 8, marginBottom: 10 }} />}
      <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, marginBottom: 10, minHeight: 18 }}>
        {q.qType === "fillinblank" && q.text.includes("____") ? (
          q.text.split("____").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span style={{
                  color: q.correctAnswer ? "#16a34a" : C.purple,
                  borderBottom: `2.5px solid ${q.correctAnswer ? "#22c55e" : C.purple}`,
                  padding: "0 4px",
                  margin: "0 2px",
                  fontWeight: 700
                }}>
                  {q.correctAnswer || "____"}
                </span>
              )}
            </span>
          ))
        ) : (
          q.text || <span style={{ color: C.border }}>Your question appears here...</span>
        )}
      </div>
      {isTextInput ? (
        <div style={{
          background: C.white, border: `2px solid ${C.border}`, borderRadius: 10,
          padding: "10px 14px", fontSize: 13, color: q.correctAnswer ? C.navy : C.muted, fontStyle: q.correctAnswer ? "normal" : "italic",
          userSelect: "none"
        }}>
          {q.qType === "fillinblank" ? (
            q.correctAnswer ? (
              <span>Player fills: <strong style={{ color: "#16a34a", fontStyle: "normal" }}>{q.correctAnswer}</strong></span>
            ) : (
              "Player fills the gap here..."
            )
          ) : (
            q.correctAnswer ? (
              <span>Player types: <strong style={{ color: "#16a34a", fontStyle: "normal" }}>{q.correctAnswer}</strong></span>
            ) : (
              "Player types their answer here..."
            )
          )}
        </div>
      ) : isReorder ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {itemsToRender.map((item, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              border: `1.5px solid ${C.border}`, background: C.white,
              fontSize: 13, fontWeight: 600, userSelect: "none"
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: `${C.purple}18`, color: C.purple,
                fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {i + 1}
              </div>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: .35 }}>
                <circle cx="4" cy="3" r="1.2" fill={C.navy} /><circle cx="10" cy="3" r="1.2" fill={C.navy} />
                <circle cx="4" cy="7" r="1.2" fill={C.navy} /><circle cx="10" cy="7" r="1.2" fill={C.navy} />
                <circle cx="4" cy="11" r="1.2" fill={C.navy} /><circle cx="10" cy="11" r="1.2" fill={C.navy} />
              </svg>
              <span style={{ flex: 1, color: hasReorderItems ? C.navy : C.border, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {OPTS.map((m, i) => (
            <div key={i} style={{
              background: m.bg, border: `1.5px solid ${m.border}`,
              borderRadius: 7, padding: "6px 8px", fontSize: 12, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 5, minHeight: 28
            }}>
              <span style={{ color: m.color, fontSize: 11 }}>{m.shape}</span>
              <span style={{ color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {opts[i] || <span style={{ color: C.border, fontStyle: "italic" }}>Answer {i + 1}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Question type definitions — single source of truth ────────────────────────
const Q_TYPES = [
  { val: "mcq", label: "Multiple Choice", desc: "4 options, 1 correct" },
  { val: "typed", label: "Type Answer", desc: "Player types freely" },
  { val: "fillinblank", label: "Fill in the Gap", desc: "Sentence with ____" },
  { val: "reorder", label: "Reorder", desc: "Drag into correct order" },
];

// ── Question builder card ──────────────────────────────────────────────────────
function QCard({ q, idx, total, onChange, onRemove }) {
  const qType = q.qType || "mcq";

  function setItem(i, val) {
    const a = [...(q.reorderItems || ["", "", "", ""])];
    a[i] = val; onChange("reorderItems", a);
  }
  function addItem() {
    const a = [...(q.reorderItems || [])];
    if (a.length >= 6) return;
    onChange("reorderItems", [...a, ""]);
  }
  function removeItem(i) {
    const a = [...(q.reorderItems || [])];
    a.splice(i, 1); onChange("reorderItems", a);
  }

  return (
    <Card style={{ border: `1.5px solid ${C.purple}33`, padding: 0, overflow: "hidden" }} cls="fu">
      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(90deg,${C.purple}14,${C.pink}0d)`,
        padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1.5px solid ${C.border}`, flexWrap: "wrap", gap: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: C.gradD, color: "#fff",
            fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center"
          }}>{idx + 1}</div>
          <span style={{ fontWeight: 600, color: C.navy, fontSize: 16 }}>Question {idx + 1}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Type selector — dropdown for 4 types */}
          <select value={qType} onChange={e => onChange("qType", e.target.value)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${C.purple}66`,
              fontSize: 13, fontWeight: 600, background: C.white, color: C.purple, cursor: "pointer", outline: "none"
            }}>
            {Q_TYPES.map(t => (
              <option key={t.val} value={t.val}>{t.label}</option>
            ))}
          </select>
          <select value={q.timeLimit} onChange={e => onChange("timeLimit", Number(e.target.value))}
            style={{
              padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`,
              fontSize: 13, fontWeight: 600, background: C.white, color: C.navy, cursor: "pointer", outline: "none"
            }}>
            {[5, 7, 10, 15, 20, 30].map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
          {total > 1 && <Btn v="danger" sz="sm" full={false} onClick={onRemove}>Remove</Btn>}
        </div>
      </div>

      {/* ── Type hint strip ── */}
      <div style={{
        padding: "8px 20px", background: `${C.purple}06`,
        borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontWeight: 500
      }}>
        {Q_TYPES.find(t => t.val === qType)?.desc}
        {qType === "fillinblank" && <span style={{ color: C.purple, fontWeight: 600 }}> — use ____ (4 underscores) to mark the blank</span>}
        {qType === "reorder" && <span style={{ color: C.purple, fontWeight: 600 }}> — enter items in the CORRECT order (top = first)</span>}
      </div>

      {/* ── 2-col body ── */}
      <div className="hcol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        {/* Left — question fields */}
        <div style={{ padding: "20px", borderRight: `1.5px solid ${C.border}` }}>

          {/* Question text */}
          <div style={{ marginBottom: 14 }}>
            <Lbl>Question Text</Lbl>
            <Inp
              ph={qType === "fillinblank"
                ? "e.g. The capital of France is ____."
                : qType === "reorder"
                  ? "e.g. Put these steps in order:"
                  : "Type your question here..."}
              val={q.text} set={v => onChange("text", v)} rows={2} />
          </div>

          {/* ── MCQ: correct + 3 wrong ── */}
          {qType === "mcq" && (<>
            <div style={{ marginBottom: 12 }}>
              <Lbl color="#16a34a">Correct Answer</Lbl>
              <input value={q.correctAnswer} onChange={e => onChange("correctAnswer", e.target.value)}
                placeholder="The correct answer..."
                onFocus={e => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px #22c55e18"; }}
                onBlur={e => { e.target.style.borderColor = q.correctAnswer.trim() ? "#22c55e" : C.border; e.target.style.boxShadow = "none"; }}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10, outline: "none", fontSize: 15, fontWeight: 500,
                  border: `2px solid ${q.correctAnswer.trim() ? "#22c55e" : C.border}`,
                  background: q.correctAnswer.trim() ? "#f0fdf4" : "#fafaff", color: C.navy, transition: "all .2s"
                }} />
            </div>
            <div>
              <Lbl color={C.red}>Wrong Answers (3)</Lbl>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {q.incorrectAnswers.map((w, wi) => (
                  <input key={wi} value={w}
                    onChange={e => { const a = [...q.incorrectAnswers]; a[wi] = e.target.value; onChange("incorrectAnswers", a); }}
                    placeholder={`Wrong answer ${wi + 1}`}
                    onFocus={e => { e.target.style.borderColor = C.red; e.target.style.boxShadow = `0 0 0 3px ${C.red}15`; }}
                    onBlur={e => { e.target.style.borderColor = w.trim() ? C.red + "66" : C.border; e.target.style.boxShadow = "none"; }}
                    style={{
                      width: "100%", padding: "11px 14px", borderRadius: 10, outline: "none", fontSize: 14, fontWeight: 500,
                      border: `2px solid ${w.trim() ? C.red + "66" : C.border}`,
                      background: w.trim() ? "#fff5f5" : "#fafaff", color: C.navy, transition: "all .2s"
                    }} />
                ))}
              </div>
            </div>
          </>)}

          {/* ── Typed answer ── */}
          {qType === "typed" && (
            <div>
              <Lbl color="#16a34a">Expected Answer</Lbl>
              <input value={q.correctAnswer} onChange={e => onChange("correctAnswer", e.target.value)}
                placeholder="Players must type this..."
                onFocus={e => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px #22c55e18"; }}
                onBlur={e => { e.target.style.borderColor = q.correctAnswer.trim() ? "#22c55e" : C.border; e.target.style.boxShadow = "none"; }}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10, outline: "none", fontSize: 15, fontWeight: 500,
                  border: `2px solid ${q.correctAnswer.trim() ? "#22c55e" : C.border}`,
                  background: q.correctAnswer.trim() ? "#f0fdf4" : "#fafaff", color: C.navy, transition: "all .2s"
                }} />
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Case-insensitive match. Trims whitespace.</div>
            </div>
          )}

          {/* ── Fill in the blank ── */}
          {qType === "fillinblank" && (
            <div>
              <Lbl color="#16a34a">The Missing Word / Phrase</Lbl>
              <input value={q.correctAnswer} onChange={e => onChange("correctAnswer", e.target.value)}
                placeholder="The word that fills the blank..."
                onFocus={e => { e.target.style.borderColor = "#22c55e"; e.target.style.boxShadow = "0 0 0 3px #22c55e18"; }}
                onBlur={e => { e.target.style.borderColor = q.correctAnswer.trim() ? "#22c55e" : C.border; e.target.style.boxShadow = "none"; }}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10, outline: "none", fontSize: 15, fontWeight: 500,
                  border: `2px solid ${q.correctAnswer.trim() ? "#22c55e" : C.border}`,
                  background: q.correctAnswer.trim() ? "#f0fdf4" : "#fafaff", color: C.navy, transition: "all .2s"
                }} />
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Case-insensitive match. Trims whitespace.</div>
            </div>
          )}

          {/* ── Reorder ── */}
          {qType === "reorder" && (
            <div>
              <Lbl color="#16a34a">Items in Correct Order (top = first)</Lbl>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(q.reorderItems || ["", "", "", ""]).map((item, ri) => (
                  <div key={ri} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 7, background: `${C.purple}18`,
                      color: C.purple, fontSize: 12, fontWeight: 700, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      {ri + 1}
                    </div>
                    <input value={item} onChange={e => setItem(ri, e.target.value)}
                      placeholder={`Item ${ri + 1}...`}
                      style={{
                        flex: 1, padding: "9px 12px", borderRadius: 9, outline: "none", fontSize: 14, fontWeight: 500,
                        border: `2px solid ${item.trim() ? C.purple + "55" : C.border}`,
                        background: item.trim() ? `${C.purple}07` : "#fafaff", color: C.navy, transition: "all .2s"
                      }} />
                    {(q.reorderItems || []).length > 3 && (
                      <button onClick={() => removeItem(ri)}
                        style={{
                          padding: "6px 10px", borderRadius: 7, border: `1.5px solid #fca5a5`,
                          background: "#fff0f0", color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer"
                        }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              {(q.reorderItems || []).length < 6 && (
                <button onClick={addItem}
                  style={{
                    marginTop: 10, padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${C.purple}55`,
                    background: `${C.purple}0a`, color: C.purple, fontSize: 13, fontWeight: 600, cursor: "pointer"
                  }}>
                  + Add Item
                </button>
              )}
              <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
                Items are shuffled for the player. Correct = exact sequence above.
              </div>
            </div>
          )}
        </div>

        {/* Right — image + preview */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <ImgUp value={q.image} onChange={v => onChange("image", v)} />
          <QPreview q={q} />
        </div>
      </div>
    </Card>
  );
}

// ── ReorderPlayer — drag-and-drop list for players ────────────────────────────
function ReorderPlayer({ items, correctOrder, lockedAns, revealed, qResult, onSubmit }) {
  const [order, setOrder] = useState(() => [...(items || [])].sort(() => Math.random() - .5));
  const [dragging, setDragging] = useState(null);  // index being dragged
  const [dragOver, setDragOver] = useState(null);  // index being hovered over
  const locked = !!lockedAns || revealed;

  // Reset when items change (new question)
  useEffect(() => { setOrder([...(items || [])].sort(() => Math.random() - .5)); }, [items]);

  function onDragStart(i) { setDragging(i); }
  function onDragEnter(i) { if (i !== dragging) setDragOver(i); }
  function onDragEnd() {
    if (dragging !== null && dragOver !== null && dragging !== dragOver) {
      const next = [...order];
      const [moved] = next.splice(dragging, 1);
      next.splice(dragOver, 0, moved);
      setOrder(next);
    }
    setDragging(null); setDragOver(null);
  }

  // Touch support — track touch position
  const touchStart = useRef(null);
  function onTouchStart(e, i) {
    touchStart.current = { idx: i, y: e.touches[0].clientY };
    setDragging(i);
  }
  function onTouchMove(e) {
    if (dragging === null) return;
    const y = e.touches[0].clientY;
    const els = document.querySelectorAll(".reorder-item");
    let closest = null, closestDist = Infinity;
    els.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const d = Math.abs(y - mid);
      if (d < closestDist) { closestDist = d; closest = i; }
    });
    if (closest !== null && closest !== dragging) setDragOver(closest);
  }
  function onTouchEnd() {
    onDragEnd();
  }

  // Reveal coloring
  function itemStyle(item, i) {
    if (!revealed || !correctOrder) return {};
    const correctIdx = correctOrder.indexOf(item);
    const isRight = correctIdx === i;
    return isRight
      ? { background: "#d1fae5", border: "2px solid #22c55e", color: "#15803d" }
      : { background: "#fee2e2", border: "2px solid #ef4444", color: "#b91c1c" };
  }

  return (
    <div className="pop">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {order.map((item, i) => (
          <div key={item} className="reorder-item"
            draggable={!locked}
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragOver={e => e.preventDefault()}
            onDragEnd={onDragEnd}
            onTouchStart={e => onTouchStart(e, i)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px", borderRadius: 14,
              border: `2px solid ${dragOver === i && !locked ? C.purple : C.border}`,
              background: dragOver === i && !locked ? `${C.purple}0a` : C.white,
              cursor: locked ? "default" : dragging === i ? "grabbing" : "grab",
              opacity: dragging === i ? 0.5 : 1,
              transition: "all .15s",
              userSelect: "none",
              ...(revealed ? itemStyle(item, i) : {}),
            }}>
            {/* Position badge */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: revealed
                ? (correctOrder?.[i] === item ? "#22c55e" : "#ef4444")
                : `${C.purple}18`,
              color: revealed
                ? "#fff"
                : C.purple,
              fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {revealed
                ? (correctOrder?.[i] === item ? "✓" : "✗")
                : i + 1}
            </div>
            {/* Drag handle — only when not locked */}
            {!locked && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: .35 }}>
                <circle cx="4" cy="3" r="1.2" fill={C.navy} /><circle cx="10" cy="3" r="1.2" fill={C.navy} />
                <circle cx="4" cy="7" r="1.2" fill={C.navy} /><circle cx="10" cy="7" r="1.2" fill={C.navy} />
                <circle cx="4" cy="11" r="1.2" fill={C.navy} /><circle cx="10" cy="11" r="1.2" fill={C.navy} />
              </svg>
            )}
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      {!locked && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => setOrder([...(items || [])].sort(() => Math.random() - .5))}
            style={{
              flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${C.border}`,
              background: C.bg, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer"
            }}>
            Shuffle
          </button>
          <button onClick={() => onSubmit(order.join("|||"))}
            style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: C.grad, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 14px ${C.purple}44`
            }}>
            Lock In Order
          </button>
        </div>
      )}

      {/* Locked state message */}
      {lockedAns && !revealed && (
        <div style={{
          marginTop: 10, textAlign: "center", padding: "10px", borderRadius: 12,
          background: `${C.purple}08`, border: `1.5px solid ${C.purple}22`,
          fontSize: 14, color: C.purple, fontWeight: 600,
          animation: "lockPulse 1.6s ease-in-out infinite"
        }}>
          Order locked — waiting for timer...
        </div>
      )}

      {/* After reveal: show correct order */}
      {revealed && correctOrder && (
        <div style={{
          marginTop: 14, padding: "14px 16px", borderRadius: 14,
          background: "#f0fdf4", border: "2px solid #22c55e"
        }}>
          <div style={{
            fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 8,
            letterSpacing: ".08em", textTransform: "uppercase"
          }}>Correct Order</div>
          {correctOrder.map((item, i) => (
            <div key={item} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 0", borderBottom: i < correctOrder.length - 1 ? `1px solid #bbf7d0` : "none"
            }}>
              <span style={{ width: 20, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>{i + 1}.</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#15803d" }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Animated leaderboard row ───────────────────────────────────────────────────
// Reveals rank 1 first (idx=0), then 2, 3... each 120ms apart (ascending-to-descending)
function LbRow({ p, myName, idx, showScore = true }) {
  const isMe = p.name === myName;
  const medals = ["🥇", "🥈", "🥉"];
  const [visible, setVisible] = useState(false);
  const [scoreShown, setScoreShown] = useState(false);
  const [scoreVal, setScoreVal] = useState(0);

  useEffect(() => {
    // Row slides in staggered by rank (rank 1 = idx 0 = first in)
    const t1 = setTimeout(() => setVisible(true), idx * 150);
    // Score fades in 350ms after the row appears
    const t2 = setTimeout(() => setScoreShown(true), idx * 150 + 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [idx]);

  // Count score up from 0 once it becomes visible
  useEffect(() => {
    if (!scoreShown) return;
    const target = p.score; let cur = 0;
    const steps = Math.min(target, 24), interval = 30;
    const step = Math.ceil(target / steps);
    const iv = setInterval(() => {
      cur = Math.min(cur + step, target);
      setScoreVal(cur);
      if (cur >= target) clearInterval(iv);
    }, interval);
    return () => clearInterval(iv);
  }, [scoreShown, p.score]);

  const rankColor = p.rank === 1 ? C.yellow : p.rank === 2 ? "#94a3b8" : p.rank === 3 ? "#cd7c2f" : C.muted;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
      background: isMe ? `${C.purple}0e` : "#fafaff",
      borderRadius: 14,
      border: `2px solid ${isMe ? C.purple + "55" : p.rank === 1 ? C.yellow + "44" : C.border}`,
      boxShadow: isMe ? `0 0 0 3px ${C.purple}14,0 4px 14px ${C.purple}18`
        : p.rank === 1 ? `0 2px 12px ${C.yellow}28` : undefined,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(-22px)",
      transition: "opacity .35s ease, transform .35s ease",
    }}>
      <span style={{
        fontSize: p.rank <= 3 ? 26 : 15, width: 34, textAlign: "center",
        fontWeight: 700, color: rankColor
      }}>
        {p.rank <= 3 ? medals[p.rank - 1] : `#${p.rank}`}
      </span>
      <Av name={p.name} size={36} avatarIndex={p.avatarIndex} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: 16, color: isMe ? C.purple : C.navy }}>
        {p.name}{isMe ? " (you)" : ""}
      </span>
      {showScore && (
        <span style={{
          fontWeight: 700, fontSize: 22,
          color: p.rank === 1 ? C.yellow : C.navy,
          opacity: scoreShown ? 1 : 0,
          transform: scoreShown ? "translateY(0)" : "translateY(8px)",
          transition: "opacity .4s ease, transform .4s ease",
          display: "inline-block", minWidth: 60, textAlign: "right",
          fontVariantNumeric: "tabular-nums"
        }}>
          {scoreShown ? scoreVal.toLocaleString() : ""}
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("home");
  const [role, setRole] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [hostName, setHostName] = useState("");
  const [players, setPlayers] = useState([]);
  const [myName, setMyName] = useState("");
  const myNameRef = useRef("");

  const [questions, setQuestions] = useState([{ text: "", correctAnswer: "", incorrectAnswers: ["", "", ""], timeLimit: 10, image: "", qType: "mcq", reorderItems: ["", "", "", ""] }]);
  const [quizTitle, setQuizTitle] = useState("");
  const [category, setCategory] = useState("Endless");
  const [customCategory, setCustomCategory] = useState("");   // used when category === "Custom"
  const [themeImage, setThemeImage] = useState("");   // room-level banner image
  const [roomCategory, setRoomCategory] = useState("Endless");
  const [roomCustomCategory, setRoomCustomCategory] = useState("");

  const [gameState, setGameState] = useState("idle");
  const [currentQ, setCurrentQ] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  // FIXED: separate locked answer from revealed result
  const [lockedAns, setLockedAns] = useState(null);   // what player picked
  const [revealed, setRevealed] = useState(false);  // whether correct answer is shown
  const [qResult, setQResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLast, setIsLast] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [fbOk, setFbOk] = useState(null);
  const [ptsEarned, setPtsEarned] = useState(0);
  const [nextCdSecs, setNextCdSecs] = useState(null);  // countdown 5→1 on leaderboard
  const [errMsg, setErrMsg] = useState("");
  const [typedInput, setTypedInput] = useState("");    // player's typed answer for typed/fillinblank
  const [isTyping, setIsTyping] = useState(true);
  const [showDoublePointsAnim, setShowDoublePointsAnim] = useState(false);
  const [myAvatarIdx, setMyAvatarIdx] = useState(0);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  const selectAvatar = (idx) => {
    setMyAvatarIdx(idx);
    setShowAvatarSelector(false);
    if (socketRef.current) {
      socketRef.current.emit("update_avatar", { roomCode: roomCode || joinCode.toUpperCase().trim(), avatarIndex: idx });
    }
  };

  const socketRef = useRef(null);
  const [codeCopied, copyCode] = useCopy();
  const [linkCopied, copyLink] = useCopy();

  const showErr = m => { setErrMsg(m); setTimeout(() => setErrMsg(""), 3500); };
  useEffect(() => { myNameRef.current = myName; }, [myName]);

  // Auto-detect join code from path (/join/ABCDEF) or search query parameters (?room=ABCDEF or ?join=ABCDEF)
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/join\/([A-Za-z0-9]{4,6})/i);
    let code = match ? match[1] : "";

    if (!code) {
      const params = new URLSearchParams(window.location.search);
      code = params.get("room") || params.get("join") || "";
    }

    if (code) {
      setJoinCode(code.toUpperCase().trim());
      setScreen("join");
    }
  }, []);

  const setupSocket = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect();
    const s = createSocket();
    socketRef.current = s;

    s.on("room_created", async ({ roomCode }) => {
      setRoomCode(roomCode);
      setRoomCategory(category);
      setRoomCustomCategory(customCategory);
      setScreen("lobby-host");

      // Upload each image to the server now that we have the roomCode.
      // Server stores them and serves them via HTTP to ALL players.
      const imgs = s._pendingImages || [];
      for (let i = 0; i < imgs.length; i++) {
        if (!imgs[i]) continue; // no image for this question
        try {
          // Compress before uploading (max 800px, 70% quality → ~40-80KB)
          const compressed = await compressImage(imgs[i]);
          // Split "data:image/jpeg;base64,XXXX" into mimeType + raw base64
          const [header, data] = compressed.split(",");
          const mimeType = header.match(/:(.*?);/)[1];
          s.emit("upload_image", { roomCode, questionIndex: i, mimeType, data });
        } catch (e) {
          console.warn(`Failed to upload image for Q${i + 1}`, e);
        }
      }
      delete s._pendingImages;
    });
    s.on("join_success", ({ roomCode, playerName, category: joinedCat, customCategory: joinedCust, avatarIndex }) => {
      setRoomCode(roomCode); setMyName(playerName); myNameRef.current = playerName;
      setRoomCategory(joinedCat || "Endless");
      setRoomCustomCategory(joinedCust || "");
      if (typeof avatarIndex === 'number') {
        setMyAvatarIdx(avatarIndex);
      }
      setScreen("lobby-player"); SFX.join();
    });
    s.on("player_joined", ({ players, newPlayerName }) => {
      setPlayers(players);
      if (newPlayerName && newPlayerName !== myNameRef.current) {
        try {
          const utterance = new SpeechSynthesisUtterance(`${newPlayerName} has joined the room`);
          utterance.rate = 1.0;
          utterance.pitch = 1.05;
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn("Speech synthesis error:", e);
        }
      }
    });
    s.on("quiz_started", () => { setScreen("game"); setGameState("starting"); setMyScore(0); SFX.start(); });

    s.on("new_question", q => {
      // Server sends a relative path like "/img/ABC123/0"
      // We prepend SERVER_URL so it works on localhost AND local network IPs.
      const fullImageUrl = q.imageUrl ? `${SERVER_URL}${q.imageUrl}` : "";
      setCurrentQ({ ...q, image: fullImageUrl });
      setTimeLeft(q.timeLimit);
      setTotalTime(q.timeLimit);
      setLockedAns(null);
      setRevealed(false);
      setQResult(null);
      setFeedback("");
      setFbOk(null);
      setPtsEarned(0);
      setTypedInput("");
      setNextCdSecs(null);

      // Typewriter and Double Points overlay triggers
      setIsTyping(true);
      const isLastQ = (q.questionIndex === q.totalQuestions - 1) && (q.totalQuestions > 1);
      if (isLastQ) {
        setShowDoublePointsAnim(true);
        setTimeout(() => {
          setShowDoublePointsAnim(false);
        }, 2500);
      } else {
        setShowDoublePointsAnim(false);
      }

      setGameState("question");
    });

    s.on("timer_update", ({ timeRemaining }) => {
      setTimeLeft(timeRemaining);
      if (timeRemaining <= 3 && timeRemaining > 0) SFX.tick();
    });

    s.on("answer_locked", ({ answer }) => {
      setLockedAns(answer);
      setFeedback("");   // no text — pulsing button is the only feedback
      setFbOk(null);
      SFX.locked();
    });

    // FIXED: question_result is when reveal happens (timer ended on server)
    s.on("question_result", result => {
      setQResult(result);
      setRevealed(true);   // NOW show correct/wrong colors
      setGameState("result");
      const me = Object.values(result.results).find(r => r.name === myNameRef.current);
      if (me) {
        const pts = me.pointsEarned || 0;
        setPtsEarned(pts);
        setMyScore(s => s + pts);
        if (me.correct) {
          SFX.correct();
          setFbOk(true);
          setFeedback(pts >= 900 ? "Perfect timing!" : pts >= 600 ? "Super fast!" : "Correct!");
        } else {
          SFX.wrong();
          setFbOk(false);
          setFeedback(me.answer ? "Wrong answer!" : "Too slow!");
        }
      } else {
        setFeedback("Time is up!");
        setFbOk(false);
      }
    });

    s.on("leaderboard_update", ({ leaderboard, isLast }) => {
      setLeaderboard(leaderboard); setIsLast(isLast);
      // Start at 5 right away — server will tick it down each second
      setNextCdSecs(isLast ? null : 5);
      setGameState("leaderboard");
    });
    s.on("next_question_countdown", ({ countdown }) => {
      setNextCdSecs(countdown);
      SFX.tick();
    });
    s.on("quiz_finished", ({ leaderboard }) => { setLeaderboard(leaderboard); setScreen("finished"); });
    s.on("error", ({ message }) => showErr(message));
    s.on("connect_error", () => showErr("Cannot connect to server. Is it running on port 3001?"));
    return s;
  }, [category, customCategory]);

  function validateQs() {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { showErr(`Q${i + 1}: Question text is empty`); return false; }
      if (q.qType === "reorder") {
        const filled = (q.reorderItems || []).filter(x => x.trim());
        if (filled.length < 3) { showErr(`Q${i + 1}: Add at least 3 items to reorder`); return false; }
      } else {
        if (!q.correctAnswer.trim()) { showErr(`Q${i + 1}: Correct answer is empty`); return false; }
        if (q.qType === "mcq" && q.incorrectAnswers.some(w => !w.trim())) {
          showErr(`Q${i + 1}: Fill all 3 wrong answers`); return false;
        }
        if (q.qType === "fillinblank" && !q.text.includes("____")) {
          showErr(`Q${i + 1}: Fill-in-the-gap text must contain ____ (4 underscores)`); return false;
        }
      }
    }
    return true;
  }
  function updQ(i, f, v) { setQuestions(qs => qs.map((q, ix) => ix === i ? { ...q, [f]: v } : q)); }
  function addQ() { setQuestions(qs => [...qs, { text: "", correctAnswer: "", incorrectAnswers: ["", "", ""], timeLimit: 10, image: "", qType: "mcq", reorderItems: ["", "", "", ""] }]); }

  async function doCreate() {
    if (!hostName.trim()) { showErr("Enter your name"); return; }
    if (!validateQs()) return;
    const s = setupSocket(); setRole("host");

    // Send questions WITHOUT images — images are uploaded separately via upload_image
    // after we get the roomCode back. This prevents the quiz from failing to start.
    const qs = questions.map((q, i) => ({
      text: q.text.trim(),
      correctAnswer: q.correctAnswer?.trim() || "",
      incorrectAnswers: q.incorrectAnswers.map(w => w.trim()),
      timeLimit: q.timeLimit,
      hasImage: !!q.image,
      qType: q.qType || "mcq",
      // reorder: only send non-empty items, preserving correct order
      reorderItems: (q.reorderItems || []).map(x => x.trim()).filter(Boolean),
    }));

    // Store the raw images locally so we can upload them once we get the roomCode
    const rawImages = questions.map(q => q.image || "");

    // Attach images to socket so the room_created handler can send them
    s._pendingImages = rawImages;

    s.emit("create_room", { hostName: hostName.trim(), questions: qs, category, customCategory });
  }
  function doJoin() {
    if (!playerName.trim()) { showErr("Enter your name"); return; }
    if (joinCode.trim().length < 4) { showErr("Enter the room code"); return; }
    const s = setupSocket(); setRole("player");
    setMyName(playerName.trim()); myNameRef.current = playerName.trim();
    const autoIdx = playerName.trim() ? (playerName.trim().charCodeAt(0) + playerName.trim().length) % AVATARS.length : 0;
    setMyAvatarIdx(autoIdx);
    s.emit("join_room", { roomCode: joinCode.toUpperCase().trim(), playerName: playerName.trim(), avatarIndex: autoIdx });
  }
  function doAnswer(ans) {
    if (lockedAns || revealed) return;
    socketRef.current?.emit("submit_answer", { roomCode, answer: ans });
  }
  function doPlayAgain() {
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = null;
    setScreen("home"); setGameState("idle"); setRoomCode(""); setPlayers([]);
    setLeaderboard([]); setMyScore(0); setCurrentQ(null); setLockedAns(null);
    setRevealed(false); setQResult(null); setFeedback("");
    setQuestions([{ text: "", correctAnswer: "", incorrectAnswers: ["", "", ""], timeLimit: 10, image: "", qType: "mcq", reorderItems: ["", "", ""] }]);
    setQuizTitle(""); setCustomCategory(""); setThemeImage("");
    setRoomCategory("Endless"); setRoomCustomCategory("");
    setJoinCode("");
  }

  const clientOrigin = process.env.REACT_APP_CLIENT_URL || window.location.origin;
  const shareLink = `${clientOrigin}/join/${roomCode}`;

  function handleLogoClick() {
    const activeSession = ["lobby-host", "lobby-player", "game"].includes(screen);
    if (activeSession) {
      const msg = role === "host"
        ? "You are hosting the quiz. If you leave, the room will be closed. Are you sure you want to leave?"
        : "Are you sure you want to leave the current quiz room?";
      if (!window.confirm(msg)) return;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setScreen("home"); setGameState("idle"); setRoomCode(""); setPlayers([]);
    setLeaderboard([]); setMyScore(0); setCurrentQ(null); setLockedAns(null);
    setRevealed(false); setQResult(null); setFeedback("");
    setQuestions([{ text: "", correctAnswer: "", incorrectAnswers: ["", "", ""], timeLimit: 10, image: "", qType: "mcq", reorderItems: ["", "", ""] }]);
    setQuizTitle(""); setCustomCategory(""); setThemeImage("");
    setRoomCategory("Endless"); setRoomCustomCategory("");
    setJoinCode("");
  }

  const Nav = ({ right }) => (
    <nav className="navbar">
      <Logo size={30} onClick={handleLogoClick} />{right}
    </nav>
  );

  const Footer = () => {
    const links = [
      { name: "X", url: "https://x.com/EndlessProtocol" },
      { name: "Discord", url: "https://discord.gg/endlessprotocol" },
      { name: "GitHub", url: "https://github.com/endless-labs" }
    ];
    return (
      <footer style={{
        background: C.navy, color: "rgba(255,255,255,.5)",
        padding: "24px 28px", textAlign: "center", fontSize: 14, fontWeight: 400,
        position: "relative"
      }}>
        <div style={{ marginBottom: 8 }}>
          Built on <span style={{
            background: C.grad, WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent", fontWeight: 700
          }}>EndPlays Quiz</span>
          {" "}— Real-time multiplayer quizzes
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 13 }}>
          {links.map(l => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,.4)", textDecoration: "none", transition: "color .2s" }}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,.4)"}>{l.name}</a>
          ))}
        </div>

        {/* Made by signature */}
        <div style={{
          position: "absolute", bottom: 20, right: 28,
          display: "flex", alignItems: "center", gap: 8, fontSize: 14
        }} className="footer-sig">
          <span style={{
            background: C.grad, WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent", fontWeight: 700
          }}>Made by</span>
          <a href="https://x.com/RajGupta0510" target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", textDecoration: "none", outline: "none"
          }}>
            <img src="/raj_avatar.jpg" alt="Raj Gupta" style={{
              width: 22, height: 22, borderRadius: "50%",
              border: "1.5px solid rgba(255,255,255,0.8)",
              boxShadow: "0 0 8px rgba(255,255,255,0.25), 0 0 15px rgba(124,92,250,0.3)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "pointer"
            }}
            onMouseEnter={e => {
              e.target.style.transform = "scale(1.15)";
              e.target.style.boxShadow = "0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,78,195,0.5)";
            }}
            onMouseLeave={e => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 0 8px rgba(255,255,255,0.25), 0 0 15px rgba(124,92,250,0.3)";
            }} />
          </a>
        </div>
      </footer>
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "home") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", position: "relative" }}>
      <GCss />
      <ThemeBg category="Endless" />
      <Nav right={
        <div className="nav-btn-container">
          <Btn v="outline" full={false} sz="sm" onClick={() => setScreen("join")}>
            <span className="btn-text-long">Join Game</span>
            <span className="btn-text-short">Join</span>
          </Btn>
          <Btn v="primary" full={false} sz="sm" onClick={() => setScreen("host-setup")}>
            <span className="btn-text-long">Host a Quiz</span>
            <span className="btn-text-short">Host</span>
          </Btn>
        </div>
      } />

      {/* HERO */}
      <div style={{
        position: "relative", background: C.gradD, padding: "72px 24px 90px",
        textAlign: "center", overflow: "hidden"
      }}>
        <BgShapes />
        {/* Floating backdrop particles from ThemeBg will drift over the entire page */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto" }}>
          <div className="hero-flank-container fu">
            <div className="hero-h" style={{
              fontWeight: 700, fontSize: 54, color: "#fff",
              lineHeight: 1.08, letterSpacing: ".01em"
            }}>
              Play fun quizzes<br />with friends
            </div>
          </div>
          <div className="fu" style={{
            fontSize: 17, color: "rgba(255,255,255,.86)", fontWeight: 400,
            lineHeight: 1.72, marginBottom: 44, animationDelay: ".08s"
          }}>
            Host your own quiz in minutes. No signup required.<br />
            Speed and accuracy wins the leaderboard.
          </div>

          {/* PIN entry — FIXED: join button inside container, properly aligned */}
          <div className="fu pop pin-card" style={{ animationDelay: ".16s" }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.72)",
              letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 14
            }}>
              Enter Room Code
            </div>
            <div className="pin-row">
              <input className="pin-input" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && setScreen("join")}
                placeholder="XXXXXX" maxLength={6}
              />
              <button className="btn-h pin-btn"
                onClick={() => { if (joinCode.trim().length >= 4) { setScreen("join"); } }}>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS — SVG icons, no emojis */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "60px 24px 12px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <GT size={34} style={{ display: "block" }}>How it works</GT>
          <div style={{ color: C.muted, fontWeight: 400, fontSize: 16, marginTop: 6 }}>
            Get a game going in under 2 minutes
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="g3">
          {[
            { Icon: Icon.Build, title: "Build your quiz", desc: "Add questions, images, 4 answers and a custom timer for each question." },
            { Icon: Icon.Share, title: "Share the code", desc: "Players join on phone or laptop — no app, no account needed." },
            { Icon: Icon.Compete, title: "Compete and win", desc: "Answer faster for more points. Live leaderboard after every question." },
          ].map((f, i) => (
            <Card key={i} style={{ textAlign: "center", padding: "32px 20px" }} cls="fu" hover>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><f.Icon /></div>
              <GT size={20} style={{ display: "block", marginBottom: 10 }}>{f.title}</GT>
              <div style={{ fontSize: 14, color: C.muted, fontWeight: 400, lineHeight: 1.7 }}>{f.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* FEATURES STRIP */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }} className="g3">
          {[
            { Icon: Icon.Speed, label: "Speed scoring", desc: "Faster = more points", col: C.yellow },
            { Icon: Icon.Lock, label: "One answer only", desc: "No switching, no cheating", col: C.red },
            { Icon: Icon.Chart, label: "Live leaderboard", desc: "Rankings after every round", col: C.purple },
          ].map(f => (
            <div key={f.label} style={{
              background: f.col + "14", border: `2px solid ${f.col}28`,
              borderRadius: 18, padding: "20px 18px", display: "flex", alignItems: "center", gap: 14
            }}>
              <div style={{ flexShrink: 0 }}><f.Icon /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: f.col }}>{f.label}</div>
                <div style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — centered button with glow animation */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "12px 24px 64px", width: "100%" }}>
        <GCard style={{ textAlign: "center", padding: "52px 32px" }}>
          <div style={{ fontWeight: 700, fontSize: 32, color: "#fff", marginBottom: 12, letterSpacing: ".01em" }}>
            Ready to host your own quiz?
          </div>
          <div style={{ color: "rgba(255,255,255,.8)", fontWeight: 400, fontSize: 16, marginBottom: 32 }}>
            Build it in minutes. Play with anyone, anywhere.
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn-h"
              onClick={() => setScreen("host-setup")}
              style={{
                padding: "16px 48px", borderRadius: 16, background: "#fff", color: C.purple,
                border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 24px rgba(0,0,0,.18)",
                transition: "all .2s ease", animation: "glow 2.5s ease-in-out infinite",
                display: "inline-block"
              }}>
              Create a Quiz
            </button>
          </div>
        </GCard>
      </div>
      <Footer />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // JOIN
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "join") return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, position: "relative"
    }}>
      <GCss /><ThemeBg category="Endless" />
      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }} className="pop">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Logo size={40} />
          <div style={{ color: C.muted, fontSize: 16, fontWeight: 400, marginTop: 8 }}>
            Enter your details to join
          </div>
        </div>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ErrBox msg={errMsg} />
          <div><Lbl>Your Name</Lbl>
            <Inp ph="What's your name?" val={playerName} set={setPlayerName} kd={e => e.key === "Enter" && doJoin()} autoFocus /></div>
          <div><Lbl>Room Code</Lbl>
            <Inp ph="e.g. AB12CD" val={joinCode} set={v => setJoinCode(v.toUpperCase())}
              kd={e => e.key === "Enter" && doJoin()} ml={6}
              style={{ textTransform: "uppercase", letterSpacing: ".3em", textAlign: "center", fontSize: 28, fontWeight: 700 }} /></div>
          <Btn sz="lg" onClick={doJoin}>Join Game</Btn>
          <Btn v="ghost" onClick={() => setScreen("home")}>Back to Home</Btn>
        </Card>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HOST SETUP
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "host-setup") return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <GCss />
      <Nav right={<Btn v="ghost" full={false} sz="sm" onClick={() => setScreen("home")}>Back</Btn>} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 26 }}>
          <GT size={36} style={{ display: "block" }}>Create Your Quiz</GT>
          <div style={{ color: C.muted, fontWeight: 400, fontSize: 16, marginTop: 4 }}>
            Add questions, upload images, set timers — then launch!
          </div>
        </div>
        <ErrBox msg={errMsg} />
        <Card style={{ marginTop: errMsg ? 16 : 0, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="g2">
            <div><Lbl>Your Name (Host)</Lbl>
              <Inp ph="Enter your name..." val={hostName} set={setHostName} /></div>
            <div><Lbl>Quiz Title</Lbl>
              <Inp ph="e.g. Science Challenge..." val={quizTitle} set={setQuizTitle} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }} className="g2">
            <div>
              <Lbl>Category</Lbl>
              {/* Icon-based category picker */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {CATEGORIES.map(c => {
                  const active = category === c.label;
                  return (
                    <button key={c.label} onClick={() => setCategory(c.label)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        padding: "8px 4px", borderRadius: 10, border: `2px solid ${active ? C.purple : C.border}`,
                        background: active ? `${C.purple}10` : "#fafaff", cursor: "pointer",
                        transition: "all .15s", outline: "none"
                      }}>
                      <span style={{ lineHeight: 1 }}>{CAT_ICONS[c.label]}</span>
                      <span style={{
                        fontSize: 10, fontWeight: active ? 700 : 500,
                        color: active ? C.purple : C.muted, letterSpacing: ".02em"
                      }}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Custom category text input — only visible when Custom is selected */}
              {category === "Custom" && (
                <div style={{ marginTop: 10 }}>
                  <Inp ph="Enter your custom category name..."
                    val={customCategory} set={setCustomCategory} />
                </div>
              )}
            </div>

            <div>
              <Lbl>Room Theme Image (optional — banner in lobby)</Lbl>
              <ThemeImgUploader value={themeImage} onChange={setThemeImage} />
            </div>
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {questions.map((q, i) => (
            <QCard key={i} q={q} idx={i} total={questions.length}
              onChange={(f, v) => updQ(i, f, v)}
              onRemove={() => setQuestions(qs => qs.filter((_, ix) => ix !== i))} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
          <Btn v="outline" full={false} style={{ flex: 1, minWidth: 160 }} onClick={addQ}>
            + Add Question
          </Btn>
          <Btn full={false} style={{ flex: 2, minWidth: 200 }} sz="lg" onClick={doCreate}>
            Create Room ({questions.length} question{questions.length !== 1 ? "s" : ""})
          </Btn>
        </div>
      </div>
      <Footer />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // HOST LOBBY
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "lobby-host") return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <GCss />
      <Nav right={<Pill color="#22c55e">Room Live</Pill>} />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Theme banner — shown if host uploaded one */}
        {themeImage && (
          <div style={{
            borderRadius: 18, overflow: "hidden", border: `1.5px solid ${C.border}`,
            boxShadow: "0 2px 16px rgba(124,92,250,.1)",
            height: 180, width: "100%"
          }}>
            <img src={themeImage} alt="Quiz theme"
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
          </div>
        )}

        <GCard cls="pop" style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.68)",
            letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 12
          }}>
            Share this code with players
          </div>
          <div className="code-d" style={{
            fontFamily: "'Fredoka',sans-serif", fontWeight: 700,
            fontSize: 76, color: "#fff", letterSpacing: ".45em", lineHeight: 1, marginBottom: 20
          }}>
            {roomCode}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-h" onClick={() => copyCode(roomCode)}
              style={{
                padding: "10px 24px", borderRadius: 10, background: "rgba(255,255,255,.22)",
                color: "#fff", border: "1.5px solid rgba(255,255,255,.35)", fontSize: 14,
                fontWeight: 600, cursor: "pointer", transition: "all .18s"
              }}>
              {codeCopied ? "Copied!" : "Copy Code"}
            </button>
            <button className="btn-h" onClick={() => copyLink(shareLink)}
              style={{
                padding: "10px 24px", borderRadius: 10, background: "rgba(255,255,255,.22)",
                color: "#fff", border: "1.5px solid rgba(255,255,255,.35)", fontSize: 14,
                fontWeight: 600, cursor: "pointer", transition: "all .18s"
              }}>
              {linkCopied ? "Copied!" : "Copy Join Link"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginTop: 10 }}>
            {shareLink.replace(/^https?:\/\//, "")}
          </div>
        </GCard>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <GT size={22}>Players in Lobby</GT>
            <Pill>{players.length} joined</Pill>
          </div>
          {players.length === 0
            ? <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                  <circle cx="26" cy="20" r="10" stroke={C.purpleD} strokeWidth="2" fill="none" />
                  <path d="M10 44 a16 16 0 0 1 32 0" stroke={C.purpleD} strokeWidth="2" strokeLinecap="round" fill="none" />
                  <circle cx="38" cy="38" r="6" fill={C.green} />
                  <line x1="38" y1="35" x2="38" y2="41" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="35" y1="38" x2="41" y2="38" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Waiting for players...</div>
              <div style={{ fontSize: 14, marginTop: 6 }}>Share the code above</div>
            </div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              {players.map((p, i) => (
                <div key={p.id} className="sl" style={{
                  background: "#fafaff",
                  border: `1.5px solid ${C.border}`, borderRadius: 14,
                  padding: "12px 14px", display: "flex", alignItems: "center", gap: 8,
                  animationDelay: `${i * .05}s`
                }}>
                  <Av name={p.name} size={32} avatarIndex={p.avatarIndex} />
                  <span style={{
                    fontWeight: 600, fontSize: 14, color: C.navy,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>{p.name}</span>
                </div>
              ))}
            </div>
          }
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <GT size={20}>
              {quizTitle || "Your Quiz"} — {questions.length} Questions
            </GT>
            <Pill color={C.purple}>
              {roomCategory === "Custom" ? roomCustomCategory || "Custom" : roomCategory}
            </Pill>
          </div>
          {questions.map((q, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
              background: "#fafaff", borderRadius: 10, border: `1.5px solid ${C.border}`, marginBottom: 8
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, background: `${C.purple}18`, color: C.purple,
                fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>{i + 1}</div>
              {q.image && <img src={q.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
              <span style={{
                flex: 1, fontSize: 14, fontWeight: 500, color: C.navy,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>{q.text || "—"}</span>
              <Pill color={C.muted}>{q.timeLimit}s</Pill>
            </div>
          ))}
        </Card>

        <Btn sz="lg" disabled={players.length === 0}
          onClick={() => socketRef.current?.emit("start_quiz", { roomCode })}>
          {players.length === 0 ? "Waiting for players..." : "Start the Quiz"}
        </Btn>
      </div>
      <Footer />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PLAYER LOBBY
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "lobby-player") return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, position: "relative"
    }}>
      <GCss /><ThemeBg category={roomCategory} />
      <div style={{
        width: "100%", maxWidth: 520, display: "flex", flexDirection: "column",
        gap: 18, position: "relative", zIndex: 1
      }}>
        {/* Theme banner — if host uploaded one, players see it too */}
        {themeImage && (
          <div style={{
            borderRadius: 18, overflow: "hidden", border: `1.5px solid rgba(255,255,255,.25)`,
            boxShadow: "0 4px 20px rgba(124,92,250,.2)",
            height: 180, width: "100%"
          }}>
            <img src={themeImage} alt="Quiz theme"
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
          </div>
        )}
        <GCard cls="pop" style={{ textAlign: "center", padding: "32px 28px" }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.68)",
            letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 10
          }}>You're in!</div>
          <div className="code-d" style={{
            fontFamily: "'Fredoka',sans-serif", fontWeight: 700,
            fontSize: 66, color: "#fff", letterSpacing: ".4em", lineHeight: 1
          }}>{roomCode}</div>
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setShowAvatarSelector(true)}>
              <Av name={myName} size={48} avatarIndex={myAvatarIdx} />
              <div style={{
                position: "absolute", bottom: -2, right: -2, background: C.pink, borderRadius: "50%",
                width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                border: "1.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)"
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </div>
            </div>
            <span style={{
              background: "rgba(255,255,255,.22)", color: "#fff", borderRadius: 20,
              padding: "5px 18px", fontSize: 16, fontWeight: 600
            }}>{myName}</span>
          </div>
        </GCard>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <GT size={20}>Players ({players.length})</GT>
              <Pill color={C.purple}>
                {roomCategory === "Custom" ? roomCustomCategory || "Custom" : roomCategory}
              </Pill>
            </div>
            <Pill color="#22c55e">Online</Pill>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {players.map((p, i) => {
              const isMe = p.name === myName;
              return (
                <div key={p.id} className="sl"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: isMe ? `${C.purple}0d` : "#fafaff",
                    border: `1.5px solid ${isMe ? C.purple + "55" : C.border}`,
                    borderRadius: 13, animationDelay: `${i * .04}s`,
                    boxShadow: isMe ? `0 0 0 2px ${C.purple}22` : undefined
                  }}>
                  <div style={{ cursor: isMe ? "pointer" : "default" }} onClick={isMe ? () => setShowAvatarSelector(true) : undefined}>
                    <Av name={p.name} size={34} avatarIndex={isMe ? myAvatarIdx : p.avatarIndex} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 15, color: isMe ? C.purple : C.navy }}>
                    {p.name}{isMe ? " (you)" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <div style={{ color: C.muted, fontWeight: 400, fontSize: 16, marginBottom: 14 }}>
            Waiting for host to start...
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%", background: C.purple,
                animation: `pulse 1.2s ${i * .38}s infinite`
              }} />
            ))}
          </div>
        </div>

        {showAvatarSelector && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(10,8,22,0.85)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 20,
            backdropFilter: "blur(8px)"
          }}>
            <div className="pop" style={{
              background: C.white, borderRadius: 24, padding: "28px 24px",
              width: "100%", maxWidth: 440, border: `2px solid ${C.purple}22`,
              boxShadow: "0 20px 40px rgba(124,92,250,0.15)",
              animation: "popIn .3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontFamily: "'Fredoka',sans-serif", fontSize: 22, fontWeight: 700, color: C.navy }}>
                  Choose Your Character
                </span>
                <button 
                  onClick={() => setShowAvatarSelector(false)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 20, color: C.muted, fontWeight: 600,
                    padding: 4, display: "flex", alignItems: "center", justifyContent: "center"
                  }}
                >
                  ✕
                </button>
              </div>
              
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12, maxHeight: 320, overflowY: "auto", padding: "4px 2px"
              }}>
                {AVATARS.map((avSvg, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectAvatar(idx)}
                    style={{
                      background: "none", border: `3px solid ${myAvatarIdx === idx ? C.purple : "transparent"}`,
                      borderRadius: "50%", padding: 0, cursor: "pointer",
                      transition: "transform 0.2s, border-color 0.2s",
                      outline: "none", overflow: "hidden", display: "block",
                      transform: myAvatarIdx === idx ? "scale(1.08)" : "none",
                      boxShadow: myAvatarIdx === idx ? "0 4px 12px rgba(124,92,250,0.35)" : "none"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = myAvatarIdx === idx ? "scale(1.08)" : "none"; }}
                  >
                    <div style={{ width: "100%", height: "100%", padding: 2 }}>
                      {avSvg}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // GAME
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "game") {
    const myLb = leaderboard.find(p => p.name === myName);
    const pct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    const barCol = timeLeft <= 3 ? C.red : timeLeft <= 5 ? C.yellow : C.purple;

    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>
        <GCss />
        <ThemeBg category={roomCategory} />
        <div style={{
          background: "rgba(255,255,255,.94)", backdropFilter: "blur(12px)",
          borderBottom: `1.5px solid ${C.border}55`, padding: "0 22px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 10px rgba(124,92,250,.06)"
        }}>
          <Logo size={22} onClick={handleLogoClick} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {currentQ && <Pill color={C.muted}>Q{currentQ.questionIndex + 1}/{currentQ.totalQuestions}</Pill>}
            <Pill color={C.yellow}>{myScore.toLocaleString()} pts</Pill>
            {myLb && <Pill color={C.purple}>#{myLb.rank}</Pill>}
          </div>
        </div>

        <div style={{
          maxWidth: 680, margin: "0 auto", padding: "18px 18px 40px",
          display: "flex", flexDirection: "column", gap: 14, width: "100%",
          position: "relative", zIndex: 1
        }}>
          {showDoublePointsAnim && (
            <div className="pop" style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(10,8,22,0.96)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              textAlign: "center", padding: 32,
              backdropFilter: "blur(12px)"
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(circle at center, ${C.purple}22 0%, transparent 60%)`,
                animation: "pulseGlow 2.5s infinite alternate"
              }} />
              <div className="pop" style={{ 
                position: "relative", zIndex: 1, maxWidth: 540,
                background: "rgba(255,255,255,0.03)",
                border: `2px solid ${C.yellow}77`,
                borderRadius: 28,
                padding: "48px 36px",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.05)"
              }}>
                <div style={{ fontSize: 72, animation: "bounce 0.8s infinite alternate", marginBottom: 20 }}>🏆</div>
                <h2 style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontSize: 42,
                  fontWeight: 800,
                  color: C.yellow,
                  textShadow: `0 0 30px ${C.yellow}66`,
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em"
                }}>
                  Final Question
                </h2>
                <div style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#fff",
                  margin: "0 0 24px 0",
                  letterSpacing: "0.02em"
                }}>
                  Double Points!
                </div>
                <div style={{
                  display: "inline-block",
                  fontSize: 20, fontWeight: 700, color: "#fff",
                  background: C.grad, padding: "14px 42px", borderRadius: 20,
                  boxShadow: `0 12px 32px ${C.purple}55`,
                  letterSpacing: ".05em", animation: "wobble 2s infinite"
                }}>
                  ⚡ GET READY ⚡
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, fontWeight: 500, marginTop: 24 }}>
                  Answers in this round are worth 2x points!
                </div>
              </div>
            </div>
          )}

          {/* Starting */}
          {gameState === "starting" && (
            <Card style={{ textAlign: "center", padding: "72px 24px" }} cls="pop">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <Icon.Trophy />
              </div>
              <GT size={40} style={{ display: "block" }}>Get Ready!</GT>
              <div style={{ color: C.muted, fontWeight: 400, fontSize: 17, marginTop: 8 }}>
                First question incoming...
              </div>
            </Card>
          )}

          {/* Question + options */}
          {(gameState === "question" || gameState === "result") && currentQ && !showDoublePointsAnim && (
            <>
              {/* Timer bar */}
              {gameState === "question" && (
                <div style={{
                  background: C.border, borderRadius: 99, height: 12, overflow: "hidden",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,.06)"
                }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: timeLeft <= 3 ? `linear-gradient(90deg,${C.red},#ff8080)` :
                      timeLeft <= 5 ? `linear-gradient(90deg,${C.yellow},#ffe066)` : C.grad,
                    width: `${pct}%`, transition: "width .95s linear",
                    boxShadow: `0 0 8px ${barCol}55`
                  }} />
                </div>
              )}

              {/* Question card */}
              <Card cls="pop" style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: ".12em",
                      textTransform: "uppercase", marginBottom: 12
                    }}>
                      Question {currentQ.questionIndex + 1}
                    </div>
                    {/* Image — visible to ALL players, sent compressed via server */}
                    {currentQ.image && (
                      <div style={{ marginBottom: 14 }}>
                        <img src={currentQ.image} alt="question"
                          style={{
                            width: "100%", maxHeight: 240, objectFit: "contain",
                            borderRadius: 14, border: `1.5px solid ${C.border}`
                          }} />
                      </div>
                    )}
                    <div style={{
                      fontSize: "clamp(18px,3.8vw,26px)", fontWeight: 600,
                      color: C.navy, lineHeight: 1.35
                    }}>
                      {gameState === "question" && !revealed ? (
                        <Typewriter text={currentQ.text} speed={20} onComplete={() => setIsTyping(false)} />
                      ) : (
                        currentQ.text
                      )}
                    </div>
                  </div>
                  {gameState === "question" && (
                    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 56 }}>
                      <div style={{
                        fontSize: 52, fontWeight: 700, lineHeight: 1,
                        color: barCol, transition: "color .3s",
                        textShadow: timeLeft <= 3 ? `0 0 16px ${C.red}88` : undefined
                      }}>
                        {timeLeft}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>secs</div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Feedback */}
              {feedback && (
                <div className="pop" style={{
                  textAlign: "center", padding: "14px 22px", borderRadius: 16,
                  fontSize: 18, fontWeight: 600,
                  background: fbOk === null ? `${C.purple}12` : fbOk ? "#f0fdf4" : "#fff0f0",
                  border: `2px solid ${fbOk === null ? C.purple + "33" : fbOk ? "#22c55e44" : C.red + "44"}`,
                  color: fbOk === null ? C.purple : fbOk ? "#16a34a" : "#dc2626"
                }}>
                  {feedback}
                  {fbOk && ptsEarned > 0 && (
                    <span style={{ marginLeft: 12, fontWeight: 700, fontSize: 20, color: C.yellow }}>
                      +{ptsEarned} pts
                    </span>
                  )}
                </div>
              )}

              {!isTyping || revealed ? (
                <>
                  {/* ── MCQ: coloured option buttons ── */}
                  {currentQ.qType === "mcq" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="g4">
                      {currentQ.options.map((opt, idx) => {
                        const m = OPTS[idx % 4];
                        const isLocked = !!lockedAns || revealed;
                        const isPicked = lockedAns === opt;

                        let bg = m.bg, border = m.border, textCol = C.navy, opacity = 1, shape = m.shape;
                        let shadow = `0 2px 10px ${m.color}1a`;
                        let anim = undefined;

                        if (revealed && qResult) {
                          if (opt === qResult.correctAnswer) {
                            bg = "#d1fae5"; border = "#22c55e"; textCol = "#15803d"; shape = "✓";
                            shadow = "0 4px 18px rgba(34,197,94,.28)";
                            anim = "revealOpt .35s ease both";
                          } else if (isPicked) {
                            bg = "#fee2e2"; border = C.red; textCol = "#b91c1c"; shape = "✗";
                            shadow = `0 4px 18px rgba(255,77,77,.22)`;
                            anim = "revealOpt .35s ease both";
                          } else {
                            opacity = 0.22;
                          }
                        } else if (lockedAns !== null) {
                          if (isPicked) {
                            bg = m.color + "20"; border = m.color; shape = "•";
                            shadow = `0 4px 16px ${m.color}33`;
                            anim = "lockPulse 1.6s ease-in-out infinite";
                          } else {
                            opacity = 0.38; bg = C.bg; border = C.border;
                          }
                        }

                        return (
                          <button key={opt}
                            className={!isLocked ? "opt-b" : ""}
                            onClick={!isLocked ? () => doAnswer(opt) : undefined}
                            style={{
                              padding: "clamp(14px,2.5vw,20px) 14px", borderRadius: 18,
                              border: `2px solid ${border}`, cursor: isLocked ? "default" : "pointer",
                              background: bg, opacity, color: textCol,
                              textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                              boxShadow: shadow, transition: "background .2s ease, border-color .2s ease, opacity .2s ease",
                              fontFamily: "'Fredoka',sans-serif",
                              animation: anim,
                              animationDelay: revealed ? `${idx * .07}s` : undefined,
                            }}>
                            <span style={{
                              background: m.color + "24", borderRadius: 9,
                              width: 32, height: 32, flexShrink: 0,
                              color: revealed && opt === qResult?.correctAnswer ? "#16a34a" : m.color,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 15, fontWeight: 700
                            }}>
                              {shape}
                            </span>
                            <span style={{ fontSize: "clamp(13px,2.2vw,15px)", fontWeight: 600, lineHeight: 1.3 }}>
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ── TYPED + FILL IN BLANK: text input box ── */}
                  {(currentQ.qType === "typed" || currentQ.qType === "fillinblank") && (
                    <div className="pop">
                      {/* Input or result reveal */}
                      {!revealed
                        ? <div style={{ display: "flex", gap: 10 }}>
                          <input
                            value={typedInput}
                            onChange={e => { if (!lockedAns) setTypedInput(e.target.value); }}
                            onKeyDown={e => { if (e.key === "Enter" && !lockedAns && typedInput.trim()) doAnswer(typedInput.trim()); }}
                            disabled={!!lockedAns}
                            placeholder={
                              lockedAns ? "Answer locked — waiting for timer..." :
                                currentQ.qType === "fillinblank" ? "Type the missing word..." :
                                  "Type your answer and press Enter..."
                            }
                            autoFocus
                            style={{
                              flex: 1, padding: "16px 18px", borderRadius: 14, fontSize: 17, fontWeight: 600,
                              border: `2px solid ${lockedAns ? C.purple : C.border}`,
                              background: lockedAns ? `${C.purple}08` : "#fafaff",
                              color: C.navy, outline: "none", transition: "all .2s",
                              animation: lockedAns ? "lockPulse 1.6s ease-in-out infinite" : undefined,
                              fontFamily: "'Fredoka',sans-serif",
                            }}
                          />
                          {!lockedAns && (
                            <button
                              onClick={() => { if (typedInput.trim()) doAnswer(typedInput.trim()); }}
                              disabled={!typedInput.trim()}
                              style={{
                                padding: "16px 24px", borderRadius: 14, border: "none",
                                background: typedInput.trim() ? C.grad : "#e2e8f0",
                                color: typedInput.trim() ? "#fff" : C.muted,
                                fontSize: 15, fontWeight: 700,
                                cursor: typedInput.trim() ? "pointer" : "not-allowed",
                                transition: "all .2s", fontFamily: "'Fredoka',sans-serif"
                              }}>
                              Lock In
                            </button>
                          )}
                        </div>
                        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }} className="pop">
                          <div style={{
                            padding: "14px 18px", borderRadius: 14,
                            background: fbOk ? "#d1fae5" : "#fee2e2",
                            border: `2px solid ${fbOk ? "#22c55e" : C.red}`,
                            display: "flex", alignItems: "center", gap: 12
                          }}>
                            <span style={{ fontSize: 20 }}>{fbOk ? "✓" : "✗"}</span>
                            <div>
                              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 2 }}>Your answer</div>
                              <div style={{ fontSize: 16, fontWeight: 600, color: fbOk ? "#15803d" : "#b91c1c" }}>
                                {lockedAns || "(no answer)"}
                              </div>
                            </div>
                          </div>
                          {!fbOk && qResult && (
                            <div style={{
                              padding: "14px 18px", borderRadius: 14,
                              background: "#d1fae5", border: "2px solid #22c55e",
                              display: "flex", alignItems: "center", gap: 12
                            }}>
                              <span style={{ fontSize: 20 }}>✓</span>
                              <div>
                                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 2 }}>Correct answer</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: "#15803d" }}>{qResult.correctAnswer}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      }
                    </div>
                  )}

                  {/* ── REORDER: drag-and-drop list ── */}
                  {currentQ.qType === "reorder" && (
                    <ReorderPlayer
                      items={currentQ.options}
                      correctOrder={qResult?.correctOrder || null}
                      lockedAns={lockedAns}
                      revealed={revealed}
                      qResult={qResult}
                      onSubmit={orderStr => doAnswer(orderStr)}
                    />
                  )}
                </>
              ) : (
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  padding: "48px 0", color: C.muted, fontWeight: 600, fontSize: 16,
                  fontStyle: "italic", animation: "pulseGlow 1.2s infinite"
                }}>
                  Reading question...
                </div>
              )}
            </>
          )}

          {/* Leaderboard — animated row by row + countdown to next question */}
          {gameState === "leaderboard" && (
            <Card cls="pop" style={{ padding: "24px 22px" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <GT size={30} style={{ display: "block" }}>Leaderboard</GT>
                {ptsEarned > 0 && fbOk && (
                  <div style={{
                    marginTop: 8, display: "inline-block",
                    background: `${C.yellow}18`, border: `1.5px solid ${C.yellow}44`,
                    borderRadius: 10, padding: "5px 16px", fontSize: 14, fontWeight: 600, color: C.navy
                  }}>
                    You gained <span style={{ color: C.yellow, fontWeight: 700 }}>+{ptsEarned} pts</span> this round
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {leaderboard.map((p, i) => (
                  <LbRow key={p.id} p={p} myName={myName} idx={i} />
                ))}
              </div>

              {/* Countdown to next question */}
              {!isLast && nextCdSecs !== null && (
                <div style={{
                  marginTop: 24, padding: "16px 20px", borderRadius: 16,
                  background: `${C.purple}0a`, border: `1.5px solid ${C.purple}22`
                }}>
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", marginBottom: 10
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>
                      Next question in...
                    </span>
                    {/* Big animated countdown number */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: C.gradD, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, fontWeight: 700,
                      boxShadow: `0 4px 14px ${C.purple}44`,
                      animation: "cdRing 1s ease-in-out infinite",
                    }}>
                      {nextCdSecs}
                    </div>
                  </div>
                  {/* Draining progress bar */}
                  <div style={{ background: C.border, borderRadius: 99, height: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: C.grad,
                      width: `${(nextCdSecs / 5) * 100}%`,
                      transition: "width 1s linear",
                      boxShadow: `0 0 8px ${C.purple}55`,
                    }} />
                  </div>
                </div>
              )}

              {isLast && (
                <div style={{ textAlign: "center", marginTop: 16, color: C.muted, fontSize: 14 }}>
                  Calculating final results...
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FINISHED
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "finished") {
    const me = leaderboard.find(p => p.name === myName);
    return (
      <div style={{
        minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24, position: "relative"
      }}>
        <GCss /><ThemeBg category={roomCategory} />
        <div style={{
          width: "100%", maxWidth: 560, display: "flex", flexDirection: "column",
          gap: 18, position: "relative", zIndex: 1
        }}>

          <GCard cls="pop" style={{ textAlign: "center", padding: "48px 28px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Icon.Trophy />
            </div>
            <div style={{ fontWeight: 700, fontSize: 38, color: "#fff", marginBottom: 6 }}>
              {me?.rank === 1 ? "You Won!" : me?.rank === 2 ? "Runner Up!" : me?.rank === 3 ? "Third Place!" : `Rank #${me?.rank}`}
            </div>
            <div style={{ fontWeight: 700, fontSize: 52, color: "#fef3c7", letterSpacing: ".02em" }}>
              {(me?.score || 0).toLocaleString()} pts
            </div>
          </GCard>

          <Card>
            <GT size={26} style={{ display: "block", marginBottom: 18 }}>Final Standings</GT>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leaderboard.map((p, i) => (
                <LbRow key={p.id} p={p} myName={myName} idx={i} />
              ))}
            </div>
          </Card>

          <Btn sz="lg" onClick={doPlayAgain}>Play Again</Btn>
          <Btn v="ghost" onClick={doPlayAgain}>Back to Home</Btn>
        </div>
        <div style={{ marginTop: 32, position: "relative", zIndex: 1, width: "100%" }}>
          <Footer />
        </div>
      </div>
    );
  }

  return null;
}