/**
 * Сервисный слой: вся бизнес-логика и SQL-запросы сосредоточены здесь.
 * HTTP-обработчики (server.ts) только принимают запросы и возвращают результат
 * этих функций — так логику легко переиспользовать и покрыть тестами.
 */
import { db, logEvent, nowIso, tx } from './db.ts';
import type {
  CellView,
  Customer,
  EventRow,
  Layout,
  LayoutRack,
  Order,
  OrderItem,
  Product,
} from './domain.ts';

// --------------------------------------------------------------------------
// Склад: планировка и визуализация
// --------------------------------------------------------------------------

export function getLayout(): Layout {
  const room = { width: 10, depth: 8 };

  const rackRows = db
    .prepare(
      `SELECT r.*, COUNT(l.id) AS cell_count,
              COALESCE(SUM((SELECT COUNT(*) FROM stock s WHERE s.location_id = l.id)), 0) AS used_units
       FROM racks r
       LEFT JOIN locations l ON l.rack_id = r.id
       GROUP BY r.id
       ORDER BY r.code`,
    )
    .all() as Array<Record<string, unknown>>;

  const racks: LayoutRack[] = rackRows.map((r) => {
    const levels = Number(r.levels);
    const cellsPerLevel = Number(r.cells_per_level);
    const capPerCell = levels <= 2 ? 12 : 8;
    return {
      id: Number(r.id),
      code: String(r.code),
      name: String(r.name),
      x: Number(r.x),
      y: Number(r.y),
      width: Number(r.width),
      depth: Number(r.depth),
      levels,
      cellsPerLevel,
      levelHeight: Number(r.level_height),
      capacity: levels * cellsPerLevel * capPerCell,
      used: Number(r.used_units),
    };
  });

  return { room, racks, cells: getAllCells() };
}

/** Все ячейки с вычисленной занятостью и списком содержимого. */
export function getAllCells(): CellView[] {
  const rows = db
    .prepare(
      `SELECT l.*, r.code AS rack_code FROM locations l
       JOIN racks r ON r.id = l.rack_id
       ORDER BY r.code, l.level, l.position`,
    )
    .all() as Array<Record<string, unknown>>;

  const contentsByLoc = new Map<number, CellView['contents']>();
  const stockRows = db
    .prepare(
      `SELECT s.location_id, s.product_id, s.qty, s.order_id,
              p.name AS product_name, p.sku, o.number AS order_number
       FROM stock s
       JOIN products p ON p.id = s.product_id
       LEFT JOIN orders o ON o.id = s.order_id`,
    )
    .all() as Array<Record<string, unknown>>;

  for (const s of stockRows) {
    const locId = Number(s.location_id);
    if (!contentsByLoc.has(locId)) contentsByLoc.set(locId, []);
    contentsByLoc.get(locId)!.push({
      productId: Number(s.product_id),
      productName: String(s.product_name),
      sku: String(s.sku),
      qty: Number(s.qty),
      orderNumber: s.order_number ? String(s.order_number) : null,
    });
  }

  return rows.map((r) => {
    const locId = Number(r.id);
    const contents = contentsByLoc.get(locId) ?? [];
    const used = contents.reduce((sum, c) => sum + c.qty, 0);
    const capacity = Number(r.capacity);
    return {
      id: locId,
      code: String(r.code),
      rackId: Number(r.rack_id),
      rackCode: String(r.rack_code),
      level: Number(r.level),
      position: Number(r.position),
      capacity,
      used,
      fill: capacity > 0 ? used / capacity : 0,
      status: (r.status as CellView['status']) ?? 'free',
      contents,
    };
  });
}

export function getLocation(id: number): CellView | undefined {
  return getAllCells().find((c) => c.id === id);
}

// --------------------------------------------------------------------------
// Товары
// --------------------------------------------------------------------------

export function listProducts(): Product[] {
  return db.prepare('SELECT * FROM products ORDER BY sku').all() as Product[];
}

export function getProduct(id: number): Product | undefined {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
}

