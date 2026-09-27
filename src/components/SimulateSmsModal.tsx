import React, { useState } from 'react';
import { X, Send, Sparkles, Smartphone, CheckCheck } from 'lucide-react';
import { AssistantSettings } from '../types';

interface SimulateSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendTestSms: (text: string, customerName?: string, customerPhone?: string) => Promise<string>;
  settings: AssistantSettings;
}

export const SimulateSmsModal: React.FC<SimulateSmsModalProps> = ({
  isOpen,
  onClose,
  onSendTestSms,
  settings,
}) => {
  const [messages, setMessages] = useState<Array<{ sender: 'customer' | 'assistant'; text: string; time: string }>>([
    {
      sender: 'assistant',
      text: `Hi! This is Mark's assistant with ${settings.businessName}. How can we help you today? Reply here to schedule or request an estimate.`,
      time: 'Just now',
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (presetText?: string) => {
    const text = presetText || inputText;
    if (!text.trim() || isTyping) return;

    if (!presetText) {
      setInputText('');
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'customer', text, time }]);
    setIsTyping(true);

    try {
      const reply = await onSendTestSms(text, 'Test Homeowner', '+1 (555) 777-1234');
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `Got your message! Mark has you on the calendar for tomorrow morning. We'll text 15m before arrival.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-sm rounded-[36px] bg-neutral-900 p-3 shadow-2xl border-4 border-neutral-800">
        
        {/* Phone Notch & Speaker */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 h-4 w-28 bg-neutral-900 rounded-b-xl z-20 flex items-center justify-center">
          <div className="h-1 w-10 bg-neutral-700 rounded-full" />
        </div>

        {/* Screen Container */}
        <div className="flex flex-col h-[580px] bg-neutral-100 rounded-[28px] overflow-hidden">
          
          {/* Phone Header */}
          <div className="bg-neutral-200/90 pt-8 pb-3 px-4 border-b border-neutral-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
                M
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 font-head">{settings.businessName}</h4>
                <p className="text-[10px] text-neutral-500 font-mono">{settings.twilioPhoneNumber}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-6 w-6 rounded-full bg-neutral-300 hover:bg-neutral-400 flex items-center justify-center text-neutral-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === 'customer' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-2xs leading-relaxed ${
                    m.sender === 'customer'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-white text-neutral-900 border border-neutral-200 rounded-bl-xs'
                  }`}
                >
                  <p>{m.text}</p>
                </div>
                <span className="text-[9px] text-neutral-400 mt-0.5 px-1 font-mono">
                  {m.time}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-2xl rounded-bl-xs px-3 py-2 w-16 text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="bg-neutral-200/50 p-2 border-t border-neutral-200 flex gap-1.5 overflow-x-auto text-[10px] scrollbar-none">
            <button
              onClick={() => handleSend("Can I book a drain snaking for tomorrow afternoon?")}
              className="px-2 py-1 bg-white rounded shadow-2xs whitespace-nowrap hover:bg-neutral-50 text-neutral-800"
            >
              Drain Snaking
            </button>
            <button
              onClick={() => handleSend("Hey Mark, can we reschedule to 3pm instead?")}
              className="px-2 py-1 bg-white rounded shadow-2xs whitespace-nowrap hover:bg-neutral-50 text-neutral-800"
            >
              Reschedule to 3pm
            </button>
            <button
              onClick={() => handleSend("Water is flooding from the ceiling!")}
              className="px-2 py-1 bg-red-100 text-red-800 rounded shadow-2xs whitespace-nowrap hover:bg-red-200"
            >
              Flooding!
            </button>
          </div>

          {/* Message Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t border-neutral-200 flex items-center gap-1.5"
          >
            <input
              type="text"
              placeholder="Text message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-neutral-100 rounded-full px-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="h-7 w-7 rounded-full bg-blue-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
