import React from 'react';
import { playSound } from '../../utils/sound';

const Button = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  
  const baseStyles = "px-4 py-3 rounded-xl font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg active:scale-95";
  
  const variants = {
    // HIER IST DIE ÄNDERUNG: Orange statt Weiß
    primary: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white border-none tracking-wider",
    
    secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
    ghost: "bg-transparent text-neutral-400 hover:text-white border-transparent",
    danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
  };

  const widthClass = fullWidth ? "w-full" : "";

  const handleClick = (e) => {
    try {
      const muted = localStorage.getItem('satoshi_sound') === 'false';
      playSound('click', muted);
    } catch (e) {
      // ignore
    }

    if (props.onClick) props.onClick(e);
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant] || variants.primary} ${widthClass} ${className}`}
      {...props}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

export default Button;