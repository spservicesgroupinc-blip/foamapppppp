import React, { useState, useEffect } from 'react';
import { AppSettings, Customer, Estimate, FoamType, JobStatus, JobItem, JobLocation, InventoryItem } from '../types';
import { Save, RefreshCw, Plus, Calculator as CalcIcon, MapPin, Camera, Eye, EyeOff, X, UserPlus, Check, DollarSign, Loader2 } from 'lucide-react';
import { saveEstimate, saveCustomer } from '../services/storage';
import { uploadJobPhoto, deleteJobPhoto, isBase64Image } from '../services/imageService';
import { supabase } from '../services/supabaseClient';
import { useToast } from './Toast';

interface CalculatorProps {
  settings: AppSettings;
  customers: Customer[];
  inventory: InventoryItem[];
  preSelectedCustomerId?: string;
  editEstimate?: Estimate | null;
  onSave: (savedId?: string, customerId?: string) => void;
  onRefresh: () => void;
}

const Calculator: React.FC<CalculatorProps> = ({ settings, customers, inventory, preSelectedCustomerId, editEstimate, onSave, onRefresh }) => {
  const { showToast } = useToast();

  const isEditMode = Boolean(editEstimate);

  // --- State ---
  const [activeTab, setActiveTab] = useState<'building' | 'walls' | 'flat'>('building');
  const [showPricing, setShowPricing] = useState(true);
  
  // Job Info
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(preSelectedCustomerId || '');
  const [jobName, setJobName] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [location, setLocation] = useState<JobLocation | undefined>(undefined);
  const [images, setImages] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Add Customer Modal State
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  
  // Dimensions
  const [length, setLength] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(8);
  const [pitch, setPitch] = useState(0);
  const [isGable, setIsGable] = useState(true);
  
  // Foam Specs
  const [wallFoamType, setWallFoamType] = useState<FoamType>(FoamType.OPEN_CELL);
  const [wallThickness, setWallThickness] = useState(3.5);
  const [roofFoamType, setRoofFoamType] = useState<FoamType>(FoamType.OPEN_CELL);
  const [roofThickness, setRoofThickness] = useState(5.5);
  const [wastePct, setWastePct] = useState(10);
  
  // Pricing Strategy
  const [pricingMode, setPricingMode] = useState<'cost_plus' | 'sqft'>('cost_plus');
  const [sqftPriceWall, setSqftPriceWall] = useState(0);
  const [sqftPriceRoof, setSqftPriceRoof] = useState(0);

  // Cost Plus Pricing
  const [laborHours, setLaborHours] = useState(0);
  const [tripCharge, setTripCharge] = useState(0);
  const [miscItems, setMiscItems] = useState<JobItem[]>([]);

  // Load existing estimate data when editing
  useEffect(() => {
    if (editEstimate) {
      setSelectedCustomerId(editEstimate.customerId || '');
      setJobName(editEstimate.jobName || '');
      setJobAddress(editEstimate.jobAddress || '');
      setLocation(editEstimate.location);
      setImages(editEstimate.images || []);
      setThumbnails(editEstimate.thumbnails || []);
      
      // Load calc data
      if (editEstimate.calcData) {
        setLength(editEstimate.calcData.length || 0);
        setWidth(editEstimate.calcData.width || 0);
        setHeight(editEstimate.calcData.wallHeight || 8);
        setPitch(editEstimate.calcData.roofPitch || 0);
        setIsGable(editEstimate.calcData.isGable ?? true);
        setWallFoamType(editEstimate.calcData.wallFoamType || FoamType.OPEN_CELL);
        setWallThickness(editEstimate.calcData.wallThickness || 3.5);
        setRoofFoamType(editEstimate.calcData.roofFoamType || FoamType.OPEN_CELL);
        setRoofThickness(editEstimate.calcData.roofThickness || 5.5);
        setWastePct(editEstimate.calcData.wastePct || 10);
      }
      
      // Load pricing
      setPricingMode(editEstimate.pricingMode || 'cost_plus');
      setSqftPriceWall(editEstimate.pricePerSqFtWall || 0);
      setSqftPriceRoof(editEstimate.pricePerSqFtRoof || 0);
      
      // Load line items - separate misc items from main items
      if (editEstimate.items) {
        const mainDescs = ['Spray Foam Material', 'Labor', 'Trip Charge'];
        const mainWallDesc = (t: string) => t.startsWith('Wall Insulation');
        const mainRoofDesc = (t: string) => t.startsWith('Roof/Ceiling Insulation');
        
        // Extract labor hours from labor line item
        const laborItem = editEstimate.items.find(i => i.description === 'Labor');
        if (laborItem) setLaborHours(laborItem.quantity || 0);
        
        // Extract trip charge
        const tripItem = editEstimate.items.find(i => i.description === 'Trip Charge');
        if (tripItem) setTripCharge(tripItem.unitPrice || 0);
        
        // Extract misc items (anything that's not auto-generated)
        const misc = editEstimate.items.filter(i => 
          !mainDescs.includes(i.description) && 
          !mainWallDesc(i.description) && 
          !mainRoofDesc(i.description)
        );
        setMiscItems(misc);
      }
      
      // Determine activeTab from calc data
      if (editEstimate.calcData) {
        const cd = editEstimate.calcData;
        if (cd.wallHeight > 0 && cd.width > 0) setActiveTab('building');
        else if (cd.wallHeight === 0 && cd.width > 0) setActiveTab('flat');
        else setActiveTab('walls');
      }
    }
  }, [editEstimate]);

  // Results State
  const [results, setResults] = useState({
    wallArea: 0,
    roofArea: 0,
    totalBFOpen: 0,
    totalBFClosed: 0,
    setsOpen: 0,
    setsClosed: 0,
    baseCost: 0, // Material + Labor OR SQFT Total
    materialCost: 0, // For internal tracking in Cost Plus
    laborCost: 0, // For internal tracking in Cost Plus
    subtotal: 0,
    tax: 0,
    total: 0
  });

  // --- Calculations ---
  useEffect(() => {
    let wArea = 0;
    let rArea = 0;

    // 1. Geometry
    if (activeTab === 'building') {
      // Simple Box Model
      wArea = (length + width) * 2 * height;
      
      // Roof with pitch
      const pitchFactor = Math.sqrt(Math.pow(12, 2) + Math.pow(pitch, 2)) / 12;
      const flatRoofArea = length * width;
      rArea = flatRoofArea * pitchFactor;

      if (isGable) {
         const rise = (pitch / 12) * (width / 2);
         const oneGableArea = 0.5 * width * rise;
         wArea += (oneGableArea * 2); 
      }
    } else if (activeTab === 'walls') {
      wArea = length * height; // Here Length is linear footage
      rArea = 0;
    } else if (activeTab === 'flat') {
      rArea = length * width; // Treat flat area as "Roof/Ceiling" logic
      wArea = 0;
    }

    // 2. Board Feet & Sets (Always calculated for material ordering)
    const wBF = wArea * wallThickness;
    const rBF = rArea * roofThickness;
    
    // Add waste
    const wasteMult = 1 + (wastePct / 100);
    const totalWBF = wBF * wasteMult;
    const totalRBF = rBF * wasteMult;

    let bfOpen = 0;
    let bfClosed = 0;

    // Assign to type
    if (activeTab !== 'flat') {
      if (wallFoamType === FoamType.OPEN_CELL) bfOpen += totalWBF; else bfClosed += totalWBF;
    }
    if (activeTab !== 'walls') {
      if (roofFoamType === FoamType.OPEN_CELL) bfOpen += totalRBF; else bfClosed += totalRBF;
    }

    // Round sets to 2 decimal places to ensure clean outputs
    const setsOpen = bfOpen > 0 ? Number((bfOpen / settings.openCellYield).toFixed(2)) : 0;
    const setsClosed = bfClosed > 0 ? Number((bfClosed / settings.closedCellYield).toFixed(2)) : 0;

    // 3. Costs & Pricing
    let basePrice = 0;
    let matCost = 0;
    let labCost = 0;

    if (pricingMode === 'cost_plus') {
      // Cost Plus Logic
      matCost = (setsOpen * settings.openCellCost) + (setsClosed * settings.closedCellCost);
      labCost = laborHours * settings.laborRate;
      basePrice = matCost + labCost;
    } else {
      // SQFT Logic
      const wallPrice = wArea * sqftPriceWall;
      const roofPrice = rArea * sqftPriceRoof;
      basePrice = wallPrice + roofPrice;
    }

    const miscCost = miscItems.reduce((acc, item) => acc + item.total, 0);
    const sub = basePrice + tripCharge + miscCost;
    const tax = sub * (settings.taxRate / 100);
    const tot = sub + tax;

    setResults({
      wallArea: wArea,
      roofArea: rArea,
      totalBFOpen: bfOpen,
      totalBFClosed: bfClosed,
      setsOpen,
      setsClosed,
      baseCost: basePrice,
      materialCost: matCost,
      laborCost: labCost,
      subtotal: sub,
      tax,
      total: tot
    });

  }, [length, width, height, pitch, isGable, wallFoamType, wallThickness, roofFoamType, roofThickness, wastePct, laborHours, tripCharge, miscItems, activeTab, settings, pricingMode, sqftPriceWall, sqftPriceRoof]);

  const handleGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        showToast("Location Captured Successfully", "success");
      }, (err) => {
        showToast("Could not capture location: " + err.message, "error");
      });
    } else {
      showToast("Geolocation not supported", "error");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 20MB raw — will be compressed)
      if (file.size > 20 * 1024 * 1024) {
        showToast("Photo too large (max 20MB)", "error");
        return;
      }

      setIsUploadingPhoto(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          showToast("Not authenticated", "error");
          return;
        }
        const result = await uploadJobPhoto(file, session.user.id);
        setImages(prev => [...prev, result.url]);
        setThumbnails(prev => [...prev, result.thumbnailUrl]);
        showToast("Photo Uploaded", "success");
      } catch (err: any) {
        console.error('Photo upload error:', err);
        showToast("Failed to upload photo: " + (err.message || 'Unknown error'), "error");
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const removeImage = async (index: number) => {
    const url = images[index];
    // Delete from storage if it's a storage URL (not legacy base64)
    if (url && !isBase64Image(url)) {
      deleteJobPhoto(url).catch(err => console.error('Failed to delete photo:', err));
    }
    setImages(images.filter((_, i) => i !== index));
    setThumbnails(thumbnails.filter((_, i) => i !== index));
  };

  // --- New Customer Logic ---
  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__NEW__') {
      setShowAddCustomer(true);
      // Don't change selected ID yet
    } else {
      setSelectedCustomerId(val);
    }
  };

  const saveNewCustomer = async () => {
    if (!newCustomer.name) {
      showToast("Name is required", "error");
      return;
    }
    const id = Date.now().toString();
    const customer: Customer = {
      id,
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email,
      address: newCustomer.address,
      city: '',
      state: '',
      zip: '',
      createdAt: new Date().toISOString()
    };
    const saved = await saveCustomer(customer);
    onRefresh(); // Reload data in App
    setSelectedCustomerId(saved.id); // Select the new customer (uses Supabase UUID)
    setShowAddCustomer(false);
    setNewCustomer({ name: '', phone: '', email: '', address: '' });
    showToast("Customer created & selected", "success");
  };

  const handleSave = async (status: JobStatus) => {
    if (!selectedCustomerId) {
      showToast("Please select a customer first", "error");
      return;
    }

    // Generate Items based on Mode
    let finalItems: JobItem[] = [];

    if (pricingMode === 'cost_plus') {
      finalItems = [
        { id: '1', description: 'Spray Foam Material', quantity: 1, unit: 'Lot', unitPrice: results.materialCost, total: results.materialCost },
        { id: '2', description: 'Labor', quantity: laborHours, unit: 'Hours', unitPrice: settings.laborRate, total: results.laborCost },
      ];
    } else {
      // SQFT Mode
      if (results.wallArea > 0) {
        finalItems.push({
          id: '1', 
          description: `Wall Insulation (${wallFoamType})`, 
          quantity: Math.round(results.wallArea), 
          unit: 'SqFt', 
          unitPrice: sqftPriceWall, 
          total: results.wallArea * sqftPriceWall 
        });
      }
      if (results.roofArea > 0) {
        finalItems.push({
          id: '2', 
          description: `Roof/Ceiling Insulation (${roofFoamType})`, 
          quantity: Math.round(results.roofArea), 
          unit: 'SqFt', 
          unitPrice: sqftPriceRoof, 
          total: results.roofArea * sqftPriceRoof 
        });
      }
    }

    // Add Trip Charge and Misc
    if (tripCharge > 0) {
      finalItems.push({ id: '3', description: 'Trip Charge', quantity: 1, unit: 'Flat', unitPrice: tripCharge, total: tripCharge });
    }
    finalItems = [...finalItems, ...miscItems];

    // When editing, preserve the existing ID/number/date; otherwise create new
    const estimateId = editEstimate ? editEstimate.id : Date.now().toString();
    const estimateNumber = editEstimate ? editEstimate.number : `EST-${Math.floor(Math.random() * 10000)}`;
    const estimateDate = editEstimate ? editEstimate.date : new Date().toISOString();
    const inventoryDeducted = editEstimate ? editEstimate.inventoryDeducted : undefined;
    
    const newEstimate: Estimate = {
      id: estimateId,
      number: estimateNumber,
      customerId: selectedCustomerId,
      date: estimateDate,
      status: status,
      jobName: jobName || "Untitled Job",
      jobAddress: jobAddress || undefined,
      location: location,
      images: images,
      thumbnails: thumbnails,
      calcData: {
        length, width, wallHeight: height, roofPitch: pitch, isGable,
        wallFoamType, wallThickness, roofFoamType, roofThickness, wastePct
      },
      pricingMode,
      pricePerSqFtWall: sqftPriceWall,
      pricePerSqFtRoof: sqftPriceRoof,
      totalBoardFeetOpen: results.totalBFOpen,
      totalBoardFeetClosed: results.totalBFClosed,
      setsRequiredOpen: results.setsOpen,
      setsRequiredClosed: results.setsClosed,
      inventoryDeducted: inventoryDeducted,
      items: finalItems,
      subtotal: results.subtotal,
      tax: results.tax,
      total: results.total
    };
    
    const saved = await saveEstimate(newEstimate);
    
    if (isEditMode) {
      showToast("Estimate Updated Successfully", "success");
    } else {
      showToast("Estimate Saved", "success");
    }
    onSave(saved.id, selectedCustomerId);
  };

  const addMiscItem = () => {
    const newItem: JobItem = {
      id: Date.now().toString(),
      description: 'New Item',
      quantity: 1,
      unit: 'Each',
      unitPrice: 0,
      total: 0
    };
    setMiscItems([...miscItems, newItem]);
  };

  const addInventoryItem = () => {
    if (inventory.length === 0) {
      showToast('Add inventory items first before linking to estimate', 'error');
      return;
    }

    const firstItem = inventory[0];
    const newItem: JobItem = {
      id: Date.now().toString(),
      description: firstItem.name,
      quantity: 1,
      unit: firstItem.unit,
      unitPrice: 0,
      total: 0,
      inventoryItemId: firstItem.id,
      inventoryQuantityUsed: 1
    };
    setMiscItems([...miscItems, newItem]);
  };

  const updateMiscItem = (index: number, field: keyof JobItem, value: any) => {
    const newItems = [...miscItems];
    const updatedItem = { ...newItems[index], [field]: value };

    if (field === 'inventoryItemId') {
      if (!value) {
        updatedItem.inventoryItemId = undefined;
        updatedItem.inventoryQuantityUsed = undefined;
      } else {
        const selectedInventory = inventory.find(i => i.id === value);
        if (selectedInventory) {
          updatedItem.description = selectedInventory.name;
          updatedItem.unit = selectedInventory.unit;
          updatedItem.inventoryQuantityUsed = Number(updatedItem.quantity || 1);
        }
      }
    }

    if (field === 'quantity' && updatedItem.inventoryItemId) {
      updatedItem.inventoryQuantityUsed = Number(value);
    }

    updatedItem.total = Number(updatedItem.quantity) * Number(updatedItem.unitPrice);
    newItems[index] = updatedItem;
    setMiscItems(newItems);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20 relative">
      
      {/* --- Add Customer Modal Overlay --- */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-500" />
                New Customer
              </h3>
              <button onClick={() => setShowAddCustomer(false)} className="hover:bg-slate-800 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <input 
                  autoFocus
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" 
                  value={newCustomer.name} 
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input 
                  type="tel"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" 
                  value={newCustomer.phone} 
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input 
                  type="email"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" 
                  value={newCustomer.email} 
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" 
                  value={newCustomer.address} 
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="123 Main St"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowAddCustomer(false)}
                  className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveNewCustomer}
                  className="flex-1 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-900/20"
                >
                  Save & Select
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">{isEditMode ? `Edit: ${editEstimate?.number || 'Estimate'}` : 'Estimator'}</h2>
        <div className="flex gap-2">
           <button 
             onClick={() => setShowPricing(!showPricing)} 
             className="p-2 text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1 border border-slate-200"
             title="Toggle Pricing"
           >
             {showPricing ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
             <span className="text-sm hidden md:inline">{showPricing ? 'Hide Prices' : 'Show Prices'}</span>
           </button>
          {!isEditMode && (
          <button onClick={() => {
            setLength(0); setWidth(0); setMiscItems([]); setImages([]); setThumbnails([]); setLocation(undefined);
            showToast("Estimator Reset", "info");
          }} className="p-2 text-slate-600 hover:bg-slate-100 rounded">
            <RefreshCw className="w-5 h-5" />
          </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Customer & Job Info */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-brand-100 text-brand-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">1</span> 
              Job Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
                <div className="relative">
                  <select 
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-2 border bg-white appearance-none"
                    value={selectedCustomerId}
                    onChange={handleCustomerChange}
                  >
                    <option value="" className="text-slate-400">Select Customer...</option>
                    <option value="__NEW__" className="font-bold text-brand-600 bg-brand-50">
                      + Add New Customer
                    </option>
                    <hr />
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ''}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Name</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-2 border"
                  placeholder="e.g. Smith Residence Attic"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Address</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 p-2 border"
                  placeholder="e.g. 456 Oak Street, Anytown"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                />
              </div>
              
              {/* Site Data */}
              <div className="md:col-span-2 flex flex-col md:flex-row gap-4 mt-2">
                 <button 
                   onClick={handleGPS}
                   className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm ${location ? 'text-green-700 border-green-200 bg-green-50' : 'text-slate-600 border-slate-200'}`}
                 >
                   <MapPin className="w-4 h-4" />
                   {location ? `GPS Captured (${location.accuracy?.toFixed(0)}m acc)` : 'Capture GPS Location'}
                   {location && <Check className="w-4 h-4 ml-1" />}
                 </button>
                 <label className={`flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-lg transition-colors font-medium text-sm ${isUploadingPhoto ? 'bg-slate-100 cursor-wait text-slate-400' : 'hover:bg-slate-50 cursor-pointer text-slate-600'}`}>
                    {isUploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        Upload Site Photo
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingPhoto} />
                 </label>
              </div>
              
              {/* Image Preview */}
              {images.length > 0 && (
                <div className="md:col-span-2 flex gap-2 overflow-x-auto py-2">
                  {images.map((img, idx) => {
                    // Use thumbnail for preview if available, fall back to full image
                    const previewSrc = thumbnails[idx] || img;
                    return (
                      <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm group">
                        <img src={previewSrc} alt="Job site" className="w-full h-full object-cover" loading="lazy" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Geometry */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-200"></div>
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">2</span> 
              Dimensions
            </h3>
            
            <div className="flex bg-slate-100 p-1 rounded-lg mb-6 inline-flex">
              <button 
                onClick={() => setActiveTab('building')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'building' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Full Building
              </button>
              <button 
                onClick={() => setActiveTab('walls')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'walls' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Walls Only
              </button>
              <button 
                onClick={() => setActiveTab('flat')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'flat' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Flat Area
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Length (ft)</label>
                <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none" value={length} onChange={(e) => setLength(Number(e.target.value))} />
              </div>
              <div>
                 <label className="block text-xs uppercase text-slate-500 font-bold mb-1">
                   {activeTab === 'walls' ? 'Height (ft)' : 'Width (ft)'}
                 </label>
                <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
              </div>
              
              {activeTab === 'building' && (
                <>
                  <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Wall Height</label>
                    <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Roof Pitch (/12)</label>
                    <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-brand-500 outline-none" value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
                  </div>
                </>
              )}
            </div>
            
            {activeTab === 'building' && (
              <div className="mt-4">
                <label className="inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500" checked={isGable} onChange={(e) => setIsGable(e.target.checked)} />
                  <span className="ml-2 text-sm text-slate-700">Include Gable Ends?</span>
                </label>
              </div>
            )}
          </div>

          {/* Foam Specs */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-slate-200"></div>
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">3</span> 
              Foam Specification
            </h3>
            
            <div className="space-y-4">
              {(activeTab === 'building' || activeTab === 'walls') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 border-slate-100">
                  <span className="md:col-span-2 font-medium text-sm text-slate-900 bg-slate-50 p-2 rounded">Walls</span>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Type</label>
                    <select className="w-full p-2 border rounded" value={wallFoamType} onChange={(e) => setWallFoamType(e.target.value as FoamType)}>
                      <option>{FoamType.OPEN_CELL}</option>
                      <option>{FoamType.CLOSED_CELL}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Thickness (in)</label>
                    <input type="number" step="0.5" className="w-full p-2 border rounded" value={wallThickness} onChange={(e) => setWallThickness(Number(e.target.value))} />
                  </div>
                </div>
              )}

              {(activeTab === 'building' || activeTab === 'flat') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <span className="md:col-span-2 font-medium text-sm text-slate-900 bg-slate-50 p-2 rounded">Roof / Ceiling</span>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Type</label>
                    <select className="w-full p-2 border rounded" value={roofFoamType} onChange={(e) => setRoofFoamType(e.target.value as FoamType)}>
                      <option>{FoamType.OPEN_CELL}</option>
                      <option>{FoamType.CLOSED_CELL}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Thickness (in)</label>
                    <input type="number" step="0.5" className="w-full p-2 border rounded" value={roofThickness} onChange={(e) => setRoofThickness(Number(e.target.value))} />
                  </div>
                </div>
              )}
              
              <div className="pt-2">
                 <div className="flex justify-between mb-1">
                   <label className="text-xs uppercase text-slate-500 font-bold">Waste Factor</label>
                   <span className="text-xs font-bold text-brand-600">{wastePct}%</span>
                 </div>
                 <input type="range" min="0" max="30" className="w-full accent-brand-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" value={wastePct} onChange={(e) => setWastePct(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* Pricing & Extras */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-slate-200"></div>
             <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="bg-slate-100 text-slate-600 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">4</span> 
              Pricing & Extras
            </h3>

            {/* Pricing Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-lg flex mb-6">
               <button 
                 onClick={() => setPricingMode('cost_plus')}
                 className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${pricingMode === 'cost_plus' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}
               >
                 Cost Plus (Labor + Material)
               </button>
               <button 
                 onClick={() => setPricingMode('sqft')}
                 className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${pricingMode === 'sqft' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500'}`}
               >
                 Price Per Sq. Ft.
               </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {pricingMode === 'cost_plus' ? (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Labor Hours</label>
                  <input type="number" className="w-full p-2 border rounded" value={laborHours} onChange={(e) => setLaborHours(Number(e.target.value))} />
                </div>
              ) : (
                <>
                  {(activeTab !== 'flat') && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Wall Price ($ / SqFt)</label>
                      <input type="number" step="0.01" className="w-full p-2 border rounded border-brand-200 bg-brand-50" value={sqftPriceWall} onChange={(e) => setSqftPriceWall(Number(e.target.value))} />
                    </div>
                  )}
                  {(activeTab !== 'walls') && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Roof Price ($ / SqFt)</label>
                      <input type="number" step="0.01" className="w-full p-2 border rounded border-brand-200 bg-brand-50" value={sqftPriceRoof} onChange={(e) => setSqftPriceRoof(Number(e.target.value))} />
                    </div>
                  )}
                </>
              )}
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Trip Charge ($)</label>
                <input type="number" className="w-full p-2 border rounded" value={tripCharge} onChange={(e) => setTripCharge(Number(e.target.value))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-500">Additional Line Items</label>
                <div className="flex gap-2">
                  <button onClick={addInventoryItem} className="text-xs text-brand-600 hover:bg-brand-50 px-2 py-1 rounded border border-brand-200">
                    + Inventory Item
                  </button>
                  <button onClick={addMiscItem} className="text-xs text-slate-600 hover:bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    + Custom Item
                  </button>
                </div>
              </div>
              {miscItems.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                   <select
                      className="col-span-12 md:col-span-4 p-2 border rounded text-sm bg-white"
                      value={item.inventoryItemId || ''}
                      onChange={(e) => updateMiscItem(idx, 'inventoryItemId', e.target.value)}
                    >
                      <option value="">Custom (Not Tracked)</option>
                      {inventory.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.name} ({Number(inv.quantity.toFixed(2))} {inv.unit})</option>
                      ))}
                    </select>
                    <input 
                      className="col-span-12 md:col-span-4 p-2 border rounded text-sm" 
                      placeholder="Description" 
                      value={item.description} 
                      onChange={(e) => updateMiscItem(idx, 'description', e.target.value)} 
                    />
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      className="col-span-4 md:col-span-1 p-2 border rounded text-sm" 
                      placeholder="Qty" 
                      value={item.quantity} 
                      onChange={(e) => updateMiscItem(idx, 'quantity', Number(e.target.value))} 
                    />
                    <input 
                      type="number" 
                      step="0.01"
                      className="col-span-4 md:col-span-2 p-2 border rounded text-sm" 
                      placeholder="Unit $" 
                      value={item.unitPrice} 
                      onChange={(e) => updateMiscItem(idx, 'unitPrice', Number(e.target.value))} 
                    />
                    <div className="col-span-3 md:col-span-1 text-right text-xs font-semibold text-slate-600">
                      ${item.total.toFixed(2)}
                    </div>
                    <button onClick={() => {
                      const newItems = [...miscItems];
                      newItems.splice(idx, 1);
                      setMiscItems(newItems);
                    }} className="col-span-1 text-red-500 hover:text-red-700 bg-red-50 p-2 rounded">
                      <X className="w-4 h-4"/>
                    </button>
                </div>
              ))}
              {miscItems.length === 0 && (
                <p className="text-xs text-slate-400">No additional items yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results Sticky */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg sticky top-6">
            <h3 className="text-xl font-bold mb-6 border-b border-slate-700 pb-4 flex items-center gap-2">
              <CalcIcon className="w-5 h-5 text-brand-500" /> Estimate Summary
            </h3>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm text-slate-300">
                <span>Wall Area</span>
                <span>{results.wallArea.toFixed(0)} sq ft</span>
              </div>
              <div className="flex justify-between text-sm text-slate-300">
                <span>Roof Area</span>
                <span>{results.roofArea.toFixed(0)} sq ft</span>
              </div>
              <div className="border-t border-slate-700 pt-2"></div>
               <div className="flex justify-between text-sm">
                <span>Open Cell Sets</span>
                <span className="text-brand-400 font-mono">{results.setsOpen.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Closed Cell Sets</span>
                <span className="text-brand-400 font-mono">{results.setsClosed.toFixed(2)}</span>
              </div>
            </div>

            {showPricing && (
              <div className="bg-slate-800 rounded-lg p-4 space-y-2 mb-6 animate-in fade-in zoom-in-95 duration-200 border border-slate-700">
                
                {pricingMode === 'cost_plus' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Materials</span>
                      <span>${results.materialCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Labor</span>
                      <span>${results.laborCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>Installation Price</span>
                    <span>${results.baseCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span>Extras/Fees</span>
                  <span>${(tripCharge + miscItems.reduce((a,b) => a + b.total, 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Tax ({settings.taxRate}%)</span>
                  <span>${results.tax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="border-t border-slate-600 pt-2 mt-2 flex justify-between font-bold text-xl text-white">
                  <span>Total</span>
                  <span>${results.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button 
                onClick={() => handleSave(isEditMode ? editEstimate!.status : JobStatus.DRAFT)}
                className="w-full py-4 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-lg transition-colors text-white shadow-lg shadow-brand-900/50 flex justify-center items-center gap-2 active:scale-[0.98]"
              >
                <Save className="w-5 h-5" /> {isEditMode ? 'Save Changes' : 'Save Estimate'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calculator;