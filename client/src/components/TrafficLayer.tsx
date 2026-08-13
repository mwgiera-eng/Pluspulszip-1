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

const KRAKOW_PULSE_ORIGIN: [number, number] = [50.0647, 19.945];
const PERSPECTIVE_Y = 0.56;
const RADIAL_WAVE_COUNT = 3;

interface RoadTrafficResponse {
  roads: RoadSegment[];
  generatedAt: string;
  hour: number;
  baseLevel: number;
}

interface TrafficVisual {
  color: string;
  dotAlpha: number;
  radiusScale: number;
}

const TRAFFIC_COLORS = {
  flow: '#2EE6A6',
  slow: '#FFB547',
  jam: '#FF5470',
} as const;

function getTrafficVisual(intensity: number): TrafficVisual {
  if (intensity >= 0.7) {
    return { color: TRAFFIC_COLORS.jam, dotAlpha: 0.98, radiusScale: 1.18 };
  }
  if (intensity >= 0.42) {
    return { color: TRAFFIC_COLORS.slow, dotAlpha: 0.94, radiusScale: 1.08 };
  }
  return { color: TRAFFIC_COLORS.flow, dotAlpha: 0.9, radiusScale: 1 };
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

interface RenderDot {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  wave: number;
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
  const baseLevelRef = useRef(0);

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

    baseLevelRef.current = normalizeIntensity(data.baseLevel);
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
        const dotSpacing = IS_MOBILE ? 200 : 145;
        const maxDots = IS_MOBILE ? 32 : 60;
        const density = 0.68 + intensity * 0.82;
        const dotCount = Math.min(
          maxDots,
          Math.max(2, Math.round((totalLen / dotSpacing) * density)),
        );

        const speed = 52 - 34 * intensity;
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
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      canvasRef.current = null;
      return;
    }

    const dpr = IS_MOBILE
      ? Math.min(window.devicePixelRatio || 1, 1.75)
      : Math.min(window.devicePixelRatio || 1, 2.75);

    const resize = () => {
      const size = map.getSize();
      canvas.width = Math.max(1, Math.floor(size.x * dpr));
      canvas.height = Math.max(1, Math.floor(size.y * dpr));
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
    const boundsPad = 34;
    const FRAME_INTERVAL = IS_MOBILE ? 1000 / 24 : 1000 / 45;
    let lastFrame = 0;

    let visibleRoads: PreparedRoad[] = [];
    const refreshVisible = () => {
      const zoom = map.getZoom();
      zoomRef.current = zoom;
      const viewBounds = map.getBounds().pad(0.1);
      const maxVisibleRoads = zoom < 11 ? 38 : zoom < 12.5 ? 62 : 100;

      visibleRoads = preparedRef.current
        .filter((r) => r.totalLen >= 50 && viewBounds.intersects(r.bounds))
        .slice(0, IS_MOBILE ? Math.min(maxVisibleRoads, 44) : maxVisibleRoads);
    };

    refreshVisible();
    refreshVisibleRef.current = refreshVisible;
    map.on('move', refreshVisible);
    map.on('zoom', refreshVisible);
    map.on('moveend', refreshVisible);
    map.on('zoomend', refreshVisible);

    const getWaveState = (elapsed: number, center: L.Point, size: L.Point) => {
      const trafficLevel = baseLevelRef.current;
      const seconds = 3.2 - trafficLevel * 0.75;
      const maxRadius = Math.hypot(size.x, size.y / PERSPECTIVE_Y) * 0.72;
      const minRadius = Math.max(34, Math.min(size.x, size.y) * 0.055);
      const span = Math.max(1, maxRadius - minRadius);
      const originPhase = (elapsed / seconds) % 1;
      const phases = Array.from({ length: RADIAL_WAVE_COUNT }, (_, index) =>
        (originPhase + index / RADIAL_WAVE_COUNT) % 1,
      );

      return { center, phases, minRadius, span, maxRadius, trafficLevel };
    };

    const drawRadialField = (
      waveState: ReturnType<typeof getWaveState>,
      zoomScale: number,
    ) => {
      const { center, phases, minRadius, span, trafficLevel } = waveState;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(center.x, center.y);
      ctx.scale(1, PERSPECTIVE_Y);

      const floorRadius = Math.max(90, Math.min(520, span * 0.58));
      const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, floorRadius);
      floor.addColorStop(0, `rgba(46, 230, 166, ${0.035 + trafficLevel * 0.035})`);
      floor.addColorStop(0.42, `rgba(46, 230, 166, ${0.018 + trafficLevel * 0.022})`);
      floor.addColorStop(1, 'rgba(46, 230, 166, 0)');
      ctx.fillStyle = floor;
      ctx.beginPath();
      ctx.arc(0, 0, floorRadius, 0, Math.PI * 2);
      ctx.fill();

      for (const phase of phases) {
        const radius = minRadius + phase * span;
        const fade = Math.pow(1 - phase, 1.22);
        const energy = (0.055 + trafficLevel * 0.085) * fade;

        ctx.strokeStyle = `rgba(46, 230, 166, ${energy})`;
        ctx.lineWidth = Math.max(0.7, (1.6 - phase * 0.75) * zoomScale / PERSPECTIVE_Y);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(125, 255, 214, ${energy * 0.38})`;
        ctx.lineWidth = Math.max(1.4, (4.2 - phase * 2.4) * zoomScale / PERSPECTIVE_Y);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const waveInfluenceAt = (
      x: number,
      y: number,
      waveState: ReturnType<typeof getWaveState>,
    ) => {
      const dx = x - waveState.center.x;
      const dy = (y - waveState.center.y) / PERSPECTIVE_Y;
      const radialDistance = Math.hypot(dx, dy);
      const sigma = Math.max(18, waveState.maxRadius * 0.025);
      let influence = 0;

      for (const phase of waveState.phases) {
        const radius = waveState.minRadius + phase * waveState.span;
        const delta = radialDistance - radius;
        const hit = Math.exp(-(delta * delta) / (2 * sigma * sigma));
        influence = Math.max(influence, hit * Math.pow(1 - phase, 0.28));
      }

      return influence;
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
      const zoomScale = Math.min(1.38, Math.max(0.62, 0.76 + (zoom - 11) * 0.1));
      const pulseOrigin = map.latLngToContainerPoint(
        L.latLng(KRAKOW_PULSE_ORIGIN[0], KRAKOW_PULSE_ORIGIN[1]),
      );
      const waveState = getWaveState(elapsed, pulseOrigin, size);
      drawRadialField(waveState, zoomScale);

      const colors = [TRAFFIC_COLORS.flow, TRAFFIC_COLORS.slow, TRAFFIC_COLORS.jam];
      for (const color of colors) {
        const dots: RenderDot[] = [];

        for (const road of visibleRoads) {
          if (road.visual.color !== color) continue;
          const detailRatio = zoom < 11 ? 0.52 : zoom < 12 ? 0.76 : 1;
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

            const wave = waveInfluenceAt(pt.x, pt.y, waveState);
            const radius = Math.max(
              0.72,
              (0.92 + road.intensity * 0.66) * road.visual.radiusScale * zoomScale,
            );
            dots.push({ x: pt.x, y: pt.y, radius, alpha: road.visual.dotAlpha, wave });
          }
        }

        if (!dots.length) continue;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.11;
        ctx.beginPath();
        for (const dot of dots) {
          const haloRadius = dot.radius * (2.15 + dot.wave * 2.15);
          ctx.moveTo(dot.x + haloRadius, dot.y);
          ctx.arc(dot.x, dot.y, haloRadius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.min(
          0.99,
          dots.reduce((sum, dot) => sum + dot.alpha, 0) / dots.length,
        );
        ctx.beginPath();
        for (const dot of dots) {
          const coreRadius = dot.radius * (0.94 + dot.wave * 0.42);
          ctx.moveTo(dot.x + coreRadius, dot.y);
          ctx.arc(dot.x, dot.y, coreRadius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.globalAlpha = 0.58;
        ctx.beginPath();
        for (const dot of dots) {
          const highlightRadius = Math.max(0.34, dot.radius * (0.24 + dot.wave * 0.05));
          ctx.moveTo(dot.x + highlightRadius, dot.y);
          ctx.arc(dot.x, dot.y, highlightRadius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
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
