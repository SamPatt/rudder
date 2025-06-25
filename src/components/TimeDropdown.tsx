import React from 'react';

interface TimeDropdownProps {
  value: string; // 'HH:mm' 24h format
  onChange: (newValue: string) => void;
  label?: string;
}

const hours12 = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
const ampm = ['AM', 'PM'];

function to12Hour(hhmm: string) {
  let [h, m] = hhmm.split(':').map(Number);
  const am = h < 12;
  if (h === 0) h = 12;
  if (h > 12) h -= 12;
  return {
    hour: h.toString().padStart(2, '0'),
    minute: m.toString().padStart(2, '0'),
    ampm: am ? 'AM' : 'PM',
  };
}

function to24Hour(hour: string, minute: string, ampmVal: string) {
  let h = parseInt(hour, 10);
  if (ampmVal === 'PM' && h !== 12) h += 12;
  if (ampmVal === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute}`;
}

export default function TimeDropdown({ value, onChange, label }: TimeDropdownProps) {
  const { hour, minute, ampm: ampmVal } = to12Hour(value);

  function handleChange(newHour: string, newMinute: string, newAMPM: string) {
    onChange(to24Hour(newHour, newMinute, newAMPM));
  }

  return (
    <div className="inline-block">
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
      <div className="flex gap-2">
        {/* Hour */}
        <select
          className="bg-slate-700 text-white rounded px-2 py-1"
          value={hour}
          onChange={e => handleChange(e.target.value, minute, ampmVal)}
        >
          {hours12.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        {/* Minute */}
        <select
          className="bg-slate-700 text-white rounded px-2 py-1"
          value={minute}
          onChange={e => handleChange(hour, e.target.value, ampmVal)}
        >
          {minutes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {/* AM/PM */}
        <select
          className="bg-slate-700 text-white rounded px-2 py-1"
          value={ampmVal}
          onChange={e => handleChange(hour, minute, e.target.value)}
        >
          {ampm.map(ap => <option key={ap} value={ap}>{ap}</option>)}
        </select>
      </div>
    </div>
  );
} 