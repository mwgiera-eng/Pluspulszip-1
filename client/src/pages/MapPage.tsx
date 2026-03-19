import { Sidebar } from "@/components/Sidebar";
import { MapView } from "@/components/MapView";
import { useGeolocation } from "@/hooks/use-geolocation";

export default function MapPage({ isPublic = false, publicBanner }: { isPublic?: boolean; publicBanner?: React.ReactNode }) {
  const { position, status } = useGeolocation(!isPublic);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden flex-col">
      {isPublic && publicBanner}
      <div className="flex flex-1 overflow-hidden">
        {!isPublic && <Sidebar />}
        <main className="flex-1 relative h-full">
          <div className="absolute top-4 left-4 right-4 z-[500] pointer-events-none flex justify-center lg:justify-start">
            <div className="bg-card/80 backdrop-blur-md px-6 py-2 rounded-full border border-border shadow-xl pointer-events-auto">
              <span className="text-sm font-medium flex items-center gap-2" data-testid="text-gps-status">
                <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-500 animate-pulse' : status === 'requesting' ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground'}`}></span>
                {status === 'active' ? 'GPS Active' : status === 'requesting' ? 'Acquiring GPS...' : 'Live Tracking'} — Krakow Area
              </span>
            </div>
          </div>
          <MapView driverPosition={position} />
        </main>
      </div>
    </div>
  );
}
