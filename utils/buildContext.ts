import type { PlantBatch, Room } from '../types';

const DAY_MS = 86400000;

const round1 = (value: number) => Math.round(value * 10) / 10;

const formatAge = (timestamp: number) => {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = round1(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${round1(hours / 24)}d ago`;
};

export function buildFacilityContext(rooms?: Room[], batches?: PlantBatch[]): string {
  const roomList = rooms ?? [];
  const activeBatches = (batches ?? []).filter(batch => batch.isActive);

  if (roomList.length === 0 && activeBatches.length === 0) {
    return '';
  }

  const lines: string[] = [];

  if (roomList.length > 0) {
    lines.push('### Rooms');
    for (const room of roomList) {
      const reading = room.currentReading;
      const sensorSummary = reading
        ? `${round1(reading.temp)}°C, ${round1(reading.humidity)}% RH, ${round1(reading.vpd)} kPa VPD, ${round1(reading.co2)} ppm CO2 (${formatAge(reading.timestamp)})`
        : 'no current reading';
      lines.push(`- ${room.name}: ${room.status}; ${sensorSummary}`);
    }
  }

  if (activeBatches.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('### Active batches');
    for (const batch of activeBatches) {
      const daySinceStart = Math.floor((Date.now() - batch.startDate) / DAY_MS);
      lines.push(`- ${batch.name}: ${batch.strain}, ${batch.type}, ${batch.stage}, day ${daySinceStart}, ${batch.plantedCount} planted`);
    }
  }

  return lines.join('\n');
}
