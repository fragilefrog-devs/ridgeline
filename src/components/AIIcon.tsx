import React from 'react';

export const AIIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M12 3L14.5 9.5L21 12L14.5 14.5L12 21L9.5 14.5L3 12L9.5 9.5L12 3Z" 
      fill="currentColor" 
    />
    <path 
      d="M19 3L19.75 5.25L22 6L19.75 6.75L19 9L18.25 6.75L16 6L18.25 5.25L19 3Z" 
      fill="currentColor" 
    />
    <path 
      d="M5 16L5.75 18.25L8 19L5.75 19.75L5 22L4.25 19.75L2 19L4.25 18.25L5 16Z" 
      fill="currentColor" 
    />
  </svg>
);
