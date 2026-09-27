import React, { useState } from 'react';
import { Plus, Trash2, Edit3, DollarSign, Clock, Check, Sparkles, Wrench } from 'lucide-react';
import { TradeService, TradeType } from '../types';
import { formatCurrency } from '../lib/utils';
import { EmptyState } from './EmptyState';

interface ServiceCatalogProps {
  services: TradeService[];
  onAddService: (newService: Omit<TradeService, 'id'>) => void;
  onDeleteService: (id: string) => void;
}

export const ServiceCatalog: React.FC<ServiceCatalogProps> = ({
  services,
  onAddService,
  onDeleteService,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTrade, setNewTrade] = useState<TradeType>('plumbing');
  const [newPrice, setNewPrice] = useState<number>(250);
  const [newDuration, setNewDuration] = useState<number>(2);
  const [newDesc, setNewDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddService({
      title: newTitle,
      trade: newTrade,
      basePrice: Number(newPrice),
      durationHours: Number(newDuration),
      description: newDesc || 'Standard trade service diagnostic and repair.',
      isPopular: false,
    });

    setNewTitle('');
    setNewDesc('');
    setNewPrice(250);
    setNewDuration(2);
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-neutral-200 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-neutral-900 font-head">
            Trade Rates &amp; Service Catalog
          </h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            RidgeLine AI references these rates to quote prices and calculate slot lengths automatically over SMS.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{showAddForm ? 'Cancel' : 'Add Service'}</span>
        </button>
      </div>

      {/* Add New Service Drawer/Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border border-neutral-300 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-neutral-900 font-head">Add New Service to AI Catalog</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 mb-1">Service Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Tankless Water Heater Flush"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 mb-1">Trade Category</label>
              <select
                value={newTrade}
                onChange={(e) => setNewTrade(e.target.value as TradeType)}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
              >
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="hvac">HVAC</option>
                <option value="locksmith">Locksmith</option>
                <option value="general">General Contractor</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 mb-1">Base Price ($)</label>
              <input
                type="number"
                min="0"
                step="10"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 mb-1">Duration (Hours)</label>
              <input
                type="number"
                min="0.5"
                max="8"
                step="0.5"
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-700 mb-1">Description / Diagnostic Scope</label>
            <input
              type="text"
              placeholder="What is included in this service?"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold rounded bg-neutral-900 text-white hover:bg-neutral-800"
            >
              Save Service
            </button>
          </div>
        </form>
      )}

      {/* Services List Table */}
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Service Price Book is Empty"
          description="Add your trade rates and standard service calls so RidgeLine AI can quote accurate prices and estimate slot durations when homeowners text."
          primaryAction={{
            label: '+ Add Trade Service',
            onClick: () => setShowAddForm(true),
            icon: Plus,
          }}
          tip="RidgeLine uses your base prices and duration hours to automatically find fitting slots on your calendar."
          badge="Price Book"
        />
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-xs">
          <div className="divide-y divide-neutral-100">
            {services.map((service) => (
              <div key={service.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-neutral-50/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900 font-head">
                      {service.title}
                    </h4>
                    <span className="text-[10px] uppercase font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                      {service.trade}
                    </span>
                    {service.isPopular && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                        High Demand
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 max-w-xl">
                    {service.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-sm font-bold text-neutral-900 font-mono count-up tabular-nums">
                      {formatCurrency(service.basePrice)}
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">{service.durationHours} hrs</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteService(service.id)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove from catalog"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
