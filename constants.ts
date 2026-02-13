import { AppSettings, InventoryItem } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "RFE Foam Equipment",
  companyAddress: "123 Insulation Lane, Contractor City, ST 12345",
  companyPhone: "(555) 123-4567",
  companyEmail: "info@rfe-equipment.com",
  openCellYield: 16000,
  closedCellYield: 4000,
  openCellCost: 2000,
  closedCellCost: 2600,
  laborRate: 85,
  taxRate: 7.5
};

export const INITIAL_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Open Cell Foam Set', category: 'Material', quantity: 12, unit: 'Sets', minLevel: 5 },
  { id: '2', name: 'Closed Cell Foam Set', category: 'Material', quantity: 8, unit: 'Sets', minLevel: 3 },
  { id: '3', name: 'Suit - XL', category: 'Supply', quantity: 50, unit: 'Pcs', minLevel: 10 },
  { id: '4', name: 'Mask Filters', category: 'Supply', quantity: 20, unit: 'Pairs', minLevel: 5 },
  { id: '5', name: 'Gun Cleaner', category: 'Supply', quantity: 15, unit: 'Cans', minLevel: 5 },
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'calculator', label: 'New Estimate', icon: 'Calculator' },
  { id: 'customers', label: 'Customers & Jobs', icon: 'Users' },
  { id: 'inventory', label: 'Inventory', icon: 'Package' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];