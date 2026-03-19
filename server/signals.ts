import type { DataSourceId, DataSourceStatus } from "../shared/copilot";
import { getEventsCacheMeta } from "./krakowEvents";
import { getAirportCacheMeta } from "./krakowAirportScraper";

const FRESHNESS_THRESHOLDS_MS: Record<DataSourceId, number> = {
  airport_flights: 30 * 60 * 1000,
  events: 6 * 60 * 60 * 1000,
  zone_heat: 15 * 60 * 1000,
  gps_location: 2 * 60 * 1000,
  weather: 30 * 60 * 1000,
  driver_history: 24 * 60 * 60 * 1000,
};

const RELIABILITY_WEIGHTS: Record<DataSourceId, number> = {
  airport_flights: 0.8,
  events: 0.7,
  zone_heat: 0.85,
  gps_location: 1.0,
  weather: 0.6,
  driver_history: 0.5,
};

const ALL_SOURCE_IDS: DataSourceId[] = [
  "airport_flights",
  "events",
  "zone_heat",
  "gps_location",
  "weather",
  "driver_history",
];

class SignalService {
  private gpsLastUpdated: number | null = null;
  private weatherLastUpdated: number | null = null;
  private driverHistoryLastUpdated: number | null = null;
  private zoneHeatLastUpdated: number | null = null;

  updateGps(): void {
    this.gpsLastUpdated = Date.now();
  }

  updateWeather(): void {
    this.weatherLastUpdated = Date.now();
  }

  updateDriverHistory(): void {
    this.driverHistoryLastUpdated = Date.now();
  }

  updateZoneHeat(): void {
    this.zoneHeatLastUpdated = Date.now();
  }

  getSignalStatus(sourceId: DataSourceId): DataSourceStatus {
    const now = Date.now();
    const threshold = FRESHNESS_THRESHOLDS_MS[sourceId];
    const weight = RELIABILITY_WEIGHTS[sourceId];

    let lastUpdated: number | null = null;
    let isAvailable = false;
    let degradedReason: string | null = null;

    switch (sourceId) {
      case "airport_flights": {
        const meta = getAirportCacheMeta();
        lastUpdated = meta.lastFetchedAt;
        isAvailable = meta.arrivalsCount > 0 || meta.departuresCount > 0;
        if (!isAvailable) {
          degradedReason = "No airport flight data available";
        }
        break;
      }
      case "events": {
        const meta = getEventsCacheMeta();
        lastUpdated = meta.lastFetchedAt;
        isAvailable = meta.cacheSize > 0 || lastUpdated !== null;
        if (meta.lastFetchFailed) {
          degradedReason = "Last events fetch failed";
        }
        if (!isAvailable && !meta.lastFetchFailed) {
          degradedReason = "No events data fetched yet";
        }
        break;
      }
      case "zone_heat": {
        lastUpdated = this.zoneHeatLastUpdated;
        isAvailable = lastUpdated !== null;
        if (!isAvailable) {
          degradedReason = "Zone heat data not yet computed";
        }
        break;
      }
      case "gps_location": {
        lastUpdated = this.gpsLastUpdated;
        isAvailable = lastUpdated !== null;
        if (!isAvailable) {
          degradedReason = "No GPS position received from driver";
        }
        break;
      }
      case "weather": {
        lastUpdated = this.weatherLastUpdated;
        isAvailable = lastUpdated !== null;
        if (!isAvailable) {
          degradedReason = "Weather data not available";
        }
        break;
      }
      case "driver_history": {
        lastUpdated = this.driverHistoryLastUpdated;
        isAvailable = lastUpdated !== null;
        if (!isAvailable) {
          degradedReason = "No driver history loaded";
        }
        break;
      }
    }

    let isFresh = false;
    let staleSinceMinutes: number | null = null;

    if (lastUpdated !== null) {
      const age = now - lastUpdated;
      isFresh = age <= threshold;
      if (!isFresh) {
        staleSinceMinutes = Math.round((age - threshold) / 60000);
        if (!degradedReason) {
          degradedReason = `Data is ${staleSinceMinutes} min past freshness threshold`;
        }
      }
    } else {
      isFresh = false;
      staleSinceMinutes = null;
    }

    return {
      sourceId,
      lastUpdated: lastUpdated !== null ? new Date(lastUpdated).toISOString() : null,
      isFresh,
      isAvailable,
      staleSinceMinutes,
      degradedReason,
      reliabilityWeight: weight,
    };
  }

  getAllSignalStatuses(): DataSourceStatus[] {
    return ALL_SOURCE_IDS.map((id) => this.getSignalStatus(id));
  }

  getFreshSourceCount(): number {
    return this.getAllSignalStatuses().filter((s) => s.isFresh).length;
  }

  getAvailableSourceCount(): number {
    return this.getAllSignalStatuses().filter((s) => s.isAvailable).length;
  }
}

export const signalService = new SignalService();
