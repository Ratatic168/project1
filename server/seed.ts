/**
 * Генератор демо-склада: создаёт помещение со стеллажами и наполняет его
 * демонстрационными данными (товары, клиенты, заказы, размещения).
 *
 * Используется при первом запуске (пустая БД) и при ручном сбросе (`/api/seed`).
 */
import { db, initSchema, logEvent, nowIso, tx } from './db.ts';
import type { Product, Rack } from './domain.ts';

/** Планировка: помещение 10×8 м, стеллажи вдоль стен и два центральных ряда. */
const RACK_DEFS: Array<Omit<Rack, 'id'>> = [
  // Левый ряд (у стены)
  { code: 'A', name: 'Стеллаж A', x: 0.6, y: 0.8, width: 1.0, depth: 2.6, levels: 4, cellsPerLevel: 6, levelHeight: 0.45 },
  { code: 'B', name: 'Стеллаж B', x: 0.6, y: 4.2, width: 1.0, depth: 2.6, levels: 4, cellsPerLevel: 6, levelHeight: 0.45 },
  // Центральный ряд 1
  { code: 'C', name: 'Стеллаж C', x: 2.4, y: 0.8, width: 1.2, depth: 2.6, levels: 5, cellsPerLevel: 8, levelHeight: 0.4 },
  { code: 'D', name: 'Стеллаж D', x: 2.4, y: 4.2, width: 1.2, depth: 2.6, levels: 5, cellsPerLevel: 8, levelHeight: 0.4 },
  // Центральный ряд 2
  { code: 'E', name: 'Стеллаж E', x: 4.4, y: 0.8, width: 1.2, depth: 2.6, levels: 5, cellsPerLevel: 8, levelHeight: 0.4 },
  { code: 'F', name: 'Стеллаж F', x: 4.4, y: 4.2, width: 1.2, depth: 2.6, levels: 5, cellsPerLevel: 8, levelHeight: 0.4 },
  // Правый ряд (у стены)
  { code: 'G', name: 'Стеллаж G', x: 6.6, y: 0.8, width: 1.0, depth: 2.6, levels: 4, cellsPerLevel: 6, levelHeight: 0.45 },
  { code: 'H', name: 'Стеллаж H', x: 6.6, y: 4.2, width: 1.0, depth: 2.6, levels: 4, cellsPerLevel: 6, levelHeight: 0.45 },
];

const PRODUCTS: Array<Omit<Product, 'id'>> = [
  { sku: 'OZ-1001', name: 'Смартфон Galaxy A55', barcode: '4600000001001', category: 'Электроника', width: 0.16, height: 0.02, depth: 0.08, weight: 0.21, price: 24990 },
  { sku: 'OZ-1002', name: 'Наушники TWS', barcode: '4600000001002', category: 'Электроника', width: 0.1, height: 0.04, depth: 0.1, weight: 0.05, price: 2990 },
  { sku: 'OZ-1003', name: 'Зарядное устройство USB-C', barcode: '4600000001003', category: 'Аксессуары', width: 0.08, height: 0.05, depth: 0.08, weight: 0.12, price: 890 },
  { sku: 'OZ-2001', name: 'Футболка хлопок (M)', barcode: '4600000002001', category: 'Одежда', width: 0.3, height: 0.03, depth: 0.25, weight: 0.18, price: 1290 },
  { sku: 'OZ-2002', name: 'Кроссовки беговые', barcode: '4600000002002', category: 'Обувь', width: 0.32, height: 0.12, depth: 0.2, weight: 0.62, price: 5490 },
  { sku: 'OZ-2003', name: 'Рюкзак городской', barcode: '4600000002003', category: 'Аксессуары', width: 0.35, height: 0.45, depth: 0.15, weight: 0.55, price: 3490 },
  { sku: 'OZ-3001', name: 'Пылесос робот', barcode: '4600000003001', category: 'Бытовая техника', width: 0.35, height: 0.1, depth: 0.35, weight: 3.2, price: 18990 },
  { sku: 'OZ-3002', name: 'Чайник электрический', barcode: '4600000003002', category: 'Бытовая техника', width: 0.22, height: 0.25, depth: 0.18, weight: 1.1, price: 2490 },
  { sku: 'OZ-3003', name: 'Микроволновая печь', barcode: '4600000003003', category: 'Бытовая техника', width: 0.44, height: 0.26, depth: 0.34, weight: 10.5, price: 6990 },
  { sku: 'OZ-4001', name: 'Книга «Основы Python»', barcode: '4600000004001', category: 'Книги', width: 0.15, height: 0.24, depth: 0.03, weight: 0.4, price: 890 },
  { sku: 'OZ-4002', name: 'Настольная игра', barcode: '4600000004002', category: 'Игрушки', width: 0.3, height: 0.05, depth: 0.3, weight: 0.9, price: 1890 },
  { sku: 'OZ-4003', name: 'Конструктор LEGO', barcode: '4600000004003', category: 'Игрушки', width: 0.38, height: 0.1, depth: 0.26, weight: 1.4, price: 3990 },
  { sku: 'OZ-5001', name: 'Крем для лица', barcode: '4600000005001', category: 'Косметика', width: 0.06, height: 0.06, depth: 0.06, weight: 0.08, price: 690 },
  { sku: 'OZ-5002', name: 'Шампунь 500мл', barcode: '4600000005002', category: 'Косметика', width: 0.07, height: 0.22, depth: 0.07, weight: 0.55, price: 420 },
  { sku: 'OZ-6001', name: 'Кофе зерновой 1кг', barcode: '4600000006001', category: 'Продукты', width: 0.18, height: 0.25, depth: 0.12, weight: 1.0, price: 1290 },
];

