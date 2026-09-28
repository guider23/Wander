import React from 'react';

interface WanderLogoProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wander Botanical Attention Logo
 * Handcrafted minimalist vector mark:
 * Root anchor node, upward flowing stem loop, and curious exploratory branch ring.
 */
export const WanderLogo: React.FC<WanderLogoProps> = ({
  size = 20,
  color = '#181818',
  className,
  style
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Root Node anchor */}
      <circle cx="12" cy="19.2" r="1.25" fill={color} />

      {/* Stem connection */}
      <line
        x1="12"
        y1="18.5"
        x2="12"
        y2="16.6"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Leaf / Fluid loop */}
      <path
        d="M 12 16.6 C 13.4 14.2 12.7 9.8 10.9 7.2 C 9.9 5.8 11.2 5.1 11.9 5.6 C 12.8 6.2 11.8 7.8 10.8 8.8 C 8.4 11.0 8.0 13.6 10.0 15.6 C 10.9 16.4 11.5 16.5 12 16.6 Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Exploratory branch */}
      <path
        d="M 11.8 11.9 C 12.7 10.3 14.0 9.0 15.5 8.6"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Branch node ring */}
      <circle
        cx="16.5"
        cy="8.6"
        r="1.1"
        stroke={color}
        strokeWidth="0.85"
        fill="#F5E6D8"
      />
    </svg>
  );
};
