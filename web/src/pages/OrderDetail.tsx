import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, formatDateTime, formatMoney } from '../format';
import OrderLocation from '../components/OrderLocation';
import type { Order, OrderStatus } from '../types';

/** Какое действие доступно на текущем статусе заказа. */
function nextAction(status: OrderStatus): { action: 'accept' | 'store' | 'ready' | 'issue'; label: string } | null {
  switch (status) {
    case 'created':
    case 'in_transit':
      return { action: 'accept', label: 'Принять на склад' };
    case 'accepted':
      return { action: 'store', label: 'Разместить в ячейки' };
    case 'stored':
      return { action: 'ready', label: 'Готов к выдаче' };
    case 'ready':
      return { action: 'issue', label: 'Выдать получателю' };
    default:
      return null;
  }
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    api
      .order(Number(id))
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [id]);

  useEffect(load, [load]);

  const run = async (fn: (id: number) => Promise<unknown>) => {
    if (!order) return;
    setBusy(true);
    setError('');
    try {
      await fn(order.id);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const locatedItems = useMemo(() => (order?.items ?? []).filter((it) => it.locationId != null), [order]);

  if (!order) return <div className="empty">Загрузка…</div>;

  const next = nextAction(order.status);
  const canCancel = ['created', 'in_transit', 'accepted', 'stored', 'ready'].includes(order.status);

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <h1 className="page-title">
          Заказ {order.number}{' '}
          <span className="badge" style={{ background: ORDER_STATUS_COLOR[order.status], verticalAlign: 'middle' }}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        </h1>
        <Link to="/orders" className="btn">
          ← К списку
        </Link>
      </div>
      <p className="page-sub">
        Клиент: <b>{order.customerName}</b> · Создан {formatDateTime(order.createdAt)} · Обновлён{' '}
        {formatDateTime(order.updatedAt)}
        {order.issuedAt ? ` · Выдан ${formatDateTime(order.issuedAt)}` : ''}
      </p>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="toolbar">
        {next && (
          <button
            className="btn primary"
            disabled={busy}
            onClick={() =>
              run((oid) => {
                switch (next.action) {
                  case 'accept':
                    return api.acceptOrder(oid);
                  case 'store':
                    return api.storeOrder(oid);
                  case 'ready':
                    return api.readyOrder(oid);
                  case 'issue':
                    return api.issueOrder(oid);
                }
              })
            }
          >
            {busy ? 'Выполняется…' : next.label}
          </button>
        )}
        {canCancel && (
          <button className="btn danger" disabled={busy} onClick={() => run(api.cancelOrder)}>
            Отменить заказ
          </button>
        )}
      </div>

      {/* Панель «Где найти заказ»: стеллаж, полка, ячейка + мини-схема. */}
      <OrderLocation items={order.items ?? []} />

      {/* Переход на схемы с подсветкой ячеек этого заказа. */}
      {locatedItems.length > 0 && (
        <div className="toolbar">
          <Link to={`/warehouse/2d?order=${order.id}`} className="btn primary">
            Показать на схеме 2D
          </Link>
          <Link to={`/warehouse/3d?order=${order.id}`} className="btn">
            Показать в 3D модели
          </Link>
        </div>
      )}

      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Товар</th>
              <th>SKU</th>
              <th>Кол-во</th>
              <th>Ячейка</th>
              <th>Статус позиции</th>
            </tr>
          </thead>
          <tbody>
            {(order.items ?? []).map((it) => (
              <tr key={it.id}>
                <td>{it.productName}</td>
                <td className="muted">{it.sku}</td>
                <td>{it.qty}</td>
                <td>
                  {it.locationCode ? (
                    <Link to={`/warehouse/2d?cell=${it.locationId}`}>
                      <b>{it.locationCode}</b>
                    </Link>
                  ) : (
                    <span className="muted">не размещён</span>
                  )}
                </td>
                <td>
                  {it.status === 'stored' ? (
                    <span className="badge" style={{ background: '#fbbf24' }}>
                      В ячейке
                    </span>
                  ) : it.status === 'issued' ? (
                    <span className="badge" style={{ background: '#22c55e' }}>
                      Выдан
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#94a3b8' }}>
                      Ожидает
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Информация</h3>
        <p className="muted" style={{ margin: 0 }}>
          Сумма заказа: <b style={{ color: 'var(--text)' }}>{formatMoney(order.total)}</b>
          {order.comment ? (
            <>
              <br />
              Комментарий: {order.comment}
            </>
          ) : null}
          <br />
          Позиции со статусом «В ячейке» можно увидеть на схемах склада — кнопки выше.
        </p>
      </div>
    </div>
  );
}
