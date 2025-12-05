import { Room, SensorReading } from "../types";

// Simulation constants
const UPDATE_INTERVAL = 3000; // 3 seconds
const FLUX_TEMP = 0.5;
const FLUX_HUMIDITY = 1.5;

class HardwareService {
  private listeners: ((roomId: string, reading: SensorReading) => void)[] = [];
  private intervalId: number | null = null;
  private activeRooms: Map<string, SensorReading> = new Map();

  constructor() {}

  // Register room for simulation
  registerRoom(room: Room) {
    if (room.currentReading) {
      this.activeRooms.set(room.id, { ...room.currentReading });
    }
  }

  startSimulation() {
    if (this.intervalId) return;
    
    this.intervalId = window.setInterval(() => {
      this.activeRooms.forEach((reading, roomId) => {
        const newReading = this.simulateDrift(reading);
        this.activeRooms.set(roomId, newReading);
        this.notifyListeners(roomId, newReading);
      });
    }, UPDATE_INTERVAL);
  }

  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onReading(callback: (roomId: string, reading: SensorReading) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners(roomId: string, reading: SensorReading) {
    this.listeners.forEach(cb => cb(roomId, reading));
  }

  private simulateDrift(current: SensorReading): SensorReading {
    // Random drift
    const tempChange = (Math.random() - 0.5) * FLUX_TEMP;
    const humidityChange = (Math.random() - 0.5) * FLUX_HUMIDITY;
    
    // Calculate simple VPD approximation
    // VPD = SVP * (1 - RH/100)
    // SVP = 0.61078 * exp(17.27 * T / (T + 237.3))
    const temp = Number((current.temp + tempChange).toFixed(1));
    const humidity = Number((current.humidity + humidityChange).toFixed(1));
    
    const svp = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
    const vpd = Number((svp * (1 - humidity / 100)).toFixed(2));

    return {
      temp,
      humidity,
      vpd: Math.max(0, vpd),
      co2: current.co2 + (Math.floor(Math.random() * 10) - 5),
      timestamp: Date.now()
    };
  }
}

export const hardwareService = new HardwareService();