export function createProduct(input: Omit<Product, 'id'>): Product {
  const info = db
    .prepare(
      `INSERT INTO products (sku, name, barcode, category, width, height, depth, weight, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sku,
      input.name,
      input.barcode ?? null,
      input.category ?? null,
      input.width,
      input.height,
      input.depth,
      input.weight,
      input.price,
    );
  logEvent('product.created', 'product', Number(info.lastInsertRowid), `Товар создан: ${input.name}`);
  return getProduct(Number(info.lastInsertRowid))!;
}

// --------------------------------------------------------------------------
// Клиенты
// --------------------------------------------------------------------------

export function listCustomers(): Customer[] {
  return db.prepare('SELECT * FROM customers ORDER BY name').all() as Customer[];
}

export function getCustomer(id: number): Customer | undefined {
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined;
}

export function createCustomer(input: { name: string; phone?: string; email?: string }): Customer {
  const info = db
    .prepare(`INSERT INTO customers (name, phone, email, created_at) VALUES (?, ?, ?, ?)`)
    .run(input.name, input.phone ?? null, input.email ?? null, nowIso());
  logEvent('customer.created', 'customer', Number(info.lastInsertRowid), `Клиент создан: ${input.name}`);
  return getCustomer(Number(info.lastInsertRowid))!;
}

// --------------------------------------------------------------------------
// Заказы
// --------------------------------------------------------------------------

const ORDER_SELECT = `
  SELECT o.*, c.name AS customer_name,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
`;

export function listOrders(filter?: { status?: string; search?: string }): Order[] {
  let sql = ORDER_SELECT;
  const cond: string[] = [];
  const params: unknown[] = [];
  if (filter?.status) {
    cond.push('o.status = ?');
    params.push(filter.status);
  }
  if (filter?.search) {
    cond.push('(o.number LIKE ? OR c.name LIKE ?)');
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY o.created_at DESC';

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapOrder);
}

export function getOrder(id: number): Order | undefined {
  const row = db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapOrder(row) : undefined;
}

export function getOrderItems(orderId: number): OrderItem[] {
  return db
    .prepare(
      `SELECT oi.*, p.name AS product_name, p.sku, l.code AS location_code
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN locations l ON l.id = oi.location_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
    )
    .all(orderId)
    .map((r) => mapOrderItem(r as Record<string, unknown>));
}

function mapOrder(r: Record<string, unknown>): Order {
  return {
    id: Number(r.id),
    number: String(r.number),
    customerId: Number(r.customer_id),
    customerName: String(r.customer_name),
    status: String(r.status) as Order['status'],
    total: Number(r.total),
    itemsCount: Number(r.items_count),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    issuedAt: r.issued_at ? String(r.issued_at) : null,
    comment: r.comment ? String(r.comment) : '',
  };
}

function mapOrderItem(r: Record<string, unknown>): OrderItem {
  return {
    id: Number(r.id),
    orderId: Number(r.order_id),
    productId: Number(r.product_id),
    productName: String(r.product_name),
    sku: String(r.sku),
    qty: Number(r.qty),
    locationId: r.location_id ? Number(r.location_id) : null,
    locationCode: r.location_code ? String(r.location_code) : null,
    status: String(r.status) as OrderItem['status'],
  };
}

// --------------------------------------------------------------------------
// Бизнес-операции: приёмка, размещение, выдача
// --------------------------------------------------------------------------

/** Приёмка заказа на склад: `in_transit` → `accepted`. */
export function acceptOrder(orderId: number): Order {
  const order = getOrder(orderId);
  if (!order) throw new Error('Заказ не найден');
  tx(() => {
    db.prepare(`UPDATE orders SET status = 'accepted', updated_at = ? WHERE id = ?`).run(nowIso(), orderId);
    logEvent('order.accepted', 'order', orderId, `Заказ ${order.number} принят на склад`);
  });
  return getOrder(orderId)!;
}

