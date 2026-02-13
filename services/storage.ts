import { Customer, Estimate, InventoryItem, AppSettings, User } from "../types";
import { DEFAULT_SETTINGS, INITIAL_INVENTORY } from "../constants";
import { supabase } from "./supabaseClient";

// --- Helper: get current user id ---
const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  return session.user.id;
};

// --- Auth (Supabase) ---
export const getUser = async (): Promise<User | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return {
    username: session.user.email || '',
    company: session.user.user_metadata?.company || 'My Spray Foam Co',
    isAuthenticated: true,
  };
};

export const logoutUser = async (): Promise<void> => {
  await supabase.auth.signOut();
};

// =============================================
// --- Customers (Supabase) ---
// =============================================
const mapCustomerFromDb = (row: any): Customer => ({
  id: row.id,
  name: row.name,
  companyName: row.company_name || '',
  email: row.email || '',
  phone: row.phone || '',
  address: row.address || '',
  city: row.city || '',
  state: row.state || '',
  zip: row.zip || '',
  notes: row.notes || undefined,
  createdAt: row.created_at || new Date().toISOString(),
});

export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getCustomers error:', error); return []; }
  return (data || []).map(mapCustomerFromDb);
};

export const saveCustomer = async (customer: Customer): Promise<Customer> => {
  const userId = await getUserId();

  // Check if this customer already exists in Supabase (by uuid)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customer.id);
  
  if (isUuid) {
    // Try update
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: customer.name,
        company_name: customer.companyName || '',
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        notes: customer.notes || null,
      })
      .eq('id', customer.id)
      .select()
      .single();
    if (!error && data) return mapCustomerFromDb(data);
  }

  // Insert new
  const { data, error } = await supabase
    .from('customers')
    .insert({
      user_id: userId,
      name: customer.name,
      company_name: customer.companyName || '',
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
      notes: customer.notes || null,
    })
    .select()
    .single();
  if (error) { console.error('saveCustomer error:', error); return customer; }
  return mapCustomerFromDb(data);
};

export const deleteCustomer = async (id: string): Promise<void> => {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) console.error('deleteCustomer error:', error);
};

// =============================================
// --- Estimates (Supabase) ---
// =============================================
const mapEstimateFromDb = (row: any): Estimate => ({
  id: row.id,
  number: row.number || '',
  customerId: row.customer_id || '',
  date: row.date || '',
  status: row.status || 'Draft',
  jobName: row.job_name || '',
  jobAddress: row.job_address || undefined,
  location: row.location || undefined,
  images: row.images || undefined,
  calcData: row.calc_data || { length: 0, width: 0, wallHeight: 0, roofPitch: 0, isGable: false, wallFoamType: 'Open Cell', wallThickness: 0, roofFoamType: 'Open Cell', roofThickness: 0, wastePct: 0 },
  pricingMode: row.pricing_mode || undefined,
  pricePerSqFtWall: row.price_per_sqft_wall != null ? Number(row.price_per_sqft_wall) : undefined,
  pricePerSqFtRoof: row.price_per_sqft_roof != null ? Number(row.price_per_sqft_roof) : undefined,
  totalBoardFeetOpen: Number(row.total_board_feet_open) || 0,
  totalBoardFeetClosed: Number(row.total_board_feet_closed) || 0,
  setsRequiredOpen: Number(row.sets_required_open) || 0,
  setsRequiredClosed: Number(row.sets_required_closed) || 0,
  inventoryDeducted: row.inventory_deducted || false,
  items: row.items || [],
  subtotal: Number(row.subtotal) || 0,
  tax: Number(row.tax) || 0,
  total: Number(row.total) || 0,
  notes: row.notes || undefined,
});

