/**
 * Тонкий клиент REST API. Все обращения к бэкенду идут через него —
 * при появлении интеграций достаточно поменять базовый адрес или
 * добавить здесь прослойку.
 */
import type { CellView, Customer, Dashboard, EventRow, Layout, Order, Product } from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Content-Type отправляем только когда есть тело: Fastify отклоняет
  // POST с заголовком application/json и пустым телом (400).
  const headers: Record<string, string> = {};
  if (init?.body != null) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  layout: () => request<Layout>('/layout'),
  cells: () => request<CellView[]>('/cells'),
  cell: (id: number) => request<CellView>(`/cells/${id}`),

  products: () => request<Product[]>('/products'),
  createProduct: (data: Partial<Product>) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),

  customers: () => request<Customer[]>('/customers'),
  createCustomer: (data: { name: string; phone?: string; email?: string }) =>
    request<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),

  orders: (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return request<Order[]>(`/orders${q ? '?' + q : ''}`);
  },
  order: (id: number) => request<Order>(`/orders/${id}`),

  acceptOrder: (id: number) => request<Order>(`/orders/${id}/accept`, { method: 'POST' }),
  storeOrder: (id: number) => request<unknown>(`/orders/${id}/store`, { method: 'POST' }),
  readyOrder: (id: number) => request<Order>(`/orders/${id}/ready`, { method: 'POST' }),
  issueOrder: (id: number) => request<Order>(`/orders/${id}/issue`, { method: 'POST' }),
  cancelOrder: (id: number) => request<Order>(`/orders/${id}/cancel`, { method: 'POST' }),

  dashboard: () => request<Dashboard>('/dashboard'),
  events: (limit = 200) => request<EventRow[]>(`/events?limit=${limit}`),
  search: (q: string) =>
    request<Array<{ type: 'product' | 'order'; product?: Product; order?: Order; locations: CellView[] }>>(
      `/search?q=${encodeURIComponent(q)}`,
    ),
};