/** Размещение заказа: раскладывает позиции по ячейкам. `accepted` → `stored`. */
export function storeOrder(orderId: number): {
  order: Order;
  placements: Array<{ itemId: number; sku: string; qty: number; location: string }>;
} {
  const order = getOrder(orderId);
  if (!order) throw new Error('Заказ не найден');

  const items = getOrderItems(orderId);
  const placements: Array<{ itemId: number; sku: string; qty: number; location: string }> = [];

  tx(() => {
    for (const item of items) {
      if (item.status === 'stored') continue;
      const loc = findLocationForItem(item);
      if (!loc) throw new Error(`Нет свободной ячейки для ${item.sku}`);

      db.prepare(`UPDATE order_items SET location_id = ?, status = 'stored' WHERE id = ?`).run(loc.id, item.id);
      db.prepare(`INSERT INTO stock (product_id, location_id, qty, order_id, placed_at) VALUES (?, ?, ?, ?, ?)`).run(
        item.productId,
        loc.id,
        item.qty,
        orderId,
        nowIso(),
      );
      db.prepare(`UPDATE locations SET status = 'occupied' WHERE id = ?`).run(loc.id);
      placements.push({ itemId: item.id, sku: item.sku, qty: item.qty, location: loc.code });
    }
    db.prepare(`UPDATE orders SET status = 'stored', updated_at = ? WHERE id = ?`).run(nowIso(), orderId);
    logEvent('order.stored', 'order', orderId, `Заказ ${order.number} размещён (${placements.length} поз.)`);
  });

  return { order: getOrder(orderId)!, placements };
}

/** Найти подходящую ячейку: с запасом по ёмкости, не заблокированную. */
function findLocationForItem(item: OrderItem): { id: number; code: string } | undefined {
  const rows = db
    .prepare(
      `SELECT l.id, l.code, l.capacity,
              COALESCE((SELECT SUM(qty) FROM stock s WHERE s.location_id = l.id), 0) AS used
       FROM locations l
       WHERE l.status != 'blocked'
       ORDER BY l.rack_id, l.level, l.position`,
    )
    .all() as Array<Record<string, unknown>>;

  for (const r of rows) {
    const free = Number(r.capacity) - Number(r.used);
    if (free >= item.qty) return { id: Number(r.id), code: String(r.code) };
  }
  return undefined;
}

/** Пометить заказ готовым к выдаче: `stored` → `ready`. */
export function markReady(orderId: number): Order {
  const order = getOrder(orderId);
  if (!order) throw new Error('Заказ не найден');
  tx(() => {
    db.prepare(`UPDATE orders SET status = 'ready', updated_at = ? WHERE id = ?`).run(nowIso(), orderId);
    logEvent('order.ready', 'order', orderId, `Заказ ${order.number} готов к выдаче`);
  });
  return getOrder(orderId)!;
}

/** Выдача заказа получателю: `ready` → `issued`, освобождает ячейки. */
export function issueOrder(orderId: number): Order {
  const order = getOrder(orderId);
  if (!order) throw new Error('Заказ не найден');

  tx(() => {
    const items = getOrderItems(orderId);
    for (const item of items) {
      if (item.locationId) {
        db.prepare(`DELETE FROM stock WHERE order_id = ? AND product_id = ? AND location_id = ?`).run(
          orderId,
          item.productId,
          item.locationId,
        );
        db.prepare(`UPDATE order_items SET status = 'issued' WHERE id = ?`).run(item.id);
        const remaining = db
          .prepare(`SELECT COUNT(*) AS c FROM stock WHERE location_id = ?`)
          .get(item.locationId) as { c: number };
        if (remaining.c === 0) {
          db.prepare(`UPDATE locations SET status = 'free' WHERE id = ?`).run(item.locationId);
        }
      }
    }
    db.prepare(`UPDATE orders SET status = 'issued', issued_at = ?, updated_at = ? WHERE id = ?`).run(
      nowIso(),
      nowIso(),
      orderId,
    );
    logEvent('order.issued', 'order', orderId, `Заказ ${order.number} выдан получателю`);
  });

  return getOrder(orderId)!;
}

