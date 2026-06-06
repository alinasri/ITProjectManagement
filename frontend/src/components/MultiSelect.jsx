import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Checkbox dropdown for selecting multiple {id, name} items.
// Renders its panel into document.body via a portal so it isn't clipped by
// scrollable/overflow ancestors (e.g. table wrappers).
export default function MultiSelect({ items, selectedIds, onChange, placeholder = '— انتخاب کنید —', emptyLabel = 'موردی یافت نشد' }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const updateRect = () => setRect(btnRef.current?.getBoundingClientRect() ?? null);
    updateRect();
    const onClickOutside = (e) => {
      if (btnRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const selectedNames = items.filter(it => selectedIds.includes(it.id)).map(it => it.name);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-indigo-500"
      >
        <span className="truncate">
          {selectedNames.length ? selectedNames.join('، ') : <span className="text-gray-500">{placeholder}</span>}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width }}
          className="z-50 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl scrollbar-thin"
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">{emptyLabel}</p>
          ) : items.map(it => (
            <label key={it.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700/60 cursor-pointer text-sm text-gray-200">
              <input
                type="checkbox"
                checked={selectedIds.includes(it.id)}
                onChange={() => toggle(it.id)}
                className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900"
              />
              {it.name}
            </label>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