const CUSTOMERS = [
  { name: 'Иван Петров', phone: '+7 (900) 111-22-33', email: 'ivan.p@example.com' },
  { name: 'Мария Смирнова', phone: '+7 (900) 222-33-44', email: 'maria.s@example.com' },
  { name: 'Алексей Иванов', phone: '+7 (900) 333-44-55', email: 'alex.i@example.com' },
  { name: 'Ольга Кузнецова', phone: '+7 (900) 444-55-66', email: 'olga.k@example.com' },
  { name: 'Дмитрий Соколов', phone: '+7 (900) 555-66-77', email: 'dmitry.s@example.com' },
  { name: 'Елена Попова', phone: '+7 (900) 666-77-88', email: 'elena.p@example.com' },
  { name: 'Сергей Волков', phone: '+7 (900) 777-88-99', email: 'sergey.v@example.com' },
  { name: 'Анна Морозова', phone: '+7 (900) 888-99-00', email: 'anna.m@example.com' },
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export function isSeeded(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS c FROM racks').get() as { c: number };
  return row.c > 0;
}

/** Курсор по ячейкам — позволяет равномерно распределять демо-товары по складу. */
let cellCursor = 0;

export function generateWarehouse(): void {
  cellCursor = 0;
  tx(() => {
    // 1. Стеллажи и ячейки
    for (const rd of RACK_DEFS) {
      const info = db
        .prepare(
          `INSERT INTO racks (code, name, x, y, width, depth, levels, cells_per_level, level_height)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(rd.code, rd.name, rd.x, rd.y, rd.width, rd.depth, rd.levels, rd.cellsPerLevel, rd.levelHeight);
      const rackId = Number(info.lastInsertRowid);

      for (let level = 1; level <= rd.levels; level++) {
        for (let pos = 1; pos <= rd.cellsPerLevel; pos++) {
          const code = `${rd.code}-${pad(level, 2)}-${pad(pos, 2)}`;
          // Ёмкость ячейки зависит от уровня: нижние полки вмещают больше.
          const capacity = level <= 2 ? 12 : 8;
          db.prepare(
            `INSERT INTO locations (code, rack_id, level, position, capacity, status)
             VALUES (?, ?, ?, ?, ?, 'free')`,
          ).run(code, rackId, level, pos, capacity);
        }
      }
    }

    // 2. Товары
    const productIds: number[] = [];
    for (const p of PRODUCTS) {
      const info = db
        .prepare(
          `INSERT INTO products (sku, name, barcode, category, width, height, depth, weight, price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(p.sku, p.name, p.barcode, p.category, p.width, p.height, p.depth, p.weight, p.price);
      productIds.push(Number(info.lastInsertRowid));
    }

    // 3. Клиенты
    const customerIds: number[] = [];
    for (const c of CUSTOMERS) {
      const info = db
        .prepare(`INSERT INTO customers (name, phone, email, created_at) VALUES (?, ?, ?, ?)`)
        .run(c.name, c.phone, c.email, nowIso());
      customerIds.push(Number(info.lastInsertRowid));
    }

    // 4. Заказы и размещения
    const orderCount = 24;
    for (let i = 1; i <= orderCount; i++) {
      const customerId = customerIds[i % customerIds.length];
      const number = `OZ-${new Date().getFullYear()}-${pad(1000 + i, 5)}`;
      const createdAt = new Date(Date.now() - (orderCount - i) * 3600_000 * 7).toISOString();

      // Статус распределяем по прогрессу: часть уже выдана, часть в ячейках, часть в пути.
      let status: string;
      if (i <= 6) status = 'issued';
      else if (i <= 16) status = 'ready';
      else if (i <= 20) status = 'stored';
      else if (i <= 22) status = 'accepted';
      else status = 'in_transit';

      const info = db
        .prepare(
          `INSERT INTO orders (number, customer_id, status, total, created_at, updated_at, issued_at, comment)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
        )
        .run(
          number,
          customerId,
          status,
          createdAt,
          createdAt,
          status === 'issued' ? new Date(Date.parse(createdAt) + 86400_000).toISOString() : null,
          i % 5 === 0 ? 'Хрупкий товар' : '',
        );
      const orderId = Number(info.lastInsertRowid);

      // 1-3 позиции в заказе
      const itemsCount = 1 + (i % 3);
      let total = 0;
      for (let j = 0; j < itemsCount; j++) {
        const product = PRODUCTS[(i + j * 3) % PRODUCTS.length];
        const productId = productIds[(i + j * 3) % productIds.length];
        const qty = 1 + ((i + j) % 3);
        total += product.price * qty;

        const itemInfo = db
          .prepare(
            `INSERT INTO order_items (order_id, product_id, qty, status) VALUES (?, ?, ?, 'awaiting')`,
          )
          .run(orderId, productId, qty);

        // Размещаем в ячейку, если заказ уже физически на складе
        if (status === 'stored' || status === 'ready') {
          const itemId = Number(itemInfo.lastInsertRowid);
          placeItem(itemId, productId, qty, orderId);
        }
      }

      db.prepare(`UPDATE orders SET total = ? WHERE id = ?`).run(total, orderId);
    }

    logEvent('seed', 'system', null, 'Склад сгенерирован с демо-данными', {
      racks: RACK_DEFS.length,
      orders: orderCount,
    });
  });
}

/**
 * Разместить позицию заказа в подходящую свободную ячейку (round-robin).
 * Курсор двигается по списку ячеек, поэтому демо-товары распределяются
 * по всем стеллажам, а не оседают в первых ячейках.
 */
function placeItem(itemId: number, productId: number, qty: number, orderId: number): void {
  const rows = db
    .prepare(
      `SELECT l.id, l.code, l.capacity,
              COALESCE((SELECT SUM(s.qty) FROM stock s WHERE s.location_id = l.id), 0) AS used
       FROM locations l
       WHERE l.status != 'blocked'
       ORDER BY l.level, l.position, l.rack_id`,
    )
    .all() as Array<{ id: number; code: string; capacity: number; used: number }>;

  if (rows.length === 0) return;

  // Ищем ячейку с местом, начиная с позиции курсора (с обходом по кругу).
  let location: { id: number; code: string } | undefined;
  for (let offset = 0; offset < rows.length; offset++) {
    const idx = (cellCursor + offset) % rows.length;
    const r = rows[idx];
    if (r.capacity - r.used >= qty) {
      location = r;
      cellCursor = idx + 1;
      break;
    }
  }
  if (!location) return;

  db.prepare(`UPDATE order_items SET location_id = ?, status = 'stored' WHERE id = ?`).run(location.id, itemId);
  db.prepare(
    `INSERT INTO stock (product_id, location_id, qty, order_id, placed_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(productId, location.id, qty, orderId, nowIso());

  // Ячейка считается занятой, как только в ней что-то лежит.
  db.prepare(`UPDATE locations SET status = 'occupied' WHERE id = ?`).run(location.id);
}

/** Сбросить и пересоздать демо-данные. */
export function resetWarehouse(): void {
  db.exec(`DROP TABLE IF EXISTS stock; DROP TABLE IF EXISTS order_items; DROP TABLE IF EXISTS orders;
           DROP TABLE IF EXISTS events; DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS customers;
           DROP TABLE IF EXISTS locations; DROP TABLE IF EXISTS racks;`);
  initSchema();
  generateWarehouse();
}
