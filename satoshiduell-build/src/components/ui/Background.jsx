import React from 'react';

const Background = ({ children, allowScroll = false }) => {
  return (
    // 1. FIXED + VIEWPORT-FILL: füllt exakt den SICHTBAREN Viewport.
    // WICHTIG: früher stand hier "fixed inset-0" — dessen bottom:0 verankert
    // sich am LAYOUT-Viewport, der auf Mobilgeräten bis HINTER die
    // Browser-Leiste reicht. Folge: die unterste Antwort im Spiel lag unter
    // der Leiste. Jetzt: oben verankert + Höhe über .viewport-fill
    // (= 100dvh mit 100vh-Fallback, definiert in index.css) -> das Element
    // endet an der sichtbaren Unterkante, auch wenn die Leiste ein-/ausblendet.
    // In der installierten PWA (keine Leiste) ändert sich nichts.
    <div className="fixed top-0 left-0 w-full viewport-fill bg-black text-white overflow-hidden">
      
      {/* Hier dein Gradient/Hintergrund-Design (Beispiel) */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-900 z-0 pointer-events-none" />
      
      {/* 2. INHALT-WRAPPER:
          Muss 'relative' sein (damit er über dem Gradient liegt).
          Muss 'w-full h-full' haben, um die Größe an die Kinder weiterzugeben.
      */}
      <div className={`relative z-10 w-full h-full flex flex-col ${allowScroll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
};

export default Background;