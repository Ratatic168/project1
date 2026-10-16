/**
 * Типы данных для фронтенда. Дублируют серверную доменную модель
 * (server/domain.ts) — при переходе на общий пакет типов достаточно
 * заменить этот файл реэкспортом.
 */

export type LocationStatus = 'free' | 'occupied' | 'reserved' | 'blocked';

export type OrderStatus =
  | 'created'
  | 'in_transit'
  | 'accepted'
  | 'stored'
  | 'ready'
  | 'issued'
  | 'cancelled'
  | 'returned';

export interface Product {
  id: number;
  sku: string;
  name: string;
  barcode: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  weight: number;
  price: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Order {
  id: number;
  number: string;
  customerId: number;
  customerName: string;
  status: OrderStatus;
  total: number;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  comment: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  sku: string;
  qty: number;
  locationId: number | null;
  locationCode: string | null;
  status: 'awaiting' | 'stored' | 'issued';
}

export interface CellView {
  id: number;
  code: string;
  rackId: number;
  rackCode: string;
  level: number;
  position: number;
  capacity: number;
  used: number;
  fill: number;
  status: LocationStatus;
  contents: {
    productId: number;
    productName: string;
    sku: string;
    qty: number;
    orderNumber: string | null;
  }[];
}

export interface LayoutRack {
  id: number;
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  levels: number;
  cellsPerLevel: number;
  levelHeight: number;
  capacity: number;
  used: number;
}

export interface Layout {
  room: { width: number; depth: number };
  racks: LayoutRack[];
  cells: CellView[];
}

export interface EventRow {
  id: number;
  ts: string;
  type: string;
  entity: string;
  entityId: number | null;
  message: string;
  payload: string | null;
}

export interface Dashboard {
  orders: { total: number; active: number; ready: number; issuedToday: number };
  byStatus: Array<{ status: OrderStatus; c: number }>;
  products: number;
  customers: number;
  locations: { total: number; occupied: number; free: number };
  unitsStored: number;
}
