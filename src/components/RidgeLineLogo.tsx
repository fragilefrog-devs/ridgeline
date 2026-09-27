import React from 'react';

interface RidgeLineLogoProps {
  className?: string;
  size?: number;
}

export const RidgeLineLogo: React.FC<RidgeLineLogoProps> = ({ 
  className = "h-8 w-8", 
  size = 32 
}) => {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-lg bg-neutral-900 text-white shadow-xs select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="w-[72%] h-[72%]"
      >
        {/* Background Subtle Grid / Level line */}
        <line 
          x1="4" 
          y1="24.5" 
          x2="28" 
          y2="24.5" 
          stroke="currentColor" 
          strokeOpacity="0.3" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
        />
        {/* Secondary Background Mountain Contour */}
        <path 
          d="M14 24.5L19 16L27 24.5" 
          stroke="currentColor" 
          strokeOpacity="0.45" 
          strokeWidth="1.75" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Primary Foreground Ridge Peak */}
        <path 
          d="M5 24.5L12.5 11L18.5 24.5" 
          stroke="white" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Precision Laser Apex Dot */}
        <circle 
          cx="12.5" 
          cy="11" 
          r="1.5" 
          fill="#38bdf8" 
        />
        {/* Accent Dynamic Dispatch Notch */}
        <path 
          d="M12.5 11L15 15.5" 
          stroke="#38bdf8" 
          strokeWidth="1.8" 
          strokeLinecap="round" 
        />
      </svg>
    </div>
  );
};
