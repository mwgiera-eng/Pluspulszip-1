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
  dotAlpha: number;
}

const TRAFFIC_COLORS = {
  flow: '#2EE6A6',
  slow: '#FFB547',
  jam: '#FF5470',
} as const;

// Absolute intensity buckets keep the signal meaning stable for drivers:
// green = moving, amber = slow/heavy, red = jammed. The backend intensity
// already follows Krakow time-of-day, weekday and road-type curves.
function getTrafficVisual(intensity: number): TrafficVisual {
  if (intensity >= 0.72) {
    return {
      color: TRAFFIC_COLORS.jam,
      glow: 5.2,
      dotAlpha: 0.95,
    };
  }

  if (intensity >= 0.48) {
    return {
      color: TRAFFIC_COLORS.slow,
      glow: 3.8,
      dotAlpha: 0.86,
    };
  }

  return {
    color: TRAFFIC_COLORS.flow,
    glow: 2.2,
    dotAlpha: 0.74,
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
  cumLen: number[];
  totalLen: number;
  intensity: number;
  visual: TrafficVisual;
  dotCount: number;
  speed: number;
  phases: number[];
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
      const res = await fetch('/api/road-traffic', { cache: 'no-store' });
      if (!res.ok) throw new Error('traffic unavailable');
      return res.json();
    },
    refetchInterval: 15000,
    enabled,
    staleTime: 10000,
  });

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

        // Moving particles remain the only traffic geometry. Wider spacing and
        // zoom-based detail caps prevent the old solid/glitchy bands.
        const dotSpacing = IS_MOBILE ? 220 : 175;
        const maxDots = IS_MOBILE ? 28 : 46;
        const density = 0.55 + intensity * 0.95;
        const dotCount = Math.min(maxDots, Math.max(2, Math.round((totalLen / dotSpacing) * density)));

        // Congestion is readable both by color and motion: flowing traffic moves
        // fastest while jammed traffic visibly crawls.
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

  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '430';
    canvas.style.mixBlendMode = 'screen';
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      canvasRef.current = null;
      return;
    }

    const dpr = IS_MOBILE
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, 2);

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
    const BRAND_PULSE_SECONDS = 1.8;
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

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      const elapsed = (now - start) / 1000;
      const pulseCycle = (elapsed % BRAND_PULSE_SECONDS) / BRAND_PULSE_SECONDS;
      const pulseBeat = (Math.sin(pulseCycle * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const pulseRingScale = 1.6 + pulseCycle * 2.3;
      const pulseRingAlpha = Math.pow(1 - pulseCycle, 1.7);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      const zoom = zoomRef.current;
      const zoomScale = Math.min(1.25, Math.max(0.5, 0.62 + (zoom - 11) * 0.1));
      const colors = [TRAFFIC_COLORS.flow, TRAFFIC_COLORS.slow, TRAFFIC_COLORS.jam];

      for (const color of colors) {
        const dots: Array<{
          x: number;
          y: number;
          baseRadius: number;
          alpha: number;
          glow: number;
        }> = [];

        for (const road of visibleRoads) {
          if (road.visual.color !== color) continue;

          const detailRatio = zoom < 11
            ? 0.45
            : zoom < 12
              ? 0.68
              : 1;
          const activeDots = Math.max(2, Math.ceil(road.dotCount * detailRatio));

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

            const baseRadius = Math.max(0.55, (0.68 + road.intensity * 0.5) * zoomScale);
            dots.push({
              x: pt.x,
              y: pt.y,
              baseRadius,
              alpha: road.visual.dotAlpha,
              glow: road.visual.glow,
            });
          }
        }

        if (!dots.length) continue;

        // Brand pulse wave: every signal expands at exactly the same phase.
        // This is deliberately independent from each particle's travel phase,
        // so the whole city appears to breathe in one PlusPuls rhythm.
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0.45, 0.65 * zoomScale);
        ctx.shadowColor = color;
        ctx.shadowBlur = (IS_MOBILE ? 1.8 : 3.2) * (0.75 + pulseBeat * 0.55);
        ctx.globalAlpha = (IS_MOBILE ? 0.16 : 0.24) * pulseRingAlpha;
        ctx.beginPath();
        for (const dot of dots) {
          const ringRadius = dot.baseRadius * pulseRingScale;
          ctx.moveTo(dot.x + ringRadius, dot.y);
          ctx.arc(dot.x, dot.y, ringRadius, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();

        // Moving particle cores. Their scale and brightness rise together on the
        // same beat, while their positions continue moving independently.
        ctx.save();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        const avgGlow = dots.reduce((sum, dot) => sum + dot.glow, 0) / dots.length;
        ctx.shadowBlur = avgGlow * zoomScale * (0.75 + pulseBeat * 0.8);
        ctx.globalAlpha = Math.min(
          0.98,
          (dots.reduce((sum, dot) => sum + dot.alpha, 0) / dots.length) * (0.72 + pulseBeat * 0.28),
        );
        ctx.beginPath();
        for (const dot of dots) {
          const radius = dot.baseRadius * (0.88 + pulseBeat * 0.34);
          ctx.moveTo(dot.x + radius, dot.y);
          ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
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