/** Отмена заказа: освобождает ячейки, если заказ был размещён. */
export function cancelOrder(orderId: number): Order {
  const order = getOrder(orderId);
  if (!order) throw new Error('Заказ не найден');
  tx(() => {
    const items = getOrderItems(orderId);
    for (const item of items) {
      if (item.locationId) {
        db.prepare(`DELETE FROM stock WHERE order_id = ? AND location_id = ?`).run(orderId, item.locationId);
        const remaining = db
          .prepare(`SELECT COUNT(*) AS c FROM stock WHERE location_id = ?`)
          .get(item.locationId) as { c: number };
        if (remaining.c === 0) db.prepare(`UPDATE locations SET status = 'free' WHERE id = ?`).run(item.locationId);
      }
    }
    db.prepare(`UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), orderId);
    logEvent('order.cancelled', 'order', orderId, `Заказ ${order.number} отменён`);
  });
  return getOrder(orderId)!;
}

// --------------------------------------------------------------------------
// Статистика и журнал
// --------------------------------------------------------------------------

export function getDashboard() {
  const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { c: number }).c;

  return {
    orders: {
      total: count('SELECT COUNT(*) AS c FROM orders'),
      active: count(`SELECT COUNT(*) AS c FROM orders WHERE status IN ('accepted','stored','ready')`),
      ready: count(`SELECT COUNT(*) AS c FROM orders WHERE status = 'ready'`),
      issuedToday: count(`SELECT COUNT(*) AS c FROM orders WHERE status = 'issued' AND date(issued_at) = date('now')`),
    },
    byStatus: db
      .prepare(`SELECT status, COUNT(*) AS c FROM orders GROUP BY status ORDER BY c DESC`)
      .all() as Array<{ status: string; c: number }>,
    products: count('SELECT COUNT(*) AS c FROM products'),
    customers: count('SELECT COUNT(*) AS c FROM customers'),
    locations: {
      total: count('SELECT COUNT(*) AS c FROM locations'),
      occupied: count(`SELECT COUNT(*) AS c FROM locations WHERE status = 'occupied'`),
      free: count(`SELECT COUNT(*) AS c FROM locations WHERE status = 'free'`),
    },
    unitsStored: count('SELECT COALESCE(SUM(qty),0) AS c FROM stock'),
  };
}

export function listEvents(limit = 200): EventRow[] {
  return db.prepare('SELECT * FROM events ORDER BY ts DESC, id DESC LIMIT ?').all(limit) as EventRow[];
}

// --------------------------------------------------------------------------
// Поиск: товар/заказ по штрихкоду, SKU или номеру заказа
// --------------------------------------------------------------------------

export function searchByBarcode(
  code: string,
): Array<{ type: 'product' | 'order'; product?: Product; order?: Order; locations: CellView[] }> {
  const result: Array<{ type: 'product' | 'order'; product?: Product; order?: Order; locations: CellView[] }> = [];
  const cells = getAllCells();

  const products = db.prepare('SELECT * FROM products WHERE barcode = ? OR sku = ?').all(code, code) as Product[];
  for (const p of products) {
    const locs = cells.filter((c) => c.contents.some((x) => x.productId === p.id));
    result.push({ type: 'product', product: p, locations: locs });
  }

  const orderRow = db.prepare(`${ORDER_SELECT} WHERE o.number = ?`).get(code) as
    | Record<string, unknown>
    | undefined;
  if (orderRow) {
    const order = mapOrder(orderRow);
    const itemRows = db
      .prepare(`SELECT location_id FROM order_items WHERE order_id = ? AND location_id IS NOT NULL`)
      .all(order.id) as Array<{ location_id: number }>;
    const locIds = new Set(itemRows.map((r) => Number(r.location_id)));
    result.push({ type: 'order', order, locations: cells.filter((c) => locIds.has(c.id)) });
  }

  return result;
}
