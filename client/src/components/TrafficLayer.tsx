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

interface RoadTrafficResponse {
  roads: RoadSegment[];
  generatedAt: string;
  hour: number;
  baseLevel: number;
}

// Uniform brand green — dots differ only in speed/density, not color
const DOT_COLOR = '#2EE6A6';

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

  const { data } = useQuery<RoadTrafficResponse>({
    queryKey: ['/api/road-traffic'],
    queryFn: async () => {
      const res = await fetch('/api/road-traffic', { credentials: 'include' });
      if (!res.ok) throw new Error('traffic unavailable');
      return res.json();
    },
    refetchInterval: 60000,
    enabled,
    staleTime: 55000,
  });

  // Prepare road geometry data whenever new traffic data arrives
  useEffect(() => {
    if (!data) return;
    preparedRef.current = data.roads
      .filter((r) => r.geometry.length >= 2)
      .map((r) => {
        const latlngs = r.geometry.map(([lat, lng]) => L.latLng(lat, lng));
        const cumLen: number[] = [0];
        for (let i = 1; i < latlngs.length; i++) {
          cumLen.push(cumLen[i - 1] + latlngs[i - 1].distanceTo(latlngs[i]));
        }
        const totalLen = cumLen[cumLen.length - 1];
        // dot density: 1 dot per ~250m at full intensity, min 1
        const dotCount = Math.max(1, Math.round((totalLen / 250) * r.intensity));
        // heavier traffic = slower dots (congestion): 14 m/s free flow → 3 m/s jammed
        const speed = 14 - 11 * r.intensity;
        const phases = Array.from({ length: dotCount }, (_, i) =>
          (i / dotCount + ((r.id * 0.618) % 1)) % 1,
        );
        return {
          latlngs,
          bounds: L.latLngBounds(latlngs),
          cumLen,
          totalLen,
          intensity: r.intensity,
          color: DOT_COLOR,
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
    canvas.style.zIndex = '450'; // above overlay pane (400), below markers (600)
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const size = map.getSize();
      canvas.width = size.x * devicePixelRatio;
      canvas.height = size.y * devicePixelRatio;
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
    const FRAME_INTERVAL = 1000 / 30; // cap at 30 fps
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
    map.on('moveend zoomend', refreshVisible);

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      if (now - lastFrame < FRAME_INTERVAL) return;
      lastFrame = now;

      const elapsed = (now - start) / 1000; // seconds
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const size = map.getSize();

      // single path batch — all dots share one uniform color
      ctx.fillStyle = DOT_COLOR;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();

      for (const road of visibleRoads) {
        for (let d = 0; d < road.dotCount; d++) {
          const dist =
            ((road.phases[d] * road.totalLen + elapsed * road.speed) %
              road.totalLen + road.totalLen) % road.totalLen;
          const ll = pointAt(road, dist);
          const pt = map.latLngToContainerPoint(ll);
          if (
            pt.x < -boundsPad || pt.y < -boundsPad ||
            pt.x > size.x + boundsPad || pt.y > size.y + boundsPad
          ) continue;

          ctx.moveTo(pt.x + 1.6, pt.y);
          ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off('resize', resize);
      map.off('moveend zoomend', refreshVisible);
      refreshVisibleRef.current = () => {};
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map, enabled]);

  return null;
}
