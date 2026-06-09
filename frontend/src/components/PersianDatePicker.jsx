import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_en from 'react-date-object/locales/persian_en';

const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const DAY_HEADERS = ['ش','ی','د','س','چ','پ','ج'];

function makeDate(year, month, day = 1) {
  return new DateObject({ year, month, day, calendar: persian, locale: persian_en });
}

function parseValue(val) {
  if (!val) return null;
  const parts = val.split('/').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  return { year: y, month: m, day: d };
}

export default function PersianDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef();

  const today = new DateObject({ calendar: persian, locale: persian_en });
  const parsed = parseValue(value);

  const [viewYear, setViewYear] = useState(() => parsed?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? today.month.number);

  const openCalendar = () => {
    const rect = inputRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest('[data-persian-picker]')) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const first = makeDate(viewYear, viewMonth);
  const daysInMonth = first.month.length;
  const startIndex = first.weekDay.index;

  const navigate = (delta) => {
    const d = makeDate(viewYear, viewMonth);
    if (delta > 0) d.add(1, 'month'); else d.subtract(1, 'month');
    setViewYear(d.year);
    setViewMonth(d.month.number);
  };

  const pick = (day) => {
    onChange(`${viewYear}/${String(viewMonth).padStart(2,'0')}/${String(day).padStart(2,'0')}`);
    setOpen(false);
  };

  const cells = [...Array(startIndex).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const calendar = open && createPortal(
    <div
      data-persian-picker
      dir="rtl"
      style={{ position: 'absolute', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
      className="bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-3 w-60"
    >
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => navigate(1)}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-base leading-none">«</button>
        <span className="text-white text-sm font-medium">{MONTHS[viewMonth - 1]} {viewYear}</span>
        <button type="button" onClick={() => navigate(-1)}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-base leading-none">»</button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {DAY_HEADERS.map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          const isSel = day && parsed && viewYear === parsed.year && viewMonth === parsed.month && day === parsed.day;
          const isToday = day && viewYear === today.year && viewMonth === today.month.number && day === today.day;
          return (
            <button
              key={i}
              type="button"
              onClick={() => day && pick(day)}
              className={[
                'h-7 w-7 mx-auto flex items-center justify-center rounded-full text-xs',
                !day ? 'invisible pointer-events-none' :
                isSel ? 'bg-indigo-600 text-white' :
                isToday ? 'border border-indigo-500 text-indigo-300 hover:bg-gray-700' :
                'text-gray-300 hover:bg-gray-700 cursor-pointer',
              ].join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>

      {value && (
        <button type="button" onClick={() => { onChange(''); setOpen(false); }}
          className="mt-2 w-full text-xs text-gray-600 hover:text-gray-400 text-center block">
          پاک کردن
        </button>
      )}
    </div>,
    document.body
  );

  return (
    <div dir="rtl">
      <input
        ref={inputRef}
        data-persian-picker
        readOnly
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
        value={value || ''}
        onClick={openCalendar}
        placeholder="انتخاب تاریخ"
      />
      {calendar}
    </div>
  );
}
