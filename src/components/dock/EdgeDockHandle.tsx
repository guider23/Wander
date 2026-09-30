import React, { useState, useEffect, useRef } from 'react';
import { Node } from '../../domain/entities/types';

interface EdgeDockHandleProps {
  onExpand: () => void;
  activeNode?: Node | null;
}

export const EdgeDockHandle: React.FC<EdgeDockHandleProps> = ({ onExpand, activeNode }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Active focus typography
  const title = activeNode?.title ? activeNode.title.trim() : 'ATTENTION';

  // Dynamic notch height adapting to title length
  const isLong = title.length > 13;
  const tabHeight = isLong ? 218 : 196;
  const tabWidth = 44;
  const curveH = 54;

  // Track overflow for smooth, precise carousel scroll
  const textRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    if (textRef.current && trackRef.current) {
      const textH = textRef.current.getBoundingClientRect().height;
      const trackH = trackRef.current.getBoundingClientRect().height;
      const diff = Math.round(textH - trackH);
      if (diff > 4) {
        setOverflowPx(diff + 24);
      } else {
        setOverflowPx(0);
      }
    }
  }, [title, tabHeight]);

  // Smooth G1/G2 continuous organic S-fillet SVG notch path (strictly vertical tangents at both ends)
  const svgPath = `
    M ${tabWidth} 0
    C ${tabWidth} 22, 0 32, 0 ${curveH}
    L 0 ${tabHeight - curveH}
    C 0 ${tabHeight - 32}, ${tabWidth} ${tabHeight - 22}, ${tabWidth} ${tabHeight}
    L ${tabWidth} 0
    Z
  `;

  return (
    <div
      onClick={onExpand}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        userSelect: 'none',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        overflow: 'visible',
        position: 'relative'
      }}
      title={`Active Focus: ${title} (Click to open)`}
      role="button"
      aria-label="Open Attention Path"
    >
      <div
        style={{
          position: 'relative',
          width: `${tabWidth}px`,
          height: `${tabHeight}px`,
          marginRight: '2px',
          animation: 'edgeDockSlideIn 380ms cubic-bezier(0.16, 1, 0.3, 1) both',
          transform: isPressed
            ? 'translateX(-2px) scale(0.96)'
            : isHovered
            ? 'translateX(-6px)'
            : 'translateX(0)',
          transition: isPressed
            ? 'transform 80ms ease'
            : 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), height 280ms cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <svg
          width={tabWidth}
          height={tabHeight}
          viewBox={`0 0 ${tabWidth} ${tabHeight}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <path
            d={svgPath}
            fill="#141414"
            stroke="#262626"
            strokeWidth="1"
          />
        </svg>

        {/* Minimal Typography Track within Safe Full-Depth Spine */}
        <div
          ref={trackRef}
          style={{
            position: 'absolute',
            top: '36px',
            bottom: '36px',
            left: '8px',
            width: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        >
          {/* Top Physical Fade Overlay into #141414 notch */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '28px',
              background: 'linear-gradient(to bottom, #141414 35%, rgba(20, 20, 20, 0) 100%)',
              zIndex: 3,
              pointerEvents: 'none'
            }}
          />

          {/* Bottom Physical Fade Overlay into #141414 notch */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '28px',
              background: 'linear-gradient(to top, #141414 35%, rgba(20, 20, 20, 0) 100%)',
              zIndex: 3,
              pointerEvents: 'none'
            }}
          />

          {/* Vertical Title Typography */}
          <div
            ref={textRef}
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '10.5px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#F2E8DC',
              whiteSpace: 'nowrap',
              opacity: isHovered ? 1 : 0.88,
              transition: 'opacity 180ms ease',
              padding: '12px 0',
              animation: overflowPx > 0 ? 'dockVerticalCarousel 8.5s ease-in-out infinite' : 'none',
              ['--carousel-offset' as any]: `-${overflowPx}px`
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </div>
  );
};
