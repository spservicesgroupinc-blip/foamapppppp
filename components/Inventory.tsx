import React, { useState, useCallback, useRef } from 'react';
import { InventoryItem } from '../types';
import { Package, AlertTriangle, PlusCircle, MinusCircle, Trash2, Plus, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { saveInventoryItem, deleteInventoryItem } from '../services/storage';
import { useToast } from './Toast';

interface InventoryProps {
  items: InventoryItem[];
  onRefresh: () => void;
  onOptimisticUpdate?: (updatedItems: InventoryItem[]) => void;
}

const Inventory: React.FC<InventoryProps> = ({ items, onRefresh, onOptimisticUpdate }) => {
  const { showToast } = useToast();
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '',
    category: 'Supply',
    quantity: 0,
    unit: 'Pcs',
    minLevel: 1
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Optimistic update helper - updates local state immediately, persists in background
  const optimisticSave = useCallback(async (updatedItem: InventoryItem) => {
    // Update local state immediately via parent
    if (onOptimisticUpdate) {
      const updatedItems = items.map(i => i.id === updatedItem.id ? updatedItem : i);
      onOptimisticUpdate(updatedItems);
    }
    // Persist to DB in background
    setSavingIds(prev => new Set(prev).add(updatedItem.id));
    try {
      await saveInventoryItem(updatedItem);
    } catch (err) {
      console.error('Failed to save inventory item:', err);
      showToast('Failed to save changes', 'error');
      onRefresh(); // Revert on error
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(updatedItem.id); return n; });
    }
  }, [items, onOptimisticUpdate, onRefresh, showToast]);

  const handleAdjust = useCallback((item: InventoryItem, delta: number) => {
    const rawNewQty = Math.max(0, item.quantity + delta);
    const updatedItem = { ...item, quantity: Number(rawNewQty.toFixed(2)) };
    optimisticSave(updatedItem);
  }, [optimisticSave]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name?.trim()) {
      showToast('Inventory item name is required', 'error');
      return;
    }

    setIsAdding(true);
    const itemToSave: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name.trim(),
      category: (newItem.category as InventoryItem['category']) || 'Supply',
      quantity: Number(newItem.quantity || 0),
      unit: newItem.unit?.trim() || 'Pcs',
      minLevel: Number(newItem.minLevel || 1),
    };

    // Optimistically add to list
    if (onOptimisticUpdate) {
      onOptimisticUpdate([...items, itemToSave]);
    }

    try {
      await saveInventoryItem(itemToSave);
      // Do a full refresh to get the real Supabase UUID for the new item
      onRefresh();
    } catch (err) {
      showToast('Failed to add item', 'error');
      onRefresh();
    }
    
    setNewItem({
      name: '',
      category: 'Supply',
      quantity: 0,
      unit: 'Pcs',
      minLevel: 1
    });
    setIsAdding(false);
    setShowAddForm(false);
    showToast('Inventory item added', 'success');
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    const confirmed = window.confirm(`Delete inventory item "${item.name}"? This cannot be undone.`);
    if (!confirmed) return;
    
    // Optimistically remove
    if (onOptimisticUpdate) {
      onOptimisticUpdate(items.filter(i => i.id !== item.id));
    }
    
    try {
      await deleteInventoryItem(item.id);
      showToast('Inventory item deleted', 'success');
    } catch (err) {
      showToast('Failed to delete item', 'error');
      onRefresh();
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, category: item.category, unit: item.unit, minLevel: item.minLevel, quantity: item.quantity });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (item: InventoryItem) => {
    if (!editForm.name?.trim()) {
      showToast('Item name is required', 'error');
      return;
    }
    const updatedItem: InventoryItem = {
      ...item,
      name: editForm.name!.trim(),
      category: (editForm.category as InventoryItem['category']) || item.category,
      unit: editForm.unit?.trim() || item.unit,
      minLevel: Number(editForm.minLevel ?? item.minLevel),
      quantity: Number(editForm.quantity ?? item.quantity),
    };
    setEditingId(null);
    setEditForm({});
    await optimisticSave(updatedItem);
    showToast('Item updated', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all ${
            showAddForm
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-md'
          }`}
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Add New Item
            </>
          )}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-white p-6 rounded-xl border-2 border-brand-200 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-brand-100 rounded-lg">
              <Package className="w-5 h-5 text-brand-600" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">New Inventory Item</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
                placeholder="e.g. Closed Cell Foam Set, Gun Tips, Hose Wrap..."
                value={newItem.name || ''}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <select
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
                value={newItem.category || 'Supply'}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InventoryItem['category'] })}
              >
                <option value="Material">Material</option>
                <option value="Equipment">Equipment</option>
                <option value="Supply">Supply</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Unit of Measure</label>
              <input
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
                placeholder="e.g. Sets, Pcs, Cans, Rolls..."
                value={newItem.unit || ''}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Starting Quantity</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
                placeholder="0"
                value={newItem.quantity ?? 0}
                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Minimum Stock Level
                <span className="text-slate-400 font-normal ml-1">(alert threshold)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
                placeholder="1"
                value={newItem.minLevel ?? 1}
                onChange={(e) => setNewItem({ ...newItem, minLevel: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewItem({ name: '', category: 'Supply', quantity: 0, unit: 'Pcs', minLevel: 1 }); }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding || !newItem.name?.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              {isAdding ? 'Adding...' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !showAddForm && (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No inventory items yet</h3>
          <p className="text-sm text-slate-500 mb-4">Get started by adding your first item to track stock levels.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="w-4 h-4" /> Add Your First Item
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => {
          const isEditing = editingId === item.id;
          const isSaving = savingIds.has(item.id);

          return (
          <div key={item.id} className={`bg-white p-6 rounded-xl border shadow-sm transition-all ${isSaving ? 'border-brand-300 opacity-90' : 'border-slate-200'}`}>
            {isEditing ? (
              /* --- Inline Edit Mode --- */
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-brand-600">Editing Item</span>
                  <div className="flex gap-1">
                    <button onClick={() => saveEdit(item)} className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Name</label>
                  <input className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Category</label>
                    <select className="w-full p-2 border rounded text-sm bg-white" value={editForm.category || 'Supply'} onChange={e => setEditForm({...editForm, category: e.target.value as InventoryItem['category']})}>
                      <option value="Material">Material</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Supply">Supply</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Unit</label>
                    <input className="w-full p-2 border rounded text-sm" value={editForm.unit || ''} onChange={e => setEditForm({...editForm, unit: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Quantity</label>
                    <input type="number" step="0.01" min="0" className="w-full p-2 border rounded text-sm" value={editForm.quantity ?? 0} onChange={e => setEditForm({...editForm, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Min Level</label>
                    <input type="number" step="0.01" min="0" className="w-full p-2 border rounded text-sm" value={editForm.minLevel ?? 1} onChange={e => setEditForm({...editForm, minLevel: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
            ) : (
              /* --- Normal Display Mode --- */
              <>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${item.quantity <= item.minLevel ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <Package className="w-6 h-6" />
                     </div>
                     <div>
                       <h3 className="font-bold text-slate-900">{item.name}</h3>
                       <span className="text-xs text-slate-500 uppercase tracking-wider">{item.category}</span>
                     </div>
                  </div>
                  {item.quantity <= item.minLevel && (
                    <div className="flex items-center gap-1 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded">
                       <AlertTriangle className="w-3 h-3" /> LOW STOCK
                    </div>
                  )}
                </div>

                <div className="mb-3 flex justify-end gap-2">
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>

                <div className="flex items-end justify-between">
                   <div>
                      <p className="text-xs text-slate-500 mb-1">Current Stock</p>
                      <div className="text-3xl font-bold text-slate-800">
                        {Number(item.quantity.toFixed(2))} <span className="text-base font-normal text-slate-400">{item.unit}</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleAdjust(item, -1)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <MinusCircle className="w-8 h-8" />
                      </button>
                      <button 
                        onClick={() => handleAdjust(item, 1)}
                        className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      >
                        <PlusCircle className="w-8 h-8" />
                      </button>
                   </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-slate-100">
                   <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${item.quantity <= item.minLevel ? 'bg-red-500' : 'bg-brand-500'}`} 
                        style={{ width: `${Math.min(100, (item.quantity / (item.minLevel * 2)) * 100)}%` }}
                      ></div>
                   </div>
                   <div className="flex justify-between text-xs text-slate-400 mt-1">
                     <span>0</span>
                     <span>Min: {item.minLevel}</span>
                     <span>Target: {item.minLevel * 2}</span>
                   </div>
                </div>
              </>
            )}
          </div>
        )})}
      </div>
    </div>
  );
};

export default Inventory;