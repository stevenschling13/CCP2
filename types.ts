export enum StrainType {
  SATIVA = 'Sativa',
  INDICA = 'Indica',
  HYBRID = 'Hybrid',
  RUDERALIS = 'Ruderalis'
}

export enum GrowStage {
  SEEDLING = 'Seedling',
  VEGETATIVE = 'Vegetative',
  FLOWERING = 'Flowering',
  DRYING = 'Drying',
  CURING = 'Curing'
}

export interface PlantBatch {
  id: string;
  name: string;
  strain: string;
  type: StrainType;
  stage: GrowStage;
  startDate: number;
  plantedCount: number;
  isActive: boolean;
}

export interface SensorReading {
  temp: number; // Celsius
  humidity: number; // %
  vpd: number; // kPa
  co2: number; // ppm
  timestamp: number;
}

export interface Room {
  id: string;
  name: string;
  currentReading?: SensorReading;
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL';
}

export enum LogType {
  OBSERVATION = 'Observation',
  WATERING = 'Watering',
  NUTRIENT = 'Nutrient',
  DEFICIENCY = 'Deficiency',
  PEST = 'Pest',
  TRAINING = 'Training',
  ENV_CHANGE = 'Environment'
}

export interface AiDiagnosis {
  healthScore: number; // 0-100
  issues: string[];
  recommendations: string[];
  confidence: number;
}

export interface GrowLog {
  id: string;
  batchId: string;
  timestamp: number;
  type: LogType;
  note: string;
  imageUrl?: string; // Base64
  aiDiagnosis?: AiDiagnosis;
  author: 'User' | 'AI';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface AppError {
  id: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: number;
}

// Zod-like schema inference for AI JSON responses
export interface FacilityBriefing {
  status: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL';
  summary: string;
  actionItems: string[];
}

export interface ArOverlayData {
  status: 'SCANNING' | 'LOCKED' | 'ANALYZING';
  detectedObjects: Array<{label: string, confidence: number}>;
  healthEstimate: number;
}