// components/ui/Card.jsx
import React from 'react';

const Card = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
