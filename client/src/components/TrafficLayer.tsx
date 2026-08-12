import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';

interface RoadSegment {
  id: number;
  name: string;
  highway: string;
  geometry: [number, number][];
  intensity: number;
}

const IS_MOBILE =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches ||
    (navigator.hardwareConcurrency ?? 8) <= 4);
interface RoadTrafficResponse {
  roads: RoadSegment[];
  generatedAt: string;
  hour: number;
  baseLevel: number;
}

// Dot color: green almost everywhere; orange/red reserved for the few genuinely congested roads.
// Thresholds are percentile-based per data refresh (top ~5% red, next ~10% orange) with an
// absolute floor so quiet hours stay fully green.
function makeDotColor(intensities: number[]): (intensity: number) => string {
  const sorted = intensities.slice().sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 1;
  const redAt = Math.max(0.9, pct(0.95));
  const orangeAt = Math.max(0.75, pct(0.85));
  return (intensity: number) => {
    if (intensity >= redAt) return '#FF5470';   // jammed — top of the distribution only
    if (intensity >= orangeAt) return '#FFB547'; // heavy
    return '#2EE6A6';                            // flowing (default green)
  };
}

interface PreparedRoad {
  latlngs: L.LatLng[];
  bounds: L.LatLngBounds;
  cumLen: number[]; // cumulative length in metres per vertex
  totalLen: number;
  intensity: number;
  color: string;
  dotCount: number;
  speed: number; // metres per second along the line
  phases: number[]; // 0..1 starting offsets
}

