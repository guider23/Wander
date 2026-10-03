import React, { useEffect, useRef } from 'react';

export interface GalaxyCanvasProps {
  active: boolean;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_opacity;
varying vec2 v_uv;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float gradNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float n00 = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float n10 = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float n01 = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float n11 = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

const mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);

float fbm5(vec2 p) {
  float total = 0.0;
  float amp = 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.02; amp *= 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.03; amp *= 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.01; amp *= 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.04; amp *= 0.5;
  total += amp * gradNoise(p);
  return total;
}

float fbm4(vec2 p) {
  float total = 0.0;
  float amp = 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.02; amp *= 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.03; amp *= 0.5;
  total += amp * gradNoise(p); p = rot * p * 2.01; amp *= 0.5;
  total += amp * gradNoise(p);
  return total;
}

void drawHeroStar(inout vec3 col, vec2 uv, vec2 center, float size, vec3 starColor, float time, float seed) {
  vec2 delta = uv - center;
  float dist = length(delta);
  float tw = 0.85 + 0.15 * sin(time * 1.5 + seed);

  float core = smoothstep(0.0035 * size, 0.0, dist) * 2.2;
  float aura = (0.00045 * size) / (dist * dist + 0.00022);
  aura = clamp(aura, 0.0, 1.2);

  float spikeIntensity = 0.0;
  if (dist < 0.08 * size) {
    float sx = max(0.0, 1.0 - abs(delta.x) * 450.0 / size) * exp(-abs(delta.y) * 40.0 / size);
    float sy = max(0.0, 1.0 - abs(delta.y) * 450.0 / size) * exp(-abs(delta.x) * 40.0 / size);
    spikeIntensity = (sx + sy) * 0.40;
  }

  col += starColor * (core + aura * 0.75 + spikeIntensity) * tw;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

  float t = u_time * 0.015;
  vec2 drift = vec2(t * 0.35, t * 0.12);

  vec2 p = uv * 1.35;

  float spine = 0.16 * sin(p.x * 1.8 - 0.3) + 0.09 * sin(p.x * 3.6 + 1.2);
  float distSpine = abs(p.y - spine);
  float beltMask = exp(-distSpine * distSpine * 3.2);

  vec2 q = vec2(
    fbm5(p + vec2(0.0, 0.0) + drift),
    fbm5(p + vec2(5.2, 1.3) + drift * 0.85)
  );

  vec2 r = vec2(
    fbm5(p + 2.8 * q + vec2(1.7, 9.2) + drift * 0.4),
    fbm5(p + 2.8 * q + vec2(8.3, 2.8) + drift * 0.5)
  );

  float gas = fbm5(p + 2.8 * r);
  float gasNorm = clamp((gas + 0.35) * 1.25, 0.0, 1.0);
  float gasDensity = gasNorm * beltMask;

  float ridge = 1.0 - abs(fbm4(p * 2.4 + 2.0 * r + vec2(2.4, -1.8)));
  ridge = smoothstep(0.35, 0.95, ridge);

  float violetField = fbm4(p * 1.4 + 1.8 * q + vec2(-3.1, 4.2));
  float violetWeight = smoothstep(-0.25, 0.45, violetField - p.y * 0.5);

  float tealWeight = smoothstep(-0.15, 0.55, ridge * 0.85 + r.x * 0.55 + p.y * 0.4);

  vec3 c_teal_dark   = vec3(0.039, 0.239, 0.259);
  vec3 c_teal_mid    = vec3(0.094, 0.345, 0.388);
  vec3 c_teal_bright = vec3(0.149, 0.478, 0.522);
  vec3 c_teal_glow   = vec3(0.306, 0.722, 0.729);

  vec3 c_violet_dark   = vec3(0.169, 0.106, 0.282);
  vec3 c_violet_mid    = vec3(0.243, 0.141, 0.376);
  vec3 c_violet_bright = vec3(0.298, 0.149, 0.400);
  vec3 c_violet_glow   = vec3(0.420, 0.231, 0.541);

  float t_amt = clamp(gasDensity * tealWeight * 1.55, 0.0, 1.0);
  vec3 col_teal = mix(c_teal_dark, c_teal_mid, smoothstep(0.08, 0.38, t_amt));
  col_teal = mix(col_teal, c_teal_bright, smoothstep(0.38, 0.75, t_amt));
  col_teal += c_teal_glow * pow(smoothstep(0.70, 1.0, t_amt), 2.2) * 0.65;

  float v_amt = clamp(gasDensity * violetWeight * 1.45, 0.0, 1.0);
  vec3 col_violet = mix(c_violet_dark, c_violet_mid, smoothstep(0.08, 0.40, v_amt));
  col_violet = mix(col_violet, c_violet_bright, smoothstep(0.40, 0.80, v_amt));
  col_violet += c_violet_glow * pow(smoothstep(0.75, 1.0, v_amt), 2.2) * 0.55;

  vec3 nebula = col_teal * smoothstep(0.04, 0.25, t_amt) +
                col_violet * smoothstep(0.04, 0.25, v_amt);

  float dustNoise = fbm5(p * 1.75 + vec2(1.8, 6.2) + q * 1.5);
  float dustRift = smoothstep(0.02, 0.50, dustNoise);
  float dustAbsorption = clamp(dustRift * 1.25 * beltMask, 0.0, 0.94);
  nebula = mix(nebula, nebula * 0.06, dustAbsorption);

  vec3 c_void_base = vec3(0.010, 0.022, 0.045);
  vec3 c_void_ambient = vec3(0.020, 0.035, 0.070);
  vec3 voidColor = mix(c_void_base, c_void_ambient, clamp(length(uv) * 0.35, 0.0, 1.0));

  vec3 color = voidColor + nebula;

  vec2 starGrid1 = uv * 140.0;
  vec2 cell1 = floor(starGrid1);
  vec2 pos1 = fract(starGrid1) - 0.5;
  float h1 = hash1(cell1);
  if (h1 > 0.87) {
    vec2 offset = vec2(hash1(cell1 + 1.2), hash1(cell1 + 3.4)) - 0.5;
    float dist = length(pos1 - offset * 0.6);
    float starBright = pow(hash1(cell1 + 5.6), 5.0) * 1.35;
    float microStar = smoothstep(0.09, 0.0, dist) * starBright;
    float tw = sin(u_time * 1.6 + h1 * 40.0) * 0.2 + 0.8;
    vec3 starTint = mix(vec3(0.85, 0.93, 1.0), vec3(1.0, 0.96, 0.91), hash1(cell1 + 8.1));
    color += starTint * microStar * tw * (1.0 + beltMask * 0.5);
  }

  vec2 starGrid2 = uv * 240.0;
  vec2 cell2 = floor(starGrid2);
  vec2 pos2 = fract(starGrid2) - 0.5;
  float h2 = hash1(cell2 + 99.0);
  if (h2 > 0.92) {
    vec2 offset = vec2(hash1(cell2 + 4.2), hash1(cell2 + 7.4)) - 0.5;
    float dist = length(pos2 - offset * 0.6);
    float starBright = pow(hash1(cell2 + 2.3), 6.0) * 1.05;
    float microStar = smoothstep(0.11, 0.0, dist) * starBright;
    float tw = sin(u_time * 2.1 + h2 * 50.0) * 0.2 + 0.8;
    color += vec3(0.90, 0.95, 1.0) * microStar * tw;
  }

  vec2 clusterCenter = vec2(0.12, -0.02);
  float clusterDist = length(uv - clusterCenter);
  float clusterMask = exp(-clusterDist * clusterDist * 75.0);
  if (clusterMask > 0.03) {
    vec2 cGrid = uv * 320.0;
    vec2 cCell = floor(cGrid);
    float ch = hash1(cCell + 42.0);
    if (ch > 0.62) {
      vec2 cPos = fract(cGrid) - 0.5;
      float cd = length(cPos);
      float cStar = smoothstep(0.12, 0.0, cd) * clusterMask * 2.0;
      float cTw = sin(u_time * 2.4 + ch * 35.0) * 0.2 + 0.8;
      color += vec3(0.86, 0.94, 1.0) * cStar * cTw;
    }
  }

  drawHeroStar(color, uv, vec2(0.66, -0.36), 1.35, vec3(0.88, 0.95, 1.0), u_time, 1.0);
  drawHeroStar(color, uv, vec2(-0.72, 0.35), 1.15, vec3(0.92, 0.95, 1.0), u_time, 2.7);
  drawHeroStar(color, uv, vec2(-0.52, -0.12), 0.90, vec3(0.85, 0.93, 1.0), u_time, 4.3);
  drawHeroStar(color, uv, vec2(0.38, 0.28), 0.85, vec3(0.80, 0.95, 0.98), u_time, 5.8);
  drawHeroStar(color, uv, vec2(-0.18, -0.42), 0.80, vec3(1.0, 0.96, 0.90), u_time, 7.2);

  float vig = 1.0 - 0.25 * pow(length(v_uv - 0.5) * 1.35, 2.0);
  color *= clamp(vig, 0.0, 1.0);

  float dither = (hash1(gl_FragCoord.xy + fract(u_time * 0.05)) - 0.5) * (1.0 / 255.0);
  color += dither;

  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, u_opacity);
}
`;

interface FallbackStar {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  r: number;
  g: number;
  b: number;
}

const TARGET_FPS = 35;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export const GalaxyCanvas: React.FC<GalaxyCanvasProps> = ({
  active,
  opacity = 1,
  className,
  style
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef<boolean>(active);
  const opacityRef = useRef<number>(opacity);

  const startLoopRef = useRef<() => void>(() => {});
  const stopLoopRef = useRef<() => void>(() => {});
  const renderSingleFrameRef = useRef<() => void>(() => {});

  activeRef.current = active;
  opacityRef.current = opacity;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let locResolution: WebGLUniformLocation | null = null;
    let locTime: WebGLUniformLocation | null = null;
    let locOpacity: WebGLUniformLocation | null = null;

    let isUsingFallback2D = false;
    let ctx2D: CanvasRenderingContext2D | null = null;
    let fallbackStars: FallbackStar[] = [];

    let animationFrameId: number | null = null;
    let startTime = performance.now();
    let lastFrameTime = 0;
    let isContextLost = false;

    let createdVertShader: WebGLShader | null = null;
    let createdFragShader: WebGLShader | null = null;

    const createShader = (type: number, source: string): WebGLShader | null => {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('WebGL shader compilation failed:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const initFallback2D = () => {
      isUsingFallback2D = true;
      ctx2D = canvas.getContext('2d');
      fallbackStars = [];
      const starCount = 160;
      for (let i = 0; i < starCount; i++) {
        const isWarm = Math.random() > 0.6;
        fallbackStars.push({
          x: Math.random(),
          y: Math.random(),
          size: Math.random() * 1.5 + 0.5,
          baseAlpha: Math.random() * 0.7 + 0.3,
          twinkleSpeed: Math.random() * 0.03 + 0.01,
          phase: Math.random() * Math.PI * 2,
          r: isWarm ? 255 : 210 + Math.floor(Math.random() * 30),
          g: isWarm ? 240 : 230 + Math.floor(Math.random() * 20),
          b: 255
        });
      }
    };

    const initGL = (): boolean => {
      try {
        gl = (canvas.getContext('webgl', {
          alpha: true,
          depth: false,
          stencil: false,
          antialias: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance'
        }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

        if (!gl) {
          initFallback2D();
          return false;
        }

        createdVertShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        createdFragShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

        if (!createdVertShader || !createdFragShader) {
          initFallback2D();
          return false;
        }

        program = gl.createProgram();
        if (!program) {
          initFallback2D();
          return false;
        }

        gl.attachShader(program, createdVertShader);
        gl.attachShader(program, createdFragShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.warn('WebGL program linking failed:', gl.getProgramInfoLog(program));
          initFallback2D();
          return false;
        }

        gl.useProgram(program);

        const positionLocation = gl.getAttribLocation(program, 'a_position');
        locResolution = gl.getUniformLocation(program, 'u_resolution');
        locTime = gl.getUniformLocation(program, 'u_time');
        locOpacity = gl.getUniformLocation(program, 'u_opacity');

        // Full-screen triangle covering [-1, 1] bounds
        const positions = new Float32Array([
          -1.0, -1.0,
           3.0, -1.0,
          -1.0,  3.0
        ]);

        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        return true;
      } catch (err) {
        console.warn('WebGL initialization encountered an error, activating Canvas 2D fallback:', err);
        initFallback2D();
        return false;
      }
    };

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
      const targetHeight = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        if (gl && !isUsingFallback2D) {
          gl.viewport(0, 0, targetWidth, targetHeight);
        }
      }
    };

    const renderGL = (elapsedTimeSec: number) => {
      if (!gl || !program || isContextLost) return;

      gl.useProgram(program);
      gl.uniform2f(locResolution, canvas.width, canvas.height);
      gl.uniform1f(locTime, elapsedTimeSec);
      gl.uniform1f(locOpacity, opacityRef.current);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const renderFallback2D = (elapsedTimeSec: number) => {
      if (!ctx2D) return;
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) return;

      ctx2D.save();
      ctx2D.globalAlpha = opacityRef.current;

      // Base void fill
      ctx2D.fillStyle = '#03070E';
      ctx2D.fillRect(0, 0, w, h);

      // Subtle slow drift
      const driftX = Math.sin(elapsedTimeSec * 0.04) * (w * 0.02);
      const driftY = Math.cos(elapsedTimeSec * 0.04) * (h * 0.02);

      // Astral Violet diffuse nebula cloud
      const violetGrad = ctx2D.createRadialGradient(
        w * 0.45 + driftX, h * 0.52 + driftY, 0,
        w * 0.45 + driftX, h * 0.52 + driftY, w * 0.45
      );
      violetGrad.addColorStop(0.0, 'rgba(76, 38, 102, 0.45)');
      violetGrad.addColorStop(0.4, 'rgba(43, 27, 72, 0.28)');
      violetGrad.addColorStop(0.8, 'rgba(25, 14, 45, 0.10)');
      violetGrad.addColorStop(1.0, 'rgba(3, 7, 14, 0.0)');

      ctx2D.globalCompositeOperation = 'screen';
      ctx2D.fillStyle = violetGrad;
      ctx2D.fillRect(0, 0, w, h);

      // Teal glowing nebula ribbon
      const tealGrad = ctx2D.createRadialGradient(
        w * 0.58 - driftX, h * 0.46 - driftY, 0,
        w * 0.58 - driftX, h * 0.46 - driftY, w * 0.38
      );
      tealGrad.addColorStop(0.0, 'rgba(38, 122, 133, 0.40)');
      tealGrad.addColorStop(0.3, 'rgba(22, 88, 98, 0.25)');
      tealGrad.addColorStop(0.7, 'rgba(10, 61, 66, 0.08)');
      tealGrad.addColorStop(1.0, 'rgba(3, 7, 14, 0.0)');

      ctx2D.fillStyle = tealGrad;
      ctx2D.fillRect(0, 0, w, h);

      // Starfield drawing
      ctx2D.globalCompositeOperation = 'source-over';
      for (let i = 0; i < fallbackStars.length; i++) {
        const star = fallbackStars[i];
        star.phase += star.twinkleSpeed;
        const twinkle = 0.75 + 0.25 * Math.sin(star.phase);
        const currentAlpha = star.baseAlpha * twinkle;

        ctx2D.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${currentAlpha})`;
        const sx = star.x * w;
        const sy = star.y * h;
        ctx2D.beginPath();
        ctx2D.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx2D.fill();
      }

      ctx2D.restore();
    };

    const tick = (now: number) => {
      if (!activeRef.current || document.hidden || isContextLost) {
        animationFrameId = null;
        return;
      }

      const delta = now - lastFrameTime;
      if (delta >= FRAME_INTERVAL_MS) {
        lastFrameTime = now - (delta % FRAME_INTERVAL_MS);
        const elapsedTimeSec = (now - startTime) * 0.001;
        updateDimensions();

        if (isUsingFallback2D) {
          renderFallback2D(elapsedTimeSec);
        } else {
          renderGL(elapsedTimeSec);
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (animationFrameId === null && activeRef.current && !document.hidden && !isContextLost) {
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else if (activeRef.current) {
        startLoop();
      }
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      isContextLost = true;
      stopLoop();
    };

    const handleContextRestored = () => {
      isContextLost = false;
      initGL();
      if (activeRef.current && !document.hidden) {
        startLoop();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      if (!activeRef.current && canvas) {
        // Render a single frame on resize even when paused
        const elapsed = (performance.now() - startTime) * 0.001;
        if (isUsingFallback2D) {
          renderFallback2D(elapsed);
        } else {
          renderGL(elapsed);
        }
      }
    });

    startLoopRef.current = startLoop;
    stopLoopRef.current = stopLoop;
    renderSingleFrameRef.current = () => {
      const elapsed = (performance.now() - startTime) * 0.001;
      updateDimensions();
      if (isUsingFallback2D) {
        renderFallback2D(elapsed);
      } else {
        renderGL(elapsed);
      }
    };

    initGL();
    updateDimensions();

    if (activeRef.current) {
      startLoop();
    } else {
      // Draw initial static frame
      if (isUsingFallback2D) {
        renderFallback2D(0);
      } else {
        renderGL(0);
      }
    }

    const handleWindowResize = () => {
      updateDimensions();
      if (!activeRef.current && canvas) {
        const elapsed = (performance.now() - startTime) * 0.001;
        if (isUsingFallback2D) {
          renderFallback2D(elapsed);
        } else {
          renderGL(elapsed);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', handleWindowResize);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    resizeObserver.observe(canvas);

    return () => {
      startLoopRef.current = () => {};
      stopLoopRef.current = () => {};
      renderSingleFrameRef.current = () => {};

      stopLoop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleWindowResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      resizeObserver.disconnect();

      if (gl) {
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (createdVertShader) gl.deleteShader(createdVertShader);
        if (createdFragShader) gl.deleteShader(createdFragShader);
        if (program) gl.deleteProgram(program);
      }
    };
  }, []);

  // Responsive loop trigger on active prop changes
  useEffect(() => {
    if (active) {
      startLoopRef.current();
    } else {
      stopLoopRef.current();
      renderSingleFrameRef.current();
    }
  }, [active]);

  // Redraw when opacity changes while paused
  useEffect(() => {
    if (!active) {
      renderSingleFrameRef.current();
    }
  }, [opacity, active]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        ...style
      }}
    />
  );
};

export default GalaxyCanvas;
