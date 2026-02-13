import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  Calculator as CalculatorIcon, 
  FileText, 
  Users, 
  Package, 
  Settings as SettingsIcon,
  Menu,
  X,
  FileDown,
  Printer,
  Plus,
  UserPlus,
  Download,
  Check,
  ArrowLeft,
  Pencil,
  RefreshCw
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Calculator from './components/Calculator';
import CRM from './components/CRM';
import Inventory from './components/Inventory';
import Settings from './components/Settings';
import Auth from './components/Auth';
import { ToastProvider, useToast } from './components/Toast';
import { NAV_ITEMS } from './constants';
import { getCustomers, getEstimates, getInventory, getSettings, generatePDF, saveEstimate, saveFullInventory, deleteEstimate, deleteCustomer } from './services/storage';
import { DEFAULT_SETTINGS } from './constants';
import { supabase } from './services/supabaseClient';
import { JobStatus, Estimate, User, InventoryItem, Customer, AppSettings } from './types';
import type { Session } from '@supabase/supabase-js';

// Wrapper to use the hook
const AppContent: React.FC = () => {
  const { showToast } = useToast();

  // --- Data State ---
  const [activeView, setActiveView] = useState('dashboard');
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Navigation Context
  const [preSelectedCustomerId, setPreSelectedCustomerId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [openCustomerAdd, setOpenCustomerAdd] = useState(false);
  const [editEstimateId, setEditEstimateId] = useState<string | null>(null);

  // Navigate with context helper
  const navigateTo = (view: string, context?: { customerId?: string; jobId?: string; addCustomer?: boolean; editEstimateId?: string }) => {
    setActiveView(view);
    setShowQuickActions(false);
    if (context?.customerId) setPreSelectedCustomerId(context.customerId);
    else setPreSelectedCustomerId(null);
    if (context?.jobId) setSelectedJobId(context.jobId);
    else setSelectedJobId(null);
    setOpenCustomerAdd(Boolean(context?.addCustomer));
    if (context?.editEstimateId) setEditEstimateId(context.editEstimateId);
    else setEditEstimateId(null);
  };
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Storage State
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Trigger re-renders
  const [isSyncing, setIsSyncing] = useState(false); // Background sync indicator (no blocking)
  const initialLoadDone = useRef(false);

  // --- Supabase Auth Listener ---
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser({
          username: session.user.email || '',
          company: session.user.user_metadata?.company || 'My Spray Foam Co',
          isAuthenticated: true,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser({
          username: session.user.email || '',
          company: session.user.user_metadata?.company || 'My Spray Foam Co',
          isAuthenticated: true,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Effects ---
  // Load data from Supabase when lastUpdate changes or user logs in
  // First load shows a loading spinner; subsequent refreshes sync silently in background
  useEffect(() => {
    if (!user) {
      setDataLoading(false);
      return;
    }
    let cancelled = false;
    const isFirstLoad = !initialLoadDone.current;
    const loadData = async () => {
      if (isFirstLoad) {
        setDataLoading(true);
      } else {
        setIsSyncing(true); // silent background indicator
      }
      try {
        const [c, e, i, s] = await Promise.all([
          getCustomers(),
          getEstimates(),
          getInventory(),
          getSettings(),
        ]);
        if (!cancelled) {
          setCustomers(c);
          setEstimates(e);
          setInventory(i);
          setSettings(s);
          initialLoadDone.current = true;
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        if (!cancelled) {
          setDataLoading(false);
          setIsSyncing(false);
        }
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [lastUpdate, user]);

  // --- Supabase Realtime Subscriptions ---
  // Listen for changes to estimates and inventory tables and merge them into local state
  // so that inventory updates appear instantly on mobile without a full reload
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('app-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = mapInventoryPayload(payload.new);
            setInventory(prev => {
              if (prev.some(i => i.id === newItem.id)) return prev;
              return [...prev, newItem];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapInventoryPayload(payload.new);
            setInventory(prev => prev.map(i => i.id === updated.id ? updated : i));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) setInventory(prev => prev.filter(i => i.id !== oldId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estimates' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEst = mapEstimatePayload(payload.new);
            setEstimates(prev => {
              if (prev.some(e => e.id === newEst.id)) return prev;
              return [newEst, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapEstimatePayload(payload.new);
            setEstimates(prev => prev.map(e => e.id === updated.id ? updated : e));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any)?.id;
            if (oldId) setEstimates(prev => prev.filter(e => e.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Mapper helpers for realtime payloads (mirrors storage.ts mappers)
  const mapInventoryPayload = (row: any): InventoryItem => ({
    id: row.id,
    name: row.name,
    category: row.category as InventoryItem['category'],
    quantity: Number(row.quantity) || 0,
    unit: row.unit || '',
    minLevel: Number(row.min_level) || 0,
  });

  const mapEstimatePayload = (row: any): Estimate => ({
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

  // PWA Install Event Listener
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const refreshData = () => setLastUpdate(Date.now());

  const getEstimateInventoryDeductions = (estimate: Estimate, currentInventory: InventoryItem[]) => {
    const deductions = new Map<string, number>();

    const openRequired = estimate.setsRequiredOpen || 0;
    const closedRequired = estimate.setsRequiredClosed || 0;
    const openCellItem = currentInventory.find(i => i.id === '1' || i.name.toLowerCase().includes('open cell'));
    const closedCellItem = currentInventory.find(i => i.id === '2' || i.name.toLowerCase().includes('closed cell'));

    if (openCellItem && openRequired > 0) {
      deductions.set(openCellItem.id, (deductions.get(openCellItem.id) || 0) + openRequired);
    }
    if (closedCellItem && closedRequired > 0) {
      deductions.set(closedCellItem.id, (deductions.get(closedCellItem.id) || 0) + closedRequired);
    }

    estimate.items.forEach(item => {
      if (!item.inventoryItemId) return;
      const quantityUsed = Number(item.inventoryQuantityUsed ?? item.quantity ?? 0);
      if (quantityUsed <= 0) return;
      deductions.set(item.inventoryItemId, (deductions.get(item.inventoryItemId) || 0) + quantityUsed);
    });

    return Array.from(deductions.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  };

  const applyEstimateInventoryChange = (
    estimate: Estimate,
    currentInventory: InventoryItem[],
    mode: 'deduct' | 'restock'
  ) => {
    const deductions = getEstimateInventoryDeductions(estimate, currentInventory);
    if (deductions.length === 0) {
      return { updatedInventory: currentInventory, details: [] as string[] };
    }

    const updatedInventory = currentInventory.map(item => {
      const entry = deductions.find(d => d.itemId === item.id);
      if (!entry) return item;

      if (mode === 'deduct') {
        return { ...item, quantity: Number(Math.max(0, item.quantity - entry.quantity).toFixed(2)) };
      }

      return { ...item, quantity: Number((item.quantity + entry.quantity).toFixed(2)) };
    });

    const details = deductions.map(d => {
      const target = currentInventory.find(i => i.id === d.itemId);
      return `${d.quantity.toFixed(2)} ${target?.name || 'Item'}`;
    });

    return { updatedInventory, details };
  };

  const restockInventoryForEstimate = (estimate: Estimate, currentInventory = inventory) => {
    if (!estimate.inventoryDeducted) {
      return currentInventory;
    }
    return applyEstimateInventoryChange(estimate, currentInventory, 'restock').updatedInventory;
  };

  const handleDeleteEstimate = async (estimate: Estimate) => {
    const confirmed = window.confirm(`Delete ${estimate.number} (${estimate.jobName})? This cannot be undone.`);
    if (!confirmed) return;

    let updatedInventory = inventory;
    if (estimate.inventoryDeducted) {
      updatedInventory = restockInventoryForEstimate(estimate, inventory);
      await saveFullInventory(updatedInventory);
    }

    await deleteEstimate(estimate.id);
    showToast('Estimate deleted', 'success');

    if (activeView === 'jobDetail' && selectedJobId === estimate.id) {
      navigateTo('jobs');
    }

    refreshData();
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    const linkedEstimates = estimates.filter(e => e.customerId === customerId);
    const confirmed = window.confirm(
      linkedEstimates.length > 0
        ? `Delete ${customer.name} and ${linkedEstimates.length} linked job(s)/invoice(s)? This cannot be undone.`
        : `Delete customer ${customer.name}? This cannot be undone.`
    );
    if (!confirmed) return;

    let updatedInventory = inventory;
    for (const est of linkedEstimates) {
      updatedInventory = restockInventoryForEstimate(est, updatedInventory);
      await deleteEstimate(est.id);
    }

    if (linkedEstimates.some(e => e.inventoryDeducted)) {
      await saveFullInventory(updatedInventory);
    }

    await deleteCustomer(customerId);
    showToast('Customer deleted', 'success');
    refreshData();
  };

  // --- Status Change Handler (shared by JobsList, JobDetail, and CRM) ---
  // Uses optimistic UI: updates state immediately, then syncs to Supabase in background
  const handleStatusChange = async (est: Estimate, newStatus: JobStatus) => {
    let updatedEst = { ...est, status: newStatus };
    let updatedInventory = [...inventory];
    let inventoryChanged = false;

    if (newStatus === JobStatus.WORK_ORDER && !est.inventoryDeducted) {
      const { updatedInventory: deductedInventory, details } = applyEstimateInventoryChange(est, updatedInventory, 'deduct');
      if (details.length > 0) {
        updatedInventory = deductedInventory;
        updatedEst.inventoryDeducted = true;
        inventoryChanged = true;
        showToast(`Job Sold! Deducted: ${details.join(', ')}`, 'success');
      } else {
        showToast('Work Order Created', 'success');
      }
    } else if (newStatus === JobStatus.INVOICED) {
      showToast('Invoice Created', 'success');
    } else if (newStatus === JobStatus.PAID) {
      showToast('Payment Recorded!', 'success');
    } else if (newStatus === JobStatus.ARCHIVED) {
      showToast('Job Archived', 'info');
    } else if (newStatus === JobStatus.DRAFT && est.inventoryDeducted) {
      const { updatedInventory: restockedInventory } = applyEstimateInventoryChange(est, updatedInventory, 'restock');
      updatedInventory = restockedInventory;
      updatedEst.inventoryDeducted = false;
      inventoryChanged = true;
      showToast("Job Reverted to Draft. Materials Restocked.", 'info');
    }

    // Optimistic UI update: apply changes to local state immediately
    setEstimates(prev => prev.map(e => e.id === est.id ? updatedEst : e));
    if (inventoryChanged) {
      setInventory(updatedInventory);
    }

    // Background sync to Supabase (fire-and-forget, no blocking)
    // Use Promise.all so estimate + inventory save in parallel
    const bgTasks: Promise<any>[] = [
      saveEstimate(updatedEst).catch(err => {
        console.error('Failed to save estimate status:', err);
        showToast('Sync error - please refresh', 'error');
      }),
    ];
    if (inventoryChanged) {
      bgTasks.push(
        saveFullInventory(updatedInventory).catch(err => {
          console.error('Failed to save inventory:', err);
          showToast('Inventory sync error - please refresh', 'error');
        })
      );
    }
    // Fire all background tasks together — no await
    Promise.all(bgTasks);
  };

  // --- Job Detail View ---
  const JobDetail = ({ jobId }: { jobId: string }) => {
    const est = estimates.find(e => e.id === jobId);
    if (!est) {
      return (
        <div className="text-center py-16">
          <p className="text-slate-400">Job not found.</p>
          <button onClick={() => navigateTo('jobs')} className="mt-4 text-brand-600 hover:underline">Back to Jobs</button>
        </div>
      );
    }
    const customer = customers.find(c => c.id === est.customerId);

    const nextAction = () => {
      switch (est.status) {
        case JobStatus.DRAFT:
          return { label: 'Mark Sold (Create Work Order)', nextStatus: JobStatus.WORK_ORDER, color: 'bg-orange-500 hover:bg-orange-600' };
        case JobStatus.WORK_ORDER:
          return { label: 'Create Invoice', nextStatus: JobStatus.INVOICED, color: 'bg-blue-600 hover:bg-blue-700' };
        case JobStatus.INVOICED:
          return { label: 'Mark as Paid', nextStatus: JobStatus.PAID, color: 'bg-green-600 hover:bg-green-700' };
        default:
          return null;
      }
    };

    const action = nextAction();

    const statusColors: Record<string, string> = {
      [JobStatus.DRAFT]: 'bg-slate-100 text-slate-700',
      [JobStatus.WORK_ORDER]: 'bg-orange-100 text-orange-700',
      [JobStatus.INVOICED]: 'bg-blue-100 text-blue-700',
      [JobStatus.PAID]: 'bg-green-100 text-green-700',
      [JobStatus.ARCHIVED]: 'bg-slate-200 text-slate-500',
    };

    return (
      <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
        {/* Back button */}
        <button onClick={() => navigateTo('jobs')} className="flex items-center gap-2 text-slate-500 hover:text-brand-600 text-sm">
          <X className="w-4 h-4" /> Back to Jobs
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{est.number}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColors[est.status] || 'bg-slate-100 text-slate-700'}`}>
                    {est.status}
                  </span>
                  {est.inventoryDeducted && (
                    <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full font-medium">
                      <Package className="w-3 h-3"/> Inventory Allocated
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{est.jobName || 'Untitled Job'}</h1>
                <p className="text-slate-500 mt-1">{customer?.name || 'Unknown Customer'} {customer?.companyName ? `• ${customer.companyName}` : ''}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(est.date).toLocaleDateString()}{est.jobAddress ? ` • ${est.jobAddress}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-3xl font-bold text-slate-900">${est.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>
          </div>

          {/* Workflow Progress Bar */}
          <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100">
            <div className="flex items-center gap-1 text-xs">
              {[JobStatus.DRAFT, JobStatus.WORK_ORDER, JobStatus.INVOICED, JobStatus.PAID].map((s, i, arr) => {
                const idx = arr.indexOf(est.status);
                const isComplete = i <= idx;
                const isCurrent = s === est.status;
                return (
                  <React.Fragment key={s}>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all ${isCurrent ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-300' : isComplete ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {isComplete && !isCurrent && <Check className="w-3 h-3" />}
                      {s}
                    </div>
                    {i < arr.length - 1 && <div className={`flex-1 h-0.5 rounded ${isComplete && !isCurrent ? 'bg-green-300' : isCurrent ? 'bg-brand-200' : 'bg-slate-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 md:p-8 flex flex-col sm:flex-row gap-3">
            {action && (
              <button
                onClick={() => { handleStatusChange(est, action.nextStatus); }}
                className={`flex-1 py-3 px-6 rounded-lg text-white font-bold text-center shadow-lg transition-all ${action.color}`}
              >
                {action.label}
              </button>
            )}
            <button
              onClick={() => navigateTo('calculator', { editEstimateId: est.id })}
              className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg border border-brand-200 text-brand-600 font-medium hover:bg-brand-50 transition-colors"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={() => generatePDF(est, customer, settings)}
              className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              <FileDown className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={() => handleDeleteEstimate(est)}
              className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" /> Delete
            </button>
            {est.status === JobStatus.PAID && (
              <button
                onClick={() => { handleStatusChange(est, JobStatus.ARCHIVED); navigateTo('jobs'); }}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg border border-slate-200 text-slate-500 font-medium hover:bg-slate-50 transition-colors"
              >
                Archive Job
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Line Items</h3>
            <div className="space-y-3">
              {est.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                  <div>
                    <p className="font-medium text-slate-800">{item.description}</p>
                    <p className="text-xs text-slate-400">{item.quantity} {item.unit} @ ${item.unitPrice.toLocaleString()}</p>
                  </div>
                  <p className="font-medium text-slate-900">${item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              ))}
              <div className="pt-2 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span><span>${est.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax</span><span>${est.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total</span><span>${est.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Material Summary */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Material Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Wall Area</span><span className="font-mono">{est.calcData?.length && est.calcData?.wallHeight ? ((est.calcData.length + (est.calcData.width || 0)) * 2 * est.calcData.wallHeight).toFixed(0) : '—'} sqft</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Roof Area</span><span className="font-mono">{est.totalBoardFeetOpen || est.totalBoardFeetClosed ? 'Calculated' : '—'}</span></div>
              <div className="border-t border-slate-100 pt-2"></div>
              {est.setsRequiredOpen > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Open Cell Sets</span>
                  <span className="font-bold text-brand-600">{est.setsRequiredOpen.toFixed(2)}</span>
                </div>
              )}
              {est.setsRequiredClosed > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Closed Cell Sets</span>
                  <span className="font-bold text-brand-600">{est.setsRequiredClosed.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-100 pt-2"></div>
              <div className="flex justify-between"><span className="text-slate-600">Pricing Mode</span><span className="capitalize">{est.pricingMode === 'sqft' ? 'Per Sq Ft' : 'Cost Plus'}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Waste Factor</span><span>{est.calcData?.wastePct || 0}%</span></div>
            </div>

            {/* Customer shortcut */}
            {customer && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => navigateTo('customers', { customerId: customer.id })}
                  className="text-sm text-brand-600 hover:underline flex items-center gap-1"
                >
                  <Users className="w-3 h-3" /> View Customer Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- Job List Component ---
  const JobsList = () => {
    const [filter, setFilter] = useState('All');
    
    const filteredEstimates = estimates.filter(e => {
        if (filter === 'All') return true;
        return e.status === filter;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <h2 className="text-2xl font-bold text-slate-900">Jobs & Estimates</h2>
             <select 
               className="w-full sm:w-auto p-2 border rounded-lg bg-white"
               value={filter}
               onChange={(e) => setFilter(e.target.value)}
             >
               <option value="All">All Jobs</option>
               <option value={JobStatus.DRAFT}>Drafts</option>
               <option value={JobStatus.WORK_ORDER}>Work Orders</option>
               <option value={JobStatus.INVOICED}>Invoices</option>
               <option value={JobStatus.PAID}>Paid</option>
               <option value={JobStatus.ARCHIVED}>Archived</option>
             </select>
        </div>
        
        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-4">
          {filteredEstimates.map(est => {
             const customer = customers.find(c => c.id === est.customerId);
             return (
               <div key={est.id}
                 onClick={() => navigateTo('jobDetail', { jobId: est.id })}
                 className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-brand-200 hover:shadow-md transition-all active:scale-[0.99]"
               >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{est.number}</span>
                      <h3 className="font-bold text-slate-900 mt-1">{customer?.name || 'Unknown'}</h3>
                      <p className="text-xs text-slate-500">{new Date(est.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                       <p className="font-bold text-slate-900">${est.total.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                     <span className={`text-xs rounded-full px-2.5 py-1 font-medium
                          ${est.status === JobStatus.PAID ? 'bg-green-50 text-green-700' : 
                            est.status === JobStatus.WORK_ORDER ? 'bg-orange-50 text-orange-700' :
                            est.status === JobStatus.INVOICED ? 'bg-blue-50 text-blue-700' :
                            'bg-slate-50 text-slate-700'}`}
                      >
                          {est.status}
                      </span>
                      <span className="text-xs text-brand-600 font-medium">View Details →</span>
                  </div>
                  {est.inventoryDeducted && (
                     <div className="mt-2 text-[10px] text-green-600 flex items-center gap-1 bg-green-50 p-1 rounded w-fit">
                       <Package className="w-3 h-3"/> Inventory Allocated
                     </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo('calculator', { editEstimateId: est.id });
                      }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEstimate(est);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
               </div>
             );
          })}
          {filteredEstimates.length === 0 && (
              <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">No jobs found.</div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Ref #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEstimates.map(est => {
                  const customer = customers.find(c => c.id === est.customerId);
                  return (
                  <tr key={est.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => navigateTo('jobDetail', { jobId: est.id })}>
                    <td className="px-6 py-4 font-mono text-slate-600">{est.number}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{customer?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(est.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      ${est.total.toLocaleString()}
                      {est.inventoryDeducted && (
                         <div className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                           <Package className="w-3 h-3"/> Allocated
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                        <span className={`text-xs rounded-full px-2.5 py-1 font-medium
                          ${est.status === JobStatus.PAID ? 'bg-green-50 text-green-700' :
                            est.status === JobStatus.WORK_ORDER ? 'bg-orange-50 text-orange-700' :
                            est.status === JobStatus.INVOICED ? 'bg-blue-50 text-blue-700' :
                            'bg-slate-50 text-slate-700'}`}
                        >
                            {est.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-3">
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             navigateTo('calculator', { editEstimateId: est.id });
                           }}
                           className="text-sm text-brand-600 hover:underline font-medium"
                         >
                           Edit
                         </button>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             handleDeleteEstimate(est);
                           }}
                           className="text-sm text-red-600 hover:underline font-medium"
                         >
                           Delete
                         </button>
                         <span className="text-sm text-slate-500 font-medium hover:underline">View →</span>
                       </div>
                    </td>
                  </tr>
                )})}
                {filteredEstimates.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No jobs found matching this filter.</td></tr>
                )}
              </tbody>
            </table>
        </div>
      </div>
    );
  };

  // --- Render Active View ---
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard estimates={estimates} inventory={inventory} onNavigate={navigateTo} />;
      case 'calculator': {
        const editEst = editEstimateId ? estimates.find(e => e.id === editEstimateId) || null : null;
        return <Calculator settings={settings} customers={customers} inventory={inventory} preSelectedCustomerId={preSelectedCustomerId || undefined} editEstimate={editEst} onSave={(savedId?: string, customerId?: string) => {
          const custId = customerId || preSelectedCustomerId || editEst?.customerId;
          refreshData();
          if (custId) {
            navigateTo('customers', { customerId: custId });
          } else if (savedId) {
            navigateTo('jobDetail', { jobId: savedId });
          } else {
            navigateTo('jobs');
          }
        }} onRefresh={refreshData} />;
      }
      case 'jobs':
        return <JobsList />;
      case 'jobDetail':
        return selectedJobId ? <JobDetail jobId={selectedJobId} /> : <JobsList />;
      case 'customers':
        return <CRM customers={customers} estimates={estimates} onRefresh={refreshData} onNavigate={navigateTo} onDeleteCustomer={handleDeleteCustomer} onDeleteEstimate={handleDeleteEstimate} onStatusChange={handleStatusChange} openAddOnLoad={openCustomerAdd} autoSelectCustomerId={preSelectedCustomerId || undefined} />;
      case 'inventory':
        return <Inventory items={inventory} onRefresh={refreshData} onOptimisticUpdate={(updatedItems) => setInventory(updatedItems)} />;
      case 'settings':
        return <Settings settings={settings} onSave={refreshData} installPrompt={deferredPrompt} onInstall={handleInstallClick} />;
      default:
        return <Dashboard estimates={estimates} inventory={inventory} onNavigate={navigateTo} />;
    }
  };

  const IconComponent = (name: string, className = "w-5 h-5") => {
    switch (name) {
      case 'LayoutDashboard': return <LayoutDashboard className={className} />;
      case 'Calculator': return <CalculatorIcon className={className} />;
      case 'FileText': return <FileText className={className} />;
      case 'Users': return <Users className={className} />;
      case 'Package': return <Package className={className} />;
      case 'Settings': return <SettingsIcon className={className} />;
      default: return <LayoutDashboard className={className} />;
    }
  };

  // --- Branding Component ---
  const BrandLogo = () => (
    <div className="flex items-center gap-3 select-none">
       {/* Skewed Red Block like RFE logo */}
       <div className="bg-brand-600 px-2 py-0.5 transform -skew-x-12 shadow-sm">
         <span className="text-white font-black italic text-xl transform skew-x-12 block leading-none tracking-tight">RFE</span>
       </div>
       <div className="flex flex-col justify-center">
         <h1 className="font-bold text-lg leading-none text-white tracking-wide">FOAM EQUIPMENT</h1>
         <p className="text-[0.6rem] text-accent-400 font-bold tracking-widest uppercase">Estimator & CRM</p>
       </div>
    </div>
  );
  
  // Mobile uses slightly different styling
  const BrandLogoMobile = () => (
    <div className="flex items-center gap-2 select-none">
       <div className="bg-brand-600 px-1.5 py-0.5 transform -skew-x-12">
         <span className="text-white font-black italic text-lg transform skew-x-12 block leading-none">RFE</span>
       </div>
       <div className="flex flex-col">
         <span className="font-bold text-slate-900 leading-none">FOAM EQ.</span>
       </div>
    </div>
  );

  if (authLoading || (user && dataLoading)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !user.isAuthenticated) {
    return (
        <Auth onLogin={refreshData} />
    );
  }

  return (
      <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
        
        {/* Desktop Sidebar (Hidden on Mobile) */}
        <aside className="hidden lg:block fixed h-full w-64 bg-slate-900 text-white">
          <div className="p-6 border-b border-slate-800">
             <BrandLogo />
          </div>

          <nav className="p-4 space-y-1">
            <div className="mb-4">
              <button 
                onClick={() => navigateTo('calculator')}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand-900/50 transition-all"
              >
                <Plus className="w-5 h-5" /> New Estimate
              </button>
            </div>
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors group relative
                  ${activeView === item.id 
                    ? 'bg-slate-800 text-white border-l-4 border-brand-500' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                {IconComponent(item.icon)}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-0 w-full p-4 border-t border-slate-800 bg-slate-900">
              {deferredPrompt && (
                <button 
                  onClick={handleInstallClick} 
                  className="w-full mb-4 bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs py-2 px-3 rounded flex items-center justify-center gap-2 font-bold transition-colors"
                >
                  <Download className="w-3 h-3" /> Install App
                </button>
              )}
              <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold uppercase ring-2 ring-slate-800">
                      {user.username.substring(0,2)}
                  </div>
                  <div className="overflow-hidden">
                      <p className="text-sm font-medium text-white truncate">{user.username}</p>
                      <p className="text-xs text-slate-500 truncate">{user.company}</p>
                  </div>
              </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 lg:ml-64 flex flex-col min-h-screen relative pb-20 lg:pb-0">
          
          {/* Mobile Header (Only Branding & Settings) */}
          <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
            <BrandLogoMobile />
            <div className="flex items-center gap-2">
              {isSyncing && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing</span>
                </div>
              )}
              <button 
                onClick={() => navigateTo('settings')}
                className={`p-2 rounded-full ${activeView === 'settings' ? 'bg-slate-100 text-brand-600' : 'text-slate-600'}`}
              >
                <SettingsIcon className="w-6 h-6" />
              </button>
            </div>
          </header>

          {/* View Content */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              {renderContent()}
          </div>

          {/* Quick Actions Menu (Mobile) */}
          {showQuickActions && (
             <div className="fixed bottom-24 left-0 right-0 z-50 flex flex-col items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200 lg:hidden">
                <button 
                  onClick={() => { navigateTo('customers', { addCustomer: true }); }}
                  className="flex items-center gap-2 bg-white text-slate-700 px-5 py-3 rounded-full shadow-xl border border-slate-100 font-bold hover:bg-slate-50 w-48 justify-center"
                >
                  <UserPlus className="w-5 h-5 text-brand-500" /> New Customer
                </button>
                <button 
                   onClick={() => { navigateTo('calculator'); }}
                   className="flex items-center gap-2 bg-white text-slate-700 px-5 py-3 rounded-full shadow-xl border border-slate-100 font-bold hover:bg-slate-50 w-48 justify-center"
                >
                  <CalculatorIcon className="w-5 h-5 text-brand-500" /> New Estimate
                </button>
             </div>
           )}

           {/* Mobile Bottom Navigation Bar */}
           <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <div className="grid grid-cols-5 h-16 items-center">
                 {/* 1. Dashboard */}
                 <button onClick={() => navigateTo('dashboard')} className={`flex flex-col items-center justify-center h-full space-y-1 ${activeView === 'dashboard' ? 'text-brand-600' : 'text-slate-400'}`}>
                    <LayoutDashboard className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                 </button>

                 {/* 2. Jobs */}
                 <button onClick={() => navigateTo('jobs')} className={`flex flex-col items-center justify-center h-full space-y-1 ${activeView === 'jobs' || activeView === 'jobDetail' ? 'text-brand-600' : 'text-slate-400'}`}>
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Jobs</span>
                 </button>

                 {/* 3. Center PLUS Button */}
                 <div className="relative h-full flex items-center justify-center">
                    <button 
                      onClick={() => setShowQuickActions(!showQuickActions)}
                      className={`absolute -top-6 w-14 h-14 bg-brand-600 rounded-full shadow-lg border-4 border-slate-50 flex items-center justify-center text-white transition-transform ${showQuickActions ? 'rotate-45 bg-slate-800' : ''}`}
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                 </div>

                 {/* 4. Customers */}
                 <button onClick={() => navigateTo('customers')} className={`flex flex-col items-center justify-center h-full space-y-1 ${activeView === 'customers' ? 'text-brand-600' : 'text-slate-400'}`}>
                    <Users className="w-6 h-6" />
                    <span className="text-[10px] font-medium">CRM</span>
                 </button>

                 {/* 5. Inventory */}
                 <button onClick={() => navigateTo('inventory')} className={`flex flex-col items-center justify-center h-full space-y-1 ${activeView === 'inventory' ? 'text-brand-600' : 'text-slate-400'}`}>
                    <Package className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Stock</span>
                 </button>
              </div>
           </div>

        </main>
      </div>
  );
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    )
}

export default App;