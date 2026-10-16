import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { fillColor } from '../format';
import type { CellView, Layout } from '../types';

const SCALE = 70; // px на метр

export default function Warehouse2D() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [level, setLevel] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  const [highlightLabel, setHighlightLabel] = useState('');

  useEffect(() => {
    api
      .layout()
      .then(setLayout)
      .catch(() => setLayout(null));
  }, []);

  // Подсветка ячеек заказа по параметру ?order=ID.
  useEffect(() => {
    const orderId = searchParams.get('order');
    if (!orderId || !layout) return;
    api
      .order(Number(orderId))
      .then((order) => {
        const ids = new Set<number>();
        for (const it of order.items ?? []) if (it.locationId != null) ids.add(it.locationId);
        setHighlightIds(ids);
        setHighlightLabel(`Заказ ${order.number}`);
        const first = layout.cells.find((c) => ids.has(c.id));
        if (first) {
          setLevel(first.level);
          setSelectedId(first.id);
        }
      })
      .catch(() => setHighlightIds(new Set()));
  }, [searchParams, layout]);

  // Выбор одной ячейки по параметру ?cell=ID.
  useEffect(() => {
    const cell = searchParams.get('cell');
    if (!cell) return;
    setSelectedId(Number(cell));
    const c = layout?.cells.find((x) => x.id === Number(cell));
    if (c) setLevel(c.level);
  }, [searchParams, layout]);

  const maxLevel = useMemo(
    () => (layout ? Math.max(...layout.racks.map((r) => r.levels)) : 0),
    [layout],
  );

  const selected: CellView | null = useMemo(
    () => layout?.cells.find((c) => c.id === selectedId) ?? null,
    [layout, selectedId],
  );

  const runSearch = async () => {
    if (!search.trim()) {
      setHighlightIds(new Set());
      setHighlightLabel('');
      return;
    }
    try {
      const res = await api.search(search.trim());
      const ids = new Set<number>();
      for (const r of res) for (const loc of r.locations) ids.add(loc.id);
      setHighlightIds(ids);
      setHighlightLabel(`Поиск «${search.trim()}»`);
      const first = layout?.cells.find((c) => ids.has(c.id));
      if (first) {
        setLevel(first.level);
        setSelectedId(first.id);
      }
    } catch {
      setHighlightIds(new Set());
    }
  };

  if (!layout) return <div className="empty">Загрузка схемы…</div>;

  const { room } = layout;
  const pxW = room.width * SCALE;
  const pxD = room.depth * SCALE;

  // Ячейки текущего уровня, сгруппированные по стеллажу.
  const cellsByRack = new Map<number, CellView[]>();
  for (const cell of layout.cells) {
    if (cell.level !== level) continue;
    if (!cellsByRack.has(cell.rackId)) cellsByRack.set(cell.rackId, []);
    cellsByRack.get(cell.rackId)!.push(cell);
  }

  return (
    <div>
      <h1 className="page-title">Склад — схема 2D</h1>
      <p className="page-sub">
        Вид сверху. Выберите уровень полки, чтобы увидеть, что лежит в каждой ячейке.
      </p>

      <div className="toolbar">
        <span className="muted">Уровень:</span>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lv) => (
            <button key={lv} className={level === lv ? 'active' : ''} onClick={() => setLevel(lv)}>
              Полка {lv}
            </button>
          ))}
        </div>
        <input
          className="input"
          style={{ maxWidth: 240, marginLeft: 'auto' }}
          placeholder="Поиск: штрихкод, SKU, номер заказа…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button className="btn" onClick={runSearch}>
          Найти
        </button>
      </div>

      {highlightLabel && (
        <div className="card" style={{ marginBottom: 8, padding: '8px 14px', borderColor: 'var(--accent)' }}>
          <span className="muted">Подсветка:</span> <b>{highlightLabel}</b>
          <span className="muted"> · {highlightIds.size} ячеек</span>
        </div>
      )}

      <div className="warehouse-layout">
        <div className="map-wrap">
          <div className="map-legend">
            <span>
              <span className="swatch" style={{ background: '#e2e8f0' }} />
              Свободно
            </span>
            <span>
              <span className="swatch" style={{ background: '#bbf7d0' }} />
              Менее 1/3
            </span>
            <span>
              <span className="swatch" style={{ background: '#fde68a' }} />1/3 – 2/3
            </span>
            <span>
              <span className="swatch" style={{ background: '#fdba74' }} />
              2/3 – 90%
            </span>
            <span>
              <span className="swatch" style={{ background: '#fca5a5' }} />
              Заполнено
            </span>
            <span style={{ marginLeft: 8 }}>
              <span className="swatch" style={{ background: '#f97316' }} />
              Заказ / поиск
            </span>
          </div>

          <svg width={pxW} height={pxD} viewBox={`0 0 ${pxW} ${pxD}`} style={{ display: 'block' }}>
            <rect x={0} y={0} width={pxW} height={pxD} fill="#0b1120" stroke="#334155" strokeWidth={2} />

            {/* Вход (нижняя стена) */}
            <path
              d={`M ${pxW / 2 - 20} ${pxD} L ${pxW / 2 + 20} ${pxD} L ${pxW / 2} ${pxD - 24} Z`}
              fill="#334155"
            />
            <text x={pxW / 2} y={pxD - 8} textAnchor="middle" className="rack-label">
              Вход
            </text>

            {layout.racks.map((rack) => {
              const rx = rack.x * SCALE;
              const ry = (room.depth - rack.y - rack.depth) * SCALE;
              const rw = rack.width * SCALE;
              const rd = rack.depth * SCALE;
              const cells = cellsByRack.get(rack.id) ?? [];
              const cellDepth = rd / rack.cellsPerLevel;

              return (
                <g key={rack.id}>
                  <rect x={rx} y={ry} width={rw} height={rd} fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
                  <text x={rx + rw / 2} y={ry - 6} textAnchor="middle" className="rack-label">
                    {rack.code}
                  </text>

                  {cells.map((cell) => {
                    const cy = ry + (cell.position - 1) * cellDepth;
                    const highlighted = highlightIds.has(cell.id);
                    const color = highlighted
                      ? '#f97316'
                      : selectedId === cell.id
                        ? '#8b5cf6'
                        : fillColor(cell.fill, cell.status);
                    return (
                      <rect
                        key={cell.id}
                        className="cell-hover"
                        x={rx + 1}
                        y={cy + 1}
                        width={rw - 2}
                        height={cellDepth - 2}
                        fill={color}
                        stroke={selectedId === cell.id || highlighted ? '#fff' : 'rgba(255,255,255,0.12)'}
                        strokeWidth={selectedId === cell.id || highlighted ? 2 : 1}
                        onClick={() => setSelectedId(cell.id)}
                      >
                        <title>
                          {cell.code} · занято {cell.used}/{cell.capacity}
                        </title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="side-panel">
          {selected ? (
            <div>
              <h3 style={{ marginTop: 0 }}>
                Ячейка <span style={{ color: 'var(--accent)' }}>{selected.code}</span>
              </h3>
              <p className="muted">
                Стеллаж {selected.rackCode} · Полка {selected.level} · Позиция {selected.position}
              </p>
              <p>
                Заполнение:{' '}
                <b>
                  {selected.used}/{selected.capacity}
                </b>{' '}
                ({Math.round(selected.fill * 100)}%)
              </p>
              <div style={{ height: 10, background: 'var(--panel-2)', borderRadius: 5, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${selected.fill * 100}%`,
                    background: fillColor(selected.fill, selected.status),
                  }}
                />
              </div>

              <h4 style={{ marginBottom: 8 }}>Содержимое</h4>
              {selected.contents.length === 0 ? (
                <p className="muted">Ячейка пуста</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.contents.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <div>{c.productName}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {c.sku}
                            {c.orderNumber ? ` · ${c.orderNumber}` : ''}
                          </div>
                        </td>
                        <td>
                          <b>{c.qty}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0 }}>Ячейка не выбрана</h3>
              <p className="muted">
                Нажмите на ячейку на схеме, чтобы увидеть её содержимое. Оранжевым подсвечены ячейки заказа или
                результата поиска.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
