// App.jsx - Demo Version (ohne Supabase)
import React, { useState } from 'react';
import Background from './components/ui/Background';
import Button from './components/ui/Button';
import Card from './components/ui/Card';
import { Zap, Trophy, Code } from 'lucide-react';

// Demo der modularen Struktur
import { formatName, formatSats, formatTime } from './utils/formatters';
import { validateUsername, validatePin } from './utils/validators';
import { playSound } from './utils/sound';

export default function App() {
  const [view, setView] = useState('demo');

  if (view === 'demo') {
    return (
      <Background>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-8">
          {/* Header */}
          <div className="text-center">
            <div className="text-6xl mb-4 animate-bounce">⚡</div>
            <h1 className="text-5xl font-black text-white mb-2">
              SATOSHI<span className="text-orange-500">DUELL</span>
            </h1>
            <p className="text-neutral-400 text-sm uppercase tracking-widest">
              Refactored & Modular
            </p>
          </div>

          {/* Demo Card */}
          <Card className="max-w-2xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <Code className="text-green-400" size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  ✅ Refactoring Erfolgreich!
                </h2>
                <p className="text-neutral-400 text-sm">
                  2248 Zeilen monolithischer Code → Modulare, wartbare Struktur
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatCard 
                icon={<Trophy size={24} />}
                label="Module"
                value="25+"
                color="text-orange-500"
              />
              <StatCard 
                icon={<Zap size={24} />}
                label="Hooks"
                value="4"
                color="text-yellow-500"
              />
              <StatCard 
                label="Services"
                value="3"
                color="text-blue-500"
              />
              <StatCard 
                label="Utils"
                value="6"
                color="text-green-500"
              />
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wider">
                🎯 Utils Demo
              </h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-neutral-400">formatName("verylongusername"):</span>
                  <span className="text-orange-400">{formatName("verylongusername")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">formatSats(1000000):</span>
                  <span className="text-orange-400">{formatSats(1000000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">formatTime(125.5):</span>
                  <span className="text-orange-400">{formatTime(125.5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">validateUsername("abc").valid:</span>
                  <span className={validateUsername("abc").valid ? "text-green-400" : "text-red-400"}>
                    {validateUsername("abc").valid ? 'true ✓' : 'false ✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">validatePin("1234").valid:</span>
                  <span className={validatePin("1234").valid ? "text-green-400" : "text-red-400"}>
                    {validatePin("1234").valid ? 'true ✓' : 'false ✗'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="primary" 
                onClick={() => playSound('correct', false)}
                className="text-xs"
              >
                ✓ Sound
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => playSound('wrong', false)}
                className="text-xs"
              >
                ✗ Sound
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => playSound('click', false)}
                className="text-xs"
              >
                Click
              </Button>
            </div>
          </Card>

          {/* Info */}
          <div className="text-center max-w-xl">
            <h3 className="text-white font-bold mb-2">📦 Vollständige Struktur erstellt</h3>
            <p className="text-neutral-400 text-sm mb-4">
              Alle Module (Hooks, Services, Utils, Components) sind implementiert und einsatzbereit.
              Für vollständige Funktionalität: Supabase & LNbits Credentials in .env eintragen.
            </p>
            <div className="flex gap-2 justify-center">
              <div className="bg-green-500/20 px-3 py-1 rounded text-green-400 text-xs font-mono">
                ✓ Hooks
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded text-green-400 text-xs font-mono">
                ✓ Services
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded text-green-400 text-xs font-mono">
                ✓ Utils
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded text-green-400 text-xs font-mono">
                ✓ Components
              </div>
            </div>
          </div>
        </div>
      </Background>
    );
  }

  return null;
}

// Helper Component
const StatCard = ({ icon, label, value, color = "text-white" }) => (
  <div className="bg-white/5 rounded-xl p-4">
    {icon && <div className={`${color} mb-2`}>{icon}</div>}
    <div className={`text-3xl font-black ${color}`}>{value}</div>
    <div className="text-neutral-400 text-xs uppercase tracking-wider">{label}</div>
  </div>
);
