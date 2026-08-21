export type HeatCell = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  score: number;
};

export type HeatResponse = {
  generatedAt: string;
  radius: number;
  cells: HeatCell[];
};

export type DevicePosition = {
  lat: number;
  lng: number;
  accuracy: number;
};

