import React from 'react';

export type GenderType = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | string;

interface GenderBadgeProps {
  gender?: GenderType;
  isGenderVisible?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const GenderBadge: React.FC<GenderBadgeProps> = ({
  gender = 'prefer-not-to-say',
  isGenderVisible = true,
  size = 'sm',
  showLabel = false
}) => {
  if (isGenderVisible === false) return null;

  const normalized = (gender || 'prefer-not-to-say').toLowerCase().trim();

  let symbol = '⚲';
  let colorClass = 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  let label = 'Prefer not to say';

  if (normalized === 'male') {
    symbol = '♂';
    colorClass = 'text-blue-500 bg-blue-500/10 border-blue-500/30';
    label = 'Male';
  } else if (normalized === 'female') {
    symbol = '♀';
    colorClass = 'text-pink-500 bg-pink-500/10 border-pink-500/30';
    label = 'Female';
  } else if (normalized === 'non-binary') {
    symbol = '⚧';
    colorClass = 'text-purple-500 bg-purple-500/10 border-purple-500/30';
    label = 'Non-binary';
  }

  const sizeClasses = {
    xs: 'text-[10px] px-1 py-0.2 rounded',
    sm: 'text-xs px-1.5 py-0.5 rounded-md',
    md: 'text-sm px-2 py-1 rounded-lg',
    lg: 'text-base px-2.5 py-1.5 rounded-xl'
  };

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 font-bold border shrink-0 ${colorClass} ${sizeClasses[size]}`}
    >
      <span className="select-none leading-none">{symbol}</span>
      {showLabel && <span className="text-[10px] tracking-wide">{label}</span>}
    </span>
  );
};