export function TrafficLayer({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const preparedRef = useRef<PreparedRoad[]>([]);
  const refreshVisibleRef = useRef<() => void>(() => {});
  const zoomRef = useRef<number>(map.getZoom());

  const { data } = useQuery<RoadTrafficResponse>({
    queryKey: ['/api/road-traffic'],
    queryFn: async () => {
      const res = await fetch('/api/road-traffic', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('traffic unavailable');
      return res.json();
    },
    refetchInterval: 15000,
    enabled,
    staleTime: 10000,
  });

  // Prepare road geometry data whenever new traffic data arrives
  useEffect(() => {
    if (!data) return;
    const dotColor = makeDotColor(data.roads.map((r) => r.intensity));
    preparedRef.current = data.roads
      .filter((r) => r.geometry.length >= 2)
      .map((r) => {
        const latlngs = r.geometry.map(([lat, lng]) => L.latLng(lat, lng));
        const cumLen: number[] = [0];
        for (let i = 1; i < latlngs.length; i++) {
          cumLen.push(cumLen[i - 1] + latlngs[i - 1].distanceTo(latlngs[i]));
        }
        const totalLen = cumLen[cumLen.length - 1];
        // Fine-grained signals: many tiny beads, with density driven by traffic intensity.
        const dotSpacing = IS_MOBILE ? 130 : 95;
        const dotCount = Math.min(
          IS_MOBILE ? 42 : 78,
          Math.max(3, Math.round((totalLen / dotSpacing) * (0.42 + r.intensity * 0.85))),
        );
        // Heavier traffic moves slower; clear roads keep a steady flow.
        const speed = 30 - 23 * r.intensity;
        const phases = Array.from({ length: dotCount }, (_, i) =>
          (i / dotCount + ((r.id * 0.618) % 1)) % 1,
        );
        return {
          latlngs,
          bounds: L.latLngBounds(latlngs),
          cumLen,
          totalLen,
          intensity: r.intensity,
          color: dotColor(r.intensity),
          dotCount,
          speed,
          phases,
        };
      });
    refreshVisibleRef.current();
  }, [data]);

  // Canvas overlay + animation loop
  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '430'; // above heat polygons, below markers and controls
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d')!;

    // Cap backing-store resolution on mobile: 3x DPR canvases burn fill-rate
    // for dots that are ~2px anyway.
    const dpr = IS_MOBILE ? Math.min(devicePixelRatio, 1.5) : devicePixelRatio;

    const resize = () => {
      const size = map.getSize();
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
    };
    resize();
    map.on('resize', resize);

    const pointAt = (road: PreparedRoad, distM: number): L.LatLng => {
      const { latlngs, cumLen } = road;
      // binary search would be nicer; linear is fine for <100 vertices
      let i = 1;
      while (i < cumLen.length && cumLen[i] < distM) i++;
      if (i >= cumLen.length) return latlngs[latlngs.length - 1];
      const segLen = cumLen[i] - cumLen[i - 1] || 1;
      const t = (distM - cumLen[i - 1]) / segLen;
      return L.latLng(
        latlngs[i - 1].lat + (latlngs[i].lat - latlngs[i - 1].lat) * t,
        latlngs[i - 1].lng + (latlngs[i].lng - latlngs[i - 1].lng) * t,
      );
    };

    const start = performance.now();
    const boundsPad = 40; // px margin for per-dot culling
    const FRAME_INTERVAL = IS_MOBILE ? 1000 / 20 : 1000 / 30; // 20 fps on mobile, 30 desktop
    let lastFrame = 0;

    // Viewport-level road culling, refreshed only when the map moves
    let visibleRoads: PreparedRoad[] = [];
    const refreshVisible = () => {
      const viewBounds = map.getBounds().pad(0.1);
      visibleRoads = preparedRef.current.filter(
        (r) => r.totalLen >= 50 && viewBounds.intersects(r.bounds),
      );
    };
    refreshVisible();
    refreshVisibleRef.current = refreshVisible;
    const refreshZoom = () => {
      zoomRef.current = map.getZoom();
      refreshVisible();
    };
    map.on('moveend', refreshVisible);
    map.on('zoomend', refreshZoom);

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      const elapsed = (now - start) / 1000; // seconds
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const size = map.getSize();

      // batch dots per congestion color (one path per color)
      ctx.globalCompositeOperation = 'source-over';
      const colors = ['#2EE6A6', '#FFB547', '#FF5470'];
      const zoom = zoomRef.current;
      const zoomScale = Math.min(1.45, Math.max(0.9, 1 + (zoom - 13) * 0.035));
      const repeatCount = Math.min(3, Math.max(1, Math.round(1 + (zoom - 13) * 0.45)));
      for (const color of colors) {
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = (IS_MOBILE ? 2 : 4) * zoomScale;
        ctx.lineWidth = (IS_MOBILE ? 0.42 : 0.56) * zoomScale;
        ctx.lineCap = 'round';

        const tails: Array<{ from: L.Point; to: L.Point }> = [];
        const dots: Array<{ x: number; y: number; radius: number; halo: number }> = [];
        for (const road of visibleRoads) {
          if (road.color !== color) continue;
          const tailLength = Math.min(22, Math.max(7, road.speed * 0.5));
          for (let d = 0; d < road.dotCount; d++) {
            for (let repeat = 0; repeat < repeatCount; repeat++) {
              const repeatOffset = (repeat * road.totalLen) / Math.max(1, road.dotCount * repeatCount);
              const dist =
                ((road.phases[d] * road.totalLen + repeatOffset + elapsed * road.speed) %
                  road.totalLen + road.totalLen) % road.totalLen;
              const ll = pointAt(road, dist);
              const pt = map.latLngToContainerPoint(ll);
              if (
                pt.x < -boundsPad || pt.y < -boundsPad ||
                pt.x > size.x + boundsPad || pt.y > size.y + boundsPad
              ) continue;

              const tailDist = dist - tailLength;
              const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5 + road.phases[d] * Math.PI * 2 + repeat * 1.7);
              if (tailDist > 0) {
                const tail = map.latLngToContainerPoint(pointAt(road, tailDist));
                tails.push({ from: tail, to: pt });
              }
              dots.push({
                x: pt.x,
                y: pt.y,
                radius: Math.max(0.68, (0.78 + road.intensity * 0.36) * zoomScale),
                halo: (2.8 + road.intensity * 1.8 + pulse * 1.2) * zoomScale,
              });
            }
          }
        }

        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        for (const tail of tails) {
          ctx.moveTo(tail.from.x, tail.from.y);
          ctx.lineTo(tail.to.x, tail.to.y);
        }
        ctx.stroke();

        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        for (const dot of dots) {
          ctx.moveTo(dot.x + dot.halo, dot.y);
          ctx.arc(dot.x, dot.y, dot.halo, 0, Math.PI * 2);
        }
        ctx.fill();

        ctx.globalAlpha = 0.86;
        ctx.beginPath();
        for (const dot of dots) {
          ctx.moveTo(dot.x + dot.radius, dot.y);
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off('resize', resize);
      map.off('moveend', refreshVisible);
      map.off('zoomend', refreshZoom);
      refreshVisibleRef.current = () => {};
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, enabled]);

  return null;
}
