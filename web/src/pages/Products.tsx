import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatMoney } from '../format';
import type { Product } from '../types';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sku: '', name: '', barcode: '', category: '', price: '', weight: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.products().then(setProducts).catch(() => setProducts([]));
  useEffect(() => {
    load();
  }, []);

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? '').includes(search),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        barcode: form.barcode.trim(),
        category: form.category.trim(),
        price: Number(form.price) || 0,
        weight: Number(form.weight) || 0.5,
      });
      setForm({ sku: '', name: '', barcode: '', category: '', price: '', weight: '' });
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
        <h1 className="page-title">Товары</h1>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Скрыть форму' : '+ Добавить товар'}
        </button>
      </div>
      <p className="page-sub">Каталог товаров, которые могут быть размещены на складе</p>

      {showForm && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
          <h3 style={{ marginTop: 0 }}>Новый товар</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="field">
              <label>SKU *</label>
              <input className="input" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="field">
              <label>Название *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Штрихкод</label>
              <input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
            <div className="field">
              <label>Категория</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="field">
              <label>Цена, ₽</label>
              <input className="input" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="field">
              <label>Вес, кг</label>
              <input className="input" type="number" step="0.01" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Сохранение…' : 'Сохранить товар'}
          </button>
        </form>
      )}

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Поиск по названию, SKU или штрихкоду…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Название</th>
              <th>Категория</th>
              <th>Штрихкод</th>
              <th>Габариты (ШхВхГ), м</th>
              <th>Вес, кг</th>
              <th>Цена</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.sku}</b>
                </td>
                <td>{p.name}</td>
                <td className="muted">{p.category}</td>
                <td className="muted">{p.barcode}</td>
                <td className="muted">
                  {p.width} × {p.height} × {p.depth}
                </td>
                <td>{p.weight}</td>
                <td>{formatMoney(p.price)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  Товары не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
