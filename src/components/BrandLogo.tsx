import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = false
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Original ChatLustora Custom SVG Logo: Flame Heart + Speech Bubble */}
      <div className={`relative flex items-center justify-center shrink-0 ${iconSizes[size]}`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_8px_rgba(255,145,0,0.35)]"
        >
          <defs>
            <linearGradient id="lustoraGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ff9100" />
              <stop offset="0.5" stopColor="#ff5500" />
              <stop offset="1" stopColor="#e02424" />
            </linearGradient>
            <linearGradient id="innerGlow" x1="12" y1="8" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" stopOpacity="0.3" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Rounded chat shield bubble */}
          <path
            d="M24 4C13.5 4 5 12 5 21.8C5 27.2 7.6 32 11.8 35.2L10 43L18.4 39C20.2 39.4 22.1 39.6 24 39.6C34.5 39.6 43 31.6 43 21.8C43 12 34.5 4 24 4Z"
            fill="url(#lustoraGrad)"
          />
          {/* Subtle upper glass highlight */}
          <path
            d="M24 6C14.6 6 7 13.2 7 22C7 24.2 7.5 26.3 8.4 28.2C11.5 20.8 19.8 15.5 29.5 15.5C34.5 15.5 39.1 17 42.4 19.5C41.6 11.9 33.6 6 24 6Z"
            fill="url(#innerGlow)"
          />

          {/* Intertwined passionate heart flame emblem */}
          <path
            d="M24 16C21.2 13 16.5 13.5 14.5 17C12.5 20.5 13.8 24.5 17.5 28L24 33.5L30.5 28C34.2 24.5 35.5 20.5 33.5 17C31.5 13.5 26.8 13 24 16Z"
            fill="#ffffff"
          />
          <circle cx="24" cy="22.5" r="2.8" fill="#ff5500" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span className={`font-extrabold tracking-tight text-text-main leading-none ${textSizes[size]}`}>
          Chat<span className="text-brand">Lustora</span>
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-text-muted tracking-wide mt-0.5">
            Flirt Freely. Connect Deeply.
          </span>
        )}
      </div>
    </div>
  );
};
