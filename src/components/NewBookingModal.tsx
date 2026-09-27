import React, { useState } from 'react';
import { X, Calendar, User, Phone, MapPin, DollarSign, Clock } from 'lucide-react';
import { JobBooking, TradeType, TradeService } from '../types';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBooking: (booking: Omit<JobBooking, 'id' | 'createdAt'>) => void;
  services: TradeService[];
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  isOpen,
  onClose,
  onAddBooking,
  services,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+1 (555) ');
  const [address, setAddress] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('09:00 AM - 11:00 AM');
  const [estimateAmount, setEstimateAmount] = useState<number>(250);
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleServiceChange = (id: string) => {
    setSelectedServiceId(id);
    const found = services.find(s => s.id === id);
    if (found) {
      setEstimateAmount(found.basePrice);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) return;

    const matchedService = services.find(s => s.id === selectedServiceId);

    onAddBooking({
      customerName,
      customerPhone,
      address: address || '123 Main St',
      tradeType: matchedService ? matchedService.trade : 'plumbing',
      serviceTitle: matchedService ? matchedService.title : 'General Trade Repair',
      date,
      timeSlot,
      status: 'scheduled',
      estimateAmount: Number(estimateAmount),
      notes,
      urgency,
      createdFrom: 'manual',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-neutral-200">
        
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h3 className="text-base font-bold text-neutral-900 font-head">
            Create New Dispatch Job
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Customer Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Thomas Vance"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1">Customer Phone Number</label>
              <input
                type="text"
                required
                placeholder="+1 (555) 000-0000"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 font-mono focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Service Job Address</label>
            <input
              type="text"
              required
              placeholder="e.g. 520 Elm Wood Court, Springfield"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Service Type</label>
            <select
              value={selectedServiceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white focus:outline-none"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} (${s.basePrice} · {s.durationHours} hrs)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 mb-1">Appointment Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1">Time Slot Window</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white"
              >
                <option value="08:30 AM - 10:30 AM">08:30 AM - 10:30 AM</option>
                <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                <option value="01:30 PM - 03:30 PM">01:30 PM - 03:30 PM</option>
                <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 mb-1">Quote Estimate ($)</label>
              <input
                type="number"
                min="0"
                step="10"
                value={estimateAmount}
                onChange={(e) => setEstimateAmount(Number(e.target.value))}
                className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white font-mono count-up tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 mb-1">Job Notes / Problem Details</label>
            <textarea
              rows={2}
              placeholder="e.g. Shutoff valve stuck, customer has water turned off at street meter."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-3 py-1.5 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold rounded bg-neutral-900 text-white hover:bg-neutral-800"
            >
              Save to Dispatch Schedule
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
