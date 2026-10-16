/** Тексты и цвета статусов — единая точка для всего интерфейса. */
import type { OrderStatus } from './types';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Создан',
  in_transit: 'В пути',
  accepted: 'Принят',
  stored: 'Размещён',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменён',
  returned: 'Возврат',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  created: '#94a3b8',
  in_transit: '#38bdf8',
  accepted: '#a78bfa',
  stored: '#fbbf24',
  ready: '#34d399',
  issued: '#22c55e',
  cancelled: '#ef4444',
  returned: '#f97316',
};

/** Цвет ячейки по степени заполнения (для 2D и 3D). */
export function fillColor(fill: number, status: string): string {
  if (status === 'blocked') return '#64748b';
  if (status === 'reserved') return '#a78bfa';
  if (fill <= 0) return '#e2e8f0';
  if (fill < 0.34) return '#bbf7d0';
  if (fill < 0.67) return '#fde68a';
  if (fill < 0.9) return '#fdba74';
  return '#fca5a5';
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
