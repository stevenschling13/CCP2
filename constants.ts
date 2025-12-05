import { PlantBatch, Room, GrowStage, StrainType } from './types';

export const APP_NAME = "Cultivator's CoPilot";

export const MOCK_BATCHES: PlantBatch[] = [
  {
    id: 'b1',
    name: 'Blue Dream Auto',
    strain: 'Blue Dream',
    type: StrainType.HYBRID,
    stage: GrowStage.FLOWERING,
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 45, // 45 days ago
    plantedCount: 4,
    isActive: true
  },
  {
    id: 'b2',
    name: 'Gorilla Glue #4',
    strain: 'GG4',
    type: StrainType.INDICA,
    stage: GrowStage.VEGETATIVE,
    startDate: Date.now() - 1000 * 60 * 60 * 24 * 20, // 20 days ago
    plantedCount: 6,
    isActive: true
  }
];

export const MOCK_ROOMS: Room[] = [
  {
    id: 'r1',
    name: 'Flower Tent A',
    status: 'NOMINAL',
    currentReading: {
      temp: 24.5,
      humidity: 45,
      vpd: 1.2,
      co2: 1200,
      timestamp: Date.now()
    }
  },
  {
    id: 'r2',
    name: 'Veg Tent B',
    status: 'WARNING', // Simulated high humidity
    currentReading: {
      temp: 26.0,
      humidity: 75,
      vpd: 0.6,
      co2: 450,
      timestamp: Date.now()
    }
  }
];

export const SYSTEM_INSTRUCTION_GROWER = `
You are an expert master grower and botanist named "CoPilot". 
Your goal is to assist in indoor cultivation. 
You provide concise, scientific, and actionable advice.
When analyzing images, look for nutrient deficiencies (Nitrogen, Cal-Mag, etc.), pests (Spider mites, Thrips), and environmental stress (Light burn, Wind burn).
Format responses using markdown.
`;

export const BRIEFING_PROMPT = `
Analyze the provided sensor data and plant batch status. 
Return a JSON object with the following structure:
{
  "status": "OPTIMAL" | "ATTENTION" | "CRITICAL",
  "summary": "One sentence summary of facility status.",
  "actionItems": ["Action 1", "Action 2"]
}
`;
