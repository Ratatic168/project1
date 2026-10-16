import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { CellView, Layout, OrderItem } from '../types';

const SCALE = 44; // px на метр для мини-карты

/**
 * Панель «Где найти заказ»: показывает стеллаж, полку и ячейку каждой позиции
 * и мини-схему склада с подсветкой нужных ячеек. Нужна кладовщику в момент
 * выдачи, чтобы не искать товар вслепую.
 */
export default function OrderLocation({ items }: { items: OrderItem[] }) {
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    api
      .layout()
      .then(setLayout)
      .catch(() => setLayout(null));
  }, []);

  // Позиции, которые уже физически размещены в ячейках.
  const located = useMemo(() => items.filter((i) => i.locationId != null), [items]);
  const idSet = useMemo(() => new Set(located.map((i) => i.locationId!)), [located]);

  // Ячейки, соответствующие позициям заказа.
  const cells = useMemo(
    () => (layout ? layout.cells.filter((c) => idSet.has(c.id)) : []),
    [layout, idSet],
  );

  if (located.length === 0) {
    return (
      <div className="card loc-panel loc-panel--empty">
        <h3 style={{ marginTop: 0 }}>Где найти заказ</h3>
        <p className="muted" style={{ margin: 0 }}>
          Заказ ещё не размещён в ячейках. Выполните действие «Разместить в ячейки» — после этого здесь появятся
          стеллаж, полка и место каждой позиции.
        </p>
      </div>
    );
  }

  return (
    <div className="card loc-panel">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Где найти заказ</h3>
        <span className="muted" style={{ fontSize: 12 }}>
          {cells.length} {cells.length === 1 ? 'ячейка' : 'ячейки'} с товаром
        </span>
      </div>

      <div className="loc-grid">
        <div>
          {located.map((it) => {
            const cell = cells.find((c) => c.id === it.locationId);
            return (
              <div key={it.id} className="loc-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{it.productName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {it.sku} · {it.qty} шт.
                  </div>
                </div>
                {cell ? (
                  <div className="loc-addr">
                    <span className="loc-addr-part">
                      Стеллаж <b>{cell.rackCode}</b>
                    </span>
                    <span className="loc-addr-part">
                      полка <b>{cell.level}</b>
                    </span>
                    <Link to={`/warehouse/2d?cell=${cell.id}`} className="loc-cell" title="Показать на схеме 2D">
                      {cell.code}
                    </Link>
                  </div>
                ) : (
                  <span className="muted">ячейка не найдена</span>
                )}
              </div>
            );
          })}
        </div>

        {layout && (
          <div className="loc-map">
            <MiniMap layout={layout} highlight={idSet} />
            <div className="muted" style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
              Мини-схема склада, подсвечены ячейки заказа
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Упрощённая схема склада: контуры стеллажей и подсветка нужных ячеек. */
function MiniMap({ layout, highlight }: { layout: Layout; highlight: Set<number> }) {
  const { room } = layout;
  const w = room.width * SCALE;
  const h = room.depth * SCALE;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <rect x={0} y={0} width={w} height={h} fill="#0b1120" stroke="#334155" strokeWidth={1.5} />
      <text x={w / 2} y={h - 4} textAnchor="middle" fill="#64748b" fontSize={9}>
        вход
      </text>

      {layout.racks.map((rack) => {
        const rx = rack.x * SCALE;
        const ry = (room.depth - rack.y - rack.depth) * SCALE;
        const rw = rack.width * SCALE;
        const rd = rack.depth * SCALE;
        const cellDepth = rd / rack.cellsPerLevel;

        // Ячейки этого стеллажа, входящие в заказ.
        const rackCells = layout.cells.filter((c) => c.rackId === rack.id && highlight.has(c.id));

        return (
          <g key={rack.id}>
            <rect x={rx} y={ry} width={rw} height={rd} fill="#1e293b" stroke="#475569" strokeWidth={1} />
            <text x={rx + rw / 2} y={ry - 3} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={600}>
              {rack.code}
            </text>
            {rackCells.map((cell: CellView) => {
              const cy = ry + (cell.position - 1) * cellDepth;
              return (
                <rect
                  key={cell.id}
                  x={rx}
                  y={cy}
                  width={rw}
                  height={cellDepth}
                  fill="#f97316"
                  stroke="#fff"
                  strokeWidth={1.2}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
