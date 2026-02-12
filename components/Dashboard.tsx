import React, { useMemo } from 'react';
import { Estimate, InventoryItem, JobStatus } from '../types';
import { DollarSign, FileText, AlertTriangle, Activity, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  estimates: Estimate[];
  inventory: InventoryItem[];
  onNavigate: (view: string, context?: { customerId?: string; jobId?: string }) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ estimates, inventory, onNavigate }) => {
  const stats = useMemo(() => {
    const pipeline = estimates
      .filter(e => e.status !== JobStatus.ARCHIVED && e.status !== JobStatus.PAID)
      .reduce((acc, curr) => acc + curr.total, 0);

    const activeWorkOrders = estimates.filter(e => e.status === JobStatus.WORK_ORDER).length;
    const pendingInvoices = estimates.filter(e => e.status === JobStatus.INVOICED).length;
    
    const lowStockItems = inventory.filter(i => i.quantity <= i.minLevel);

    // Chart Data
    const statusData = [
      { name: 'Draft', value: estimates.filter(e => e.status === JobStatus.DRAFT).length },
      { name: 'Work Order', value: activeWorkOrders },
      { name: 'Invoiced', value: pendingInvoices },
      { name: 'Paid', value: estimates.filter(e => e.status === JobStatus.PAID).length },
    ];

    return { pipeline, activeWorkOrders, pendingInvoices, lowStockItems, statusData };
  }, [estimates, inventory]);

  const COLORS = ['#94a3b8', '#f97316', '#3b82f6', '#22c55e'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500">Welcome back! Here is your business overview.</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => onNavigate('calculator')}
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors w-full md:w-auto justify-center"
          >
            <Activity className="w-4 h-4" /> New Estimate
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pipeline Value</p>
              <h3 className="text-2xl font-bold text-slate-900">${stats.pipeline.toLocaleString()}</h3>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Active Work Orders</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.activeWorkOrders}</h3>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Activity className="w-6 h-6 text-brand-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Invoices</p>
              <h3 className="text-2xl font-bold text-slate-900">{stats.pendingInvoices}</h3>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Low Stock Alerts</p>
              <h3 className={`text-2xl font-bold ${stats.lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {stats.lowStockItems.length}
              </h3>
            </div>
            <div className={`${stats.lowStockItems.length > 0 ? 'bg-red-100' : 'bg-slate-100'} p-3 rounded-lg`}>
              <AlertTriangle className={`w-6 h-6 ${stats.lowStockItems.length > 0 ? 'text-red-600' : 'text-slate-600'}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <button onClick={() => onNavigate('jobs')} className="text-sm text-brand-600 hover:text-brand-700">View All</button>
          </div>
          
          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-slate-100">
             {estimates.slice(0, 5).map((est) => (
                <div key={est.id} className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => onNavigate('jobDetail', { jobId: est.id })}>
                   <div>
                      <p className="font-bold text-slate-900">{est.jobName}</p>
                      <p className="text-xs text-slate-500">{new Date(est.date).toLocaleDateString()} • {est.number}</p>
                   </div>
                   <div className="text-right">
                      <p className="font-bold text-slate-900">${est.total.toLocaleString()}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1
                        ${est.status === JobStatus.PAID ? 'bg-green-100 text-green-800' : 
                          est.status === JobStatus.WORK_ORDER ? 'bg-orange-100 text-brand-800' :
                          est.status === JobStatus.INVOICED ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'}`}>
                        {est.status}
                      </span>
                   </div>
                </div>
             ))}
             {estimates.length === 0 && <div className="p-6 text-center text-slate-400">No recent jobs.</div>}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Job #</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estimates.slice(0, 5).map((est) => (
                  <tr key={est.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onNavigate('jobDetail', { jobId: est.id })}>
                    <td className="px-5 py-3 font-medium text-slate-900">{est.number}</td>
                    <td className="px-5 py-3">{est.jobName}</td>
                    <td className="px-5 py-3">{new Date(est.date).toLocaleDateString()}</td>
                    <td className="px-5 py-3 font-medium">${est.total.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${est.status === JobStatus.PAID ? 'bg-green-100 text-green-800' : 
                          est.status === JobStatus.WORK_ORDER ? 'bg-orange-100 text-brand-800' :
                          est.status === JobStatus.INVOICED ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'}`}>
                        {est.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {estimates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No recent jobs found. Create an estimate to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts / Inventory Snapshot */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-64">
             <h3 className="font-semibold text-slate-800 mb-4">Job Status Overview</h3>
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.statusData}>
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {stats.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex-1">
            <h3 className="font-semibold text-slate-800 mb-4">Inventory Watch</h3>
            {stats.lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 py-4">
                <Package className="w-8 h-8 mb-2 text-green-500 opacity-50" />
                <p>Stock levels are good</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.lowStockItems.map(item => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                      {Number(item.quantity.toFixed(2))} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button 
              onClick={() => onNavigate('inventory')}
              className="mt-4 w-full text-center text-sm text-brand-600 hover:underline"
            >
              Manage Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;