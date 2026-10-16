import { useEffect, useState } from 'react';
import { api } from '../api';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../format';
import type { Dashboard as DashboardData } from '../types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [layout, setLayout] = useState<{ racks: number; occupiedCells: number; totalCells: number } | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(() => setData(null));
    api
      .layout()
      .then((l) =>
        setLayout({
          racks: l.racks.length,
          totalCells: l.cells.length,
          occupiedCells: l.cells.filter((c) => c.used > 0).length,
        }),
      )
      .catch(() => setLayout(null));
  }, []);

  if (!data) return <div className="empty">Загрузка…</div>;

  const totalStatuses = data.byStatus.reduce((s, x) => s + x.c, 0);
  const maxStatus = Math.max(1, ...data.byStatus.map((x) => x.c));

  return (
    <div>
      <h1 className="page-title">Пункт выдачи — оперативная сводка</h1>
      <p className="page-sub">Состояние склада, заказов и размещений на текущий момент</p>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="label">Активных заказов</div>
          <div className="value">{data.orders.active}</div>
        </div>
        <div className="stat">
          <div className="label">Готовы к выдаче</div>
          <div className="value" style={{ color: 'var(--ok)' }}>{data.orders.ready}</div>
        </div>
        <div className="stat">
          <div className="label">Единиц на складе</div>
          <div className="value">{data.unitsStored}</div>
        </div>
        <div className="stat">
          <div className="label">Заполненность склада</div>
          <div className="value">
            {layout && layout.totalCells > 0
              ? Math.round((layout.occupiedCells / layout.totalCells) * 100)
              : '—'}
            %
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="label">Всего заказов</div>
          <div className="value">{data.orders.total}</div>
        </div>
        <div className="stat">
          <div className="label">Выдано сегодня</div>
          <div className="value">{data.orders.issuedToday}</div>
        </div>
        <div className="stat">
          <div className="label">Товары в каталоге</div>
          <div className="value">{data.products}</div>
        </div>
        <div className="stat">
          <div className="label">Клиенты</div>
          <div className="value">{data.customers}</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Заказы по статусам</h3>
          {data.byStatus.map((s) => (
            <div key={s.status} style={{ marginBottom: 10 }}>
              <div className="row-between">
                <span>
                  <span className="badge" style={{ background: ORDER_STATUS_COLOR[s.status] }}>
                    {ORDER_STATUS_LABEL[s.status]}
                  </span>
                </span>
                <span>
                  <b>{s.c}</b> ({Math.round((s.c / Math.max(1, totalStatuses)) * 100)}%)
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--panel-2)', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(s.c / maxStatus) * 100}%`,
                    background: ORDER_STATUS_COLOR[s.status],
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Склад</h3>
          {layout ? (
            <div>
              <p>
                Стеллажей: <b>{layout.racks}</b> · Ячеек: <b>{layout.totalCells}</b> · Занято:{' '}
                <b>{layout.occupiedCells}</b>
              </p>
              <div style={{ height: 12, background: 'var(--panel-2)', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${layout.totalCells > 0 ? (layout.occupiedCells / layout.totalCells) * 100 : 0}%`,
                    background: 'linear-gradient(90deg, var(--ok), var(--warn))',
                  }}
                />
              </div>
              <p className="muted" style={{ marginTop: 16 }}>
                Схемы размещения товаров доступны на страницах <a href="/warehouse/2d">«Склад 2D»</a> и{' '}
                <a href="/warehouse/3d">«Склад 3D»</a>.
              </p>
            </div>
          ) : (
            <p className="muted">Загрузка…</p>
          )}
        </div>
      </div>
    </div>
  );
}
