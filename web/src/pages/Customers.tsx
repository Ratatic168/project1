import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateTime } from '../format';
import type { Customer } from '../types';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.customers().then(setCustomers).catch(() => setCustomers([]));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createCustomer({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() });
      setForm({ name: '', phone: '', email: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <h1 className="page-title">Клиенты</h1>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Скрыть форму' : '+ Добавить клиента'}
        </button>
      </div>
      <p className="page-sub">Получатели заказов пункта выдачи</p>

      {showForm && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
          <h3 style={{ marginTop: 0 }}>Новый клиент</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="field">
              <label>ФИО *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Сохранение…' : 'Сохранить клиента'}
          </button>
        </form>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Добавлен</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b>
                </td>
                <td>{c.phone}</td>
                <td className="muted">{c.email}</td>
                <td className="muted">{formatDateTime(c.createdAt)}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  Клиенты не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
