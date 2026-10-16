import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, formatDateTime, formatMoney } from '../format';
import type { Order, OrderStatus } from '../types';

const FILTERS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Все' },
  { key: 'accepted', label: 'Принят' },
  { key: 'stored', label: 'Размещён' },
  { key: 'ready', label: 'Готов к выдаче' },
  { key: 'issued', label: 'Выдан' },
  { key: 'in_transit', label: 'В пути' },
  { key: 'cancelled', label: 'Отменён' },
];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .orders({ status, search })
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [status, search]);

  return (
    <div>
      <h1 className="page-title">Заказы</h1>
      <p className="page-sub">Приёмка, размещение в ячейках и выдача получателям</p>

      <div className="toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Поиск: номер заказа или клиент…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={status === f.key ? 'active' : ''} onClick={() => setStatus(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty">
            <span className="spinner" /> Загрузка…
          </div>
        ) : orders.length === 0 ? (
          <div className="empty">Заказы не найдены</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Номер</th>
                <th>Клиент</th>
                <th>Статус</th>
                <th>Позиций</th>
                <th>Сумма</th>
                <th>Создан</th>
                <th>Выдан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/orders/${o.id}`}>
                      <b>{o.number}</b>
                    </Link>
                  </td>
                  <td>{o.customerName}</td>
                  <td>
                    <span className="badge" style={{ background: ORDER_STATUS_COLOR[o.status] }}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td>{o.itemsCount}</td>
                  <td>{formatMoney(o.total)}</td>
                  <td className="muted">{formatDateTime(o.createdAt)}</td>
                  <td className="muted">{formatDateTime(o.issuedAt)}</td>
                  <td>
                    <Link to={`/orders/${o.id}`} className="btn sm">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}