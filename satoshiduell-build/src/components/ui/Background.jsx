import React from 'react';

const Background = ({ children, allowScroll = false }) => {
  return (
    // 1. FIXED INSET-0: Zwingt den Hintergrund, exakt den Viewport zu füllen.
    // Kein Scrolling auf dieser Ebene!
    <div className="fixed inset-0 w-full h-full bg-black text-white overflow-hidden">
      
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