const estimateToDb = (estimate: Estimate, userId: string) => ({
  user_id: userId,
  number: estimate.number,
  customer_id: estimate.customerId || null,
  date: estimate.date,
  status: estimate.status,
  job_name: estimate.jobName,
  job_address: estimate.jobAddress || null,
  location: estimate.location || null,
  images: estimate.images || null,
  calc_data: estimate.calcData,
  pricing_mode: estimate.pricingMode || null,
  price_per_sqft_wall: estimate.pricePerSqFtWall ?? null,
  price_per_sqft_roof: estimate.pricePerSqFtRoof ?? null,
  total_board_feet_open: estimate.totalBoardFeetOpen,
  total_board_feet_closed: estimate.totalBoardFeetClosed,
  sets_required_open: estimate.setsRequiredOpen,
  sets_required_closed: estimate.setsRequiredClosed,
  inventory_deducted: estimate.inventoryDeducted || false,
  items: estimate.items,
  subtotal: estimate.subtotal,
  tax: estimate.tax,
  total: estimate.total,
  notes: estimate.notes || null,
});

export const getEstimates = async (): Promise<Estimate[]> => {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getEstimates error:', error); return []; }
  return (data || []).map(mapEstimateFromDb);
};

export const saveEstimate = async (estimate: Estimate): Promise<Estimate> => {
  const userId = await getUserId();
  const dbData = estimateToDb(estimate, userId);

  // Check if existing uuid
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(estimate.id);

  if (isUuid) {
    const { data, error } = await supabase
      .from('estimates')
      .update(dbData)
      .eq('id', estimate.id)
      .select()
      .single();
    if (!error && data) return mapEstimateFromDb(data);
  }

  // Insert new
  const { data, error } = await supabase
    .from('estimates')
    .insert(dbData)
    .select()
    .single();
  if (error) { console.error('saveEstimate error:', error); return estimate; }
  return mapEstimateFromDb(data);
};

export const deleteEstimate = async (id: string): Promise<void> => {
  const { error } = await supabase.from('estimates').delete().eq('id', id);
  if (error) console.error('deleteEstimate error:', error);
};

// =============================================
// --- Inventory (Supabase) ---
// =============================================
const mapInventoryFromDb = (row: any): InventoryItem => ({
  id: row.id,
  name: row.name,
  category: row.category as InventoryItem['category'],
  quantity: Number(row.quantity) || 0,
  unit: row.unit || '',
  minLevel: Number(row.min_level) || 0,
});

export const getInventory = async (): Promise<InventoryItem[]> => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('getInventory error:', error); return []; }

  // If user has no inventory yet, seed with defaults
  if (!data || data.length === 0) {
    const seeded = await seedDefaultInventory(userId);
    return seeded;
  }
  return data.map(mapInventoryFromDb);
};

const seedDefaultInventory = async (userId: string): Promise<InventoryItem[]> => {
  const rows = INITIAL_INVENTORY.map(item => ({
    user_id: userId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    min_level: item.minLevel,
  }));
  const { data, error } = await supabase.from('inventory').insert(rows).select();
  if (error) { console.error('seedDefaultInventory error:', error); return []; }
  return (data || []).map(mapInventoryFromDb);
};

export const saveInventoryItem = async (item: InventoryItem): Promise<InventoryItem> => {
  const userId = await getUserId();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);

  if (isUuid) {
    const { data, error } = await supabase
      .from('inventory')
      .update({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        min_level: item.minLevel,
      })
      .eq('id', item.id)
      .select()
      .single();
    if (!error && data) return mapInventoryFromDb(data);
  }

  // Insert new
  const { data, error } = await supabase
    .from('inventory')
    .insert({
      user_id: userId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      min_level: item.minLevel,
    })
    .select()
    .single();
  if (error) { console.error('saveInventoryItem error:', error); return item; }
  return mapInventoryFromDb(data);
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  if (error) console.error('deleteInventoryItem error:', error);
};

