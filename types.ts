export enum JobStatus {
  DRAFT = 'Draft',
  WORK_ORDER = 'Work Order',
  INVOICED = 'Invoiced',
  PAID = 'Paid',
  ARCHIVED = 'Archived'
}

export enum FoamType {
  OPEN_CELL = 'Open Cell',
  CLOSED_CELL = 'Closed Cell'
}

export interface Customer {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  createdAt: string;
}

export interface JobItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  inventoryItemId?: string;
  inventoryQuantityUsed?: number;
}

export interface CalculationData {
  length: number;
  width: number;
  wallHeight: number;
  roofPitch: number; // 0-12
  isGable: boolean;
  wallFoamType: FoamType;
  wallThickness: number; // inches
  roofFoamType: FoamType;
  roofThickness: number; // inches
  wastePct: number;
}

export interface JobLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface Estimate {
  id: string;
  number: string;
  customerId: string;
  date: string;
  status: JobStatus;
  
  // Job Site Info
  jobName: string;
  jobAddress?: string;
  location?: JobLocation;
  images?: string[]; // Base64

  // Calculation Snapshot
  calcData: CalculationData;
  
  // Pricing Strategy
  pricingMode?: 'cost_plus' | 'sqft';
  pricePerSqFtWall?: number;
  pricePerSqFtRoof?: number;
  
  // Results
  totalBoardFeetOpen: number;
  totalBoardFeetClosed: number;
  setsRequiredOpen: number;
  setsRequiredClosed: number;
  
  // Inventory Tracking
  inventoryDeducted?: boolean;
  
  // Financials
  items: JobItem[];
  subtotal: number;
  tax: number;
  total: number;
  
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Material' | 'Equipment' | 'Supply';
  quantity: number;
  unit: string;
  minLevel: number;
}

export interface AppSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoUrl?: string;
  
  openCellYield: number; // Board feet per set
  closedCellYield: number; // Board feet per set
  openCellCost: number; // Per set
  closedCellCost: number; // Per set
  
  laborRate: number; // Per hour
  taxRate: number; // Percentage
}

export interface User {
  username: string;
  company: string;
  isAuthenticated: boolean;
}