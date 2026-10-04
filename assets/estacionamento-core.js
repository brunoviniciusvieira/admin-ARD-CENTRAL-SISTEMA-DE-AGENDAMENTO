(function (root) {
  'use strict';
  const DAY = 86400000;
  function day(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Informe uma data válida.');
    const date = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '9990-12-31') throw new Error('Informe uma data válida entre 1900 e 9990.');
    return date.getTime() / DAY;
  }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function due(start, days) { return new Date((day(start) + Number(days)) * DAY).toISOString().slice(0,10); }
  function phone(value) { let digits = value.replace(/\D/g,''); if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2); if (!/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits)) throw new Error('Informe um telefone brasileiro válido com DDD.'); return '55' + digits; }
  function validate(input) {
    const name = String(input.name || '').trim(), car = String(input.car || '').trim(), plate = String(input.plate || '').replace(/[-\s]/g,'').toUpperCase();
    if (!name || name.length > 100 || !car || car.length > 80) throw new Error('Preencha nome e carro corretamente.');
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(plate)) throw new Error('Informe uma placa válida, como ABC1234 ou ABC1D23.');
    const days = Number(input.days); if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('A duração deve ser de 1 a 3650 dias.');
    day(input.start); due(input.start, days);
    return { name, car, plate, phone:phone(String(input.phone || '')), start:input.start, days };
  }
  function status(client, date = today()) { const remaining = day(due(client.start,client.days)) - day(date); return { remaining, due:due(client.start,client.days), kind: remaining <= 0 ? 'expired' : day(client.start) > day(date) ? 'scheduled' : remaining <= 5 ? 'soon' : 'active' }; }
  root.ParkingCore = { day, today, due, phone, validate, status };
})(typeof window !== 'undefined' ? window : globalThis);