export const saveFullInventory = async (items: InventoryItem[]): Promise<void> => {
  // Batch upsert: update all items in parallel for instant sync
  const userId = await getUserId();
  const promises = items
    .filter(item => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id))
    .map(item =>
      supabase
        .from('inventory')
        .update({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          min_level: item.minLevel,
        })
        .eq('id', item.id)
    );
  const results = await Promise.all(promises);
  results.forEach((r, i) => {
    if (r.error) console.error('saveFullInventory batch error:', r.error);
  });
};

// =============================================
// --- Settings (Supabase) ---
// =============================================
const mapSettingsFromDb = (row: any): AppSettings => ({
  companyName: row.company_name || DEFAULT_SETTINGS.companyName,
  companyAddress: row.company_address || '',
  companyPhone: row.company_phone || '',
  companyEmail: row.company_email || '',
  logoUrl: row.logo_url || undefined,
  openCellYield: Number(row.open_cell_yield) || DEFAULT_SETTINGS.openCellYield,
  closedCellYield: Number(row.closed_cell_yield) || DEFAULT_SETTINGS.closedCellYield,
  openCellCost: Number(row.open_cell_cost) || DEFAULT_SETTINGS.openCellCost,
  closedCellCost: Number(row.closed_cell_cost) || DEFAULT_SETTINGS.closedCellCost,
  laborRate: Number(row.labor_rate) || DEFAULT_SETTINGS.laborRate,
  taxRate: Number(row.tax_rate) ?? DEFAULT_SETTINGS.taxRate,
});

export const getSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();
  if (error || !data) {
    console.error('getSettings error:', error);
    return DEFAULT_SETTINGS;
  }
  return mapSettingsFromDb(data);
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  const userId = await getUserId();
  const { error } = await supabase
    .from('settings')
    .update({
      company_name: settings.companyName,
      company_address: settings.companyAddress,
      company_phone: settings.companyPhone,
      company_email: settings.companyEmail,
      logo_url: settings.logoUrl || null,
      open_cell_yield: settings.openCellYield,
      closed_cell_yield: settings.closedCellYield,
      open_cell_cost: settings.openCellCost,
      closed_cell_cost: settings.closedCellCost,
      labor_rate: settings.laborRate,
      tax_rate: settings.taxRate,
    })
    .eq('user_id', userId);
  if (error) console.error('saveSettings error:', error);
};

// --- Data Management ---
export const exportData = async () => {
  const [customers, estimates, inventory, settings] = await Promise.all([
    getCustomers(),
    getEstimates(),
    getInventory(),
    getSettings(),
  ]);
  const data = { customers, estimates, inventory, settings, timestamp: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spf_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importData = async (jsonContent: string): Promise<boolean> => {
  try {
    const userId = await getUserId();
    const data = JSON.parse(jsonContent);

    if (data.customers && Array.isArray(data.customers)) {
      for (const c of data.customers) {
        await saveCustomer(c);
      }
    }
    if (data.estimates && Array.isArray(data.estimates)) {
      for (const e of data.estimates) {
        await saveEstimate(e);
      }
    }
    if (data.inventory && Array.isArray(data.inventory)) {
      for (const i of data.inventory) {
        await saveInventoryItem(i);
      }
    }
    if (data.settings) {
      await saveSettings(data.settings);
    }
    return true;
  } catch (e) {
    console.error("Import failed", e);
    return false;
  }
};

export const clearData = async (): Promise<void> => {
  const userId = await getUserId();
  // Delete all user data (RLS ensures only own data is affected)
  await supabase.from('estimates').delete().eq('user_id', userId);
  await supabase.from('customers').delete().eq('user_id', userId);
  await supabase.from('inventory').delete().eq('user_id', userId);
};

// --- Mock PDF Generator ---
export const generatePDF = (estimate: Estimate, customer?: Customer, settings?: AppSettings) => {
  console.log("Generating PDF for", estimate.id);
  alert(`PDF Generation Simulation:\n\nEstimate #${estimate.number}\nCustomer: ${customer?.name || 'Unknown'}\nTotal: $${estimate.total.toFixed(2)}\n\n(In a real app, this downloads a PDF file)`);
};