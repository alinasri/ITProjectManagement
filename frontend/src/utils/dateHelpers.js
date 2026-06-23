import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import gregorian from 'react-date-object/calendars/gregorian';

export function toPersianDate(isoStr) {
  if (!isoStr) return null;
  return new DateObject(new Date(isoStr + 'T00:00:00')).convert(persian, persian_fa).format('D MMMM YYYY');
}

export function isoToPersianPicker(isoStr) {
  if (!isoStr) return '';
  const d = new DateObject(new Date(isoStr + 'T00:00:00')).convert(persian);
  return `${d.year}/${String(d.month.number).padStart(2, '0')}/${String(d.day).padStart(2, '0')}`;
}

export function persianPickerToISO(persianStr) {
  if (!persianStr) return '';
  const [y, m, d] = persianStr.split('/').map(Number);
  return new DateObject({ year: y, month: m, day: d, calendar: persian }).convert(gregorian).format('YYYY-MM-DD');
}

export function contractExpiryTag(c) {
  if (!['active', 'renewed'].includes(c.status) || !c.end_date) return null;
  const parts = c.end_date.split('/').map(Number);
  if (parts.length !== 3) return null;
  try {
    const g = new DateObject({ year: parts[0], month: parts[1], day: parts[2], calendar: persian }).convert(gregorian);
    const end = new Date(g.year, g.month.number - 1, g.day);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in60 = new Date(today); in60.setDate(in60.getDate() + 60);
    if (end < today) return 'expired';
    if (end <= in60) return 'expiring';
  } catch (_) {}
  return null;
}
