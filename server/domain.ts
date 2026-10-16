/**
 * Доменная модель системы управления складом пункта выдачи (WMS/CRM).
 *
 * Термины:
 *  rack      — стеллаж (физическая секция в помещении)
 *  level     — полка (уровень стеллажа, 1 = нижняя)
 *  cell      — ячейка хранения (место, куда кладётся товар)
 *  location  — адрес ячейки, код вида "A-01-03"
 */

export type LocationStatus = 'free' | 'occupied' | 'reserved' | 'blocked';

/** Жизненный цикл заказа — по аналогии с Ozon: создан → в пути → принят → размещён → готов → выдан. */
export type OrderStatus =
  | 'created'    // создан
  | 'in_transit' // в пути на ПВЗ
  | 'accepted'   // принят на складе
  | 'stored'     // размещён в ячейке
  | 'ready'      // готов к выдаче
  | 'issued'     // выдан получателю
  | 'cancelled'  // отменён
  | 'returned';  // возврат

export type ItemStatus = 'awaiting' | 'stored' | 'issued';

export interface Rack {
  id: number;
  code: string;
  name: string;
  /** Позиция левого-нижнего угла стеллажа на плане, в метрах. */
  x: number;
  y: number;
  /** Габариты в плане, метры. */
  width: number;
  depth: number;
  levels: number;
  cellsPerLevel: number;
  /** Высота одного уровня, метры (для 3D). */
  levelHeight: number;
}

export interface Location {
  id: number;
  code: string;
  rackId: number;
  rackCode: string;
  level: number;
  position: number;
  capacity: number;
  status: LocationStatus;
}

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
  status: ItemStatus;
}

export interface StockRow {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  locationId: number;
  locationCode: string;
  qty: number;
  orderId: number | null;
  orderNumber: string | null;
  placedAt: string;
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

/** Ячейка с вычисленной занятостью — основа для 2D и 3D визуализации. */
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
  /** Габариты помещения, метры. */
  room: { width: number; depth: number };
  racks: LayoutRack[];
  cells: CellView[];
}
