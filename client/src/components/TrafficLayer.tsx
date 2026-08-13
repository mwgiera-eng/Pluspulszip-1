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

interface TrafficVisual {
  color: string;
  glow: number;
  roadAlpha: number;
  dotAlpha: number;
  tailAlpha: number;
  label: 'flow' | 'slow' | 'jam';
}

const TRAFFIC_COLORS = {
  flow: '#2EE6A6',
  slow: '#FFB547',
  jam: '#FF5470',
} as const;

// Absolute intensity buckets make the layer easier to read for drivers:
// green = moving, amber = slow/heavy, red = jammed. The backend already
// moves intensity with Krakow time-of-day, so these colors reflect the
// current traffic curve instead of only relative percentiles per refresh.
function getTrafficVisual(intensity: number): TrafficVisual {
  if (intensity >= 0.72) {
    return {
      color: TRAFFIC_COLORS.jam,
      glow: 5.5,
      roadAlpha: 0.38,
      dotAlpha: 0.92,
      tailAlpha: 0.34,
      label: 'jam',
    };
  }

  if (intensity >= 0.48) {
    return {
      color: TRAFFIC_COLORS.slow,
      glow: 4,
      roadAlpha: 0.3,
      dotAlpha: 0.86,
      tailAlpha: 0.26,
      label: 'slow',
    };
  }

  return {
    color: TRAFFIC_COLORS.flow,
    glow: 2.4,
    roadAlpha: 0.18,
    dotAlpha: 0.72,
    tailAlpha: 0.15,
    label: 'flow',
  };
}

const HIGHWAY_PRIORITY: Record<string, number> = {
  motorway: 5,
  trunk: 4,
  primary: 3,
  secondary: 2,
  tertiary: 1,
};

interface PreparedRoad {
  latlngs: L.LatLng[];
  bounds: L.LatLngBounds;
  cumLen: number[]; // cumulative length in metres per vertex
  totalLen: number;
  intensity: number;
  visual: TrafficVisual;
  dotCount: number;
  speed: number; // metres per second along the line
  phases: number[]; // 0..1 starting offsets
  priority: number;
}

function normalizeIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function trafficPriority(road: RoadSegment): number {
  const highway = HIGHWAY_PRIORITY[road.highway] ?? 0;
  return highway * 10 + normalizeIntensity(road.intensity) * 12;
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

  // Prepare road geometry data whenever new traffic data arrives.
  useEffect(() => {
    if (!data) return;

    preparedRef.current = data.roads
      .filter((r) => r.geometry.length >= 2)
      .flatMap((r) => {
        const latlngs = r.geometry.map(([lat, lng]) => L.latLng(lat, lng));
        const cumLen: number[] = [0];
        for (let i = 1; i < latlngs.length; i++) {
          cumLen.push(cumLen[i - 1] + latlngs[i - 1].distanceTo(latlngs[i]));
        }

        const totalLen = cumLen[cumLen.length - 1];
        if (totalLen < 50) return [];

        const intensity = normalizeIntensity(r.intensity);
        const visual = getTrafficVisual(intensity);

        // Keep the signal field readable: density rises with traffic intensity,
        // but we use a wider spacing than before so zoomed-out views do not turn
        // into a bright solid band near the bottom edge of the map.
        const dotSpacing = IS_MOBILE ? 220 : 175;
        const maxDots = IS_MOBILE ? 28 : 46;
        const density = 0.55 + intensity * 0.95;
        const dotCount = Math.min(maxDots, Math.max(2, Math.round((totalLen / dotSpacing) * density)));

        // Heavier traffic moves visibly slower. Flowing roads move fast enough
        // to feel live without producing visual noise.
        const speed = 34 - 25 * intensity;
        const phases = Array.from({ length: dotCount }, (_, i) =>
          (i / dotCount + ((r.id * 0.618) % 1)) % 1,
        );

        return [{
          latlngs,
          bounds: L.latLngBounds(latlngs),
          cumLen,
          totalLen,
          intensity,
          visual,
          dotCount,
          speed,
          phases,
          priority: trafficPriority(r),
        }];
      })
      .sort((a, b) => b.priority - a.priority);

    refreshVisibleRef.current();
  }, [data]);

  // Canvas overlay + animation loop.
  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '430'; // above heat polygons, below markers and controls
    canvas.style.mixBlendMode = 'screen';
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cap backing-store resolution on mobile: 3x DPR canvases burn fill-rate
    // for dots that are ~2px anyway.
    const dpr = IS_MOBILE ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2);

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
      let lo = 1;
      let hi = cumLen.length - 1;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (cumLen[mid] < distM) lo = mid + 1;
        else hi = mid;
      }
      const i = lo;
      if (i >= cumLen.length) return latlngs[latlngs.length - 1];
      const segLen = cumLen[i] - cumLen[i - 1] || 1;
      const t = (distM - cumLen[i - 1]) / segLen;
      return L.latLng(
        latlngs[i - 1].lat + (latlngs[i].lat - latlngs[i - 1].lat) * t,
        latlngs[i - 1].lng + (latlngs[i].lng - latlngs[i - 1].lng) * t,
      );
    };

    const start = performance.now();
    const boundsPad = 28;
    const FRAME_INTERVAL = IS_MOBILE ? 1000 / 20 : 1000 / 30;
    let lastFrame = 0;

    let visibleRoads: PreparedRoad[] = [];
    const refreshVisible = () => {
      const zoom = map.getZoom();
      zoomRef.current = zoom;
      const viewBounds = map.getBounds().pad(0.08);
      const maxVisibleRoads = zoom < 11
        ? 34
        : zoom < 12.5
          ? 54
          : 90;

      visibleRoads = preparedRef.current
        .filter((r) => r.totalLen >= 50 && viewBounds.intersects(r.bounds))
        .slice(0, IS_MOBILE ? Math.min(maxVisibleRoads, 40) : maxVisibleRoads);
    };

    refreshVisible();
    refreshVisibleRef.current = refreshVisible;
    map.on('move', refreshVisible);
    map.on('zoom', refreshVisible);
    map.on('moveend', refreshVisible);
    map.on('zoomend', refreshVisible);

    const drawRoadSpines = (roads: PreparedRoad[], zoomScale: number) => {
      const groups = [TRAFFIC_COLORS.flow, TRAFFIC_COLORS.slow, TRAFFIC_COLORS.jam];
      for (const color of groups) {
        const roadGroup = roads.filter((r) => r.visual.color === color);
        if (!roadGroup.length) continue;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = color === TRAFFIC_COLORS.flow ? 1.2 : 3.5;
        ctx.beginPath();

        let alpha = 0;
        let count = 0;
        for (const road of roadGroup) {
          alpha += road.visual.roadAlpha;
          count++;
          road.latlngs.forEach((ll, index) => {
            const pt = map.latLngToContainerPoint(ll);
            if (index === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
        }

        ctx.globalAlpha = Math.min(0.42, Math.max(0.12, alpha / Math.max(1, count)));
        ctx.lineWidth = Math.max(0.6, (color === TRAFFIC_COLORS.flow ? 0.75 : 1.15) * zoomScale);
        ctx.stroke();
        ctx.restore();
      }
    };

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      const elapsed = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      const zoom = zoomRef.current;
      const zoomScale = Math.min(1.25, Math.max(0.5, 0.62 + (zoom - 11) * 0.1));
      drawRoadSpines(visibleRoads, zoomScale);

      const colors = [TRAFFIC_COLORS.flow, TRAFFIC_COLORS.slow, TRAFFIC_COLORS.jam];
      for (const color of colors) {
        const tails: Array<{ from: L.Point; to: L.Point; alpha: number }> = [];
        const dots: Array<{ x: number; y: number; radius: number; alpha: number }> = [];

        for (const road of visibleRoads) {
          if (road.visual.color !== color) continue;

          // At low zoom, skip a few phases rather than shrinking them into a
          // glowing carpet. More detail comes back naturally when drivers zoom in.
          const detailRatio = zoom < 11
            ? 0.45
            : zoom < 12
              ? 0.68
              : 1;
          const activeDots = Math.max(2, Math.ceil(road.dotCount * detailRatio));
          const tailLength = Math.min(20, Math.max(5, road.speed * (road.intensity >= 0.48 ? 0.6 : 0.38)));

          for (let d = 0; d < activeDots; d++) {
            const phase = road.phases[Math.floor((d / activeDots) * road.phases.length)] ?? 0;
            const dist =
              ((phase * road.totalLen + elapsed * road.speed) % road.totalLen + road.totalLen) % road.totalLen;
            const ll = pointAt(road, dist);
            const pt = map.latLngToContainerPoint(ll);

            if (
              pt.x < -boundsPad || pt.y < -boundsPad ||
              pt.x > size.x + boundsPad || pt.y > size.y + boundsPad
            ) continue;

            const pulse = 0.07 * Math.sin(elapsed * 4.5 + phase * Math.PI * 2);
            const radius = Math.max(0.5, (0.64 + road.intensity * 0.5 + pulse) * zoomScale);
            const tailDist = dist - tailLength;

            if (tailDist > 0 && (road.intensity >= 0.35 || zoom >= 12)) {
              const tail = map.latLngToContainerPoint(pointAt(road, tailDist));
              tails.push({ from: tail, to: pt, alpha: road.visual.tailAlpha });
            }

            dots.push({ x: pt.x, y: pt.y, radius, alpha: road.visual.dotAlpha });
          }
        }

        if (!dots.length && !tails.length) continue;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = (color === TRAFFIC_COLORS.flow ? 1.8 : 4.5) * zoomScale;
        ctx.lineWidth = Math.max(0.35, 0.55 * zoomScale);
        ctx.lineCap = 'round';

        ctx.globalAlpha = tails.length
          ? Math.min(0.32, tails.reduce((sum, tail) => sum + tail.alpha, 0) / tails.length)
          : 0;
        ctx.beginPath();
        for (const tail of tails) {
          ctx.moveTo(tail.from.x, tail.from.y);
          ctx.lineTo(tail.to.x, tail.to.y);
        }
        ctx.stroke();

        ctx.globalAlpha = dots.length
          ? Math.min(0.92, dots.reduce((sum, dot) => sum + dot.alpha, 0) / dots.length)
          : 0;
        ctx.beginPath();
        for (const dot of dots) {
          ctx.moveTo(dot.x + dot.radius, dot.y);
          ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off('resize', resize);
      map.off('move', refreshVisible);
      map.off('zoom', refreshVisible);
      map.off('moveend', refreshVisible);
      map.off('zoomend', refreshVisible);
      refreshVisibleRef.current = () => {};
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, enabled]);

  return null;
}
