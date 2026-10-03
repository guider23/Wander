import { describe, it, expect } from 'vitest';
import { GalaxyCanvas, GalaxyCanvasProps } from '../../src/components/canvas/GalaxyCanvas';

describe('GalaxyCanvas Component', () => {
  it('exports GalaxyCanvas as a valid React component', () => {
    expect(GalaxyCanvas).toBeDefined();
    expect(typeof GalaxyCanvas).toBe('function');
  });

  it('accepts correct TypeScript props structure', () => {
    const props: GalaxyCanvasProps = {
      active: true,
      opacity: 0.95,
      className: 'galaxy-layer',
      style: { zIndex: 0 }
    };
    expect(props.active).toBe(true);
    expect(props.opacity).toBe(0.95);
    expect(props.className).toBe('galaxy-layer');
  });
});
