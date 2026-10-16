/**
 * HTTP-сервер на Fastify. Предоставляет REST API и раздаёт собранный фронтенд.
 *
 * Запуск:  node server/server.ts   (или: npm start)
 * Порт:    WMS_PORT (по умолчанию 3000)
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initSchema } from './db.ts';
import { generateWarehouse, isSeeded, resetWarehouse } from './seed.ts';
import * as svc from './service.ts';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = resolve(here, '..', 'web', 'dist');

initSchema();
if (!isSeeded()) {
  console.log('База пуста — генерирую демо-склад...');
  generateWarehouse();
  console.log('Демо-данные созданы.');
}

const app = Fastify({ logger: false });

await app.register(cors, { origin: true });

// Раздача собранного фронтенда (если собран).
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}

// --------------------------------------------------------------------------
// Системные
// --------------------------------------------------------------------------

app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

// --------------------------------------------------------------------------
// Склад и визуализация
// --------------------------------------------------------------------------

app.get('/api/layout', async () => svc.getLayout());
app.get('/api/cells', async () => svc.getAllCells());
app.get('/api/cells/:id', async (req) => {
  const id = Number((req.params as { id: string }).id);
  const cell = svc.getLocation(id);
  if (!cell) return { error: 'Ячейка не найдена' };
  return cell;
});

// --------------------------------------------------------------------------
// Товары
// --------------------------------------------------------------------------

app.get('/api/products', async () => svc.listProducts());
app.post('/api/products', async (req) => {
  const body = req.body as Record<string, unknown>;
  try {
    return svc.createProduct({
      sku: String(body.sku ?? ''),
      name: String(body.name ?? ''),
      barcode: body.barcode ? String(body.barcode) : '',
      category: body.category ? String(body.category) : '',
      width: Number(body.width ?? 0.2),
      height: Number(body.height ?? 0.15),
      depth: Number(body.depth ?? 0.2),
      weight: Number(body.weight ?? 0.5),
      price: Number(body.price ?? 0),
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
});

// --------------------------------------------------------------------------
// Клиенты
// --------------------------------------------------------------------------

app.get('/api/customers', async () => svc.listCustomers());
app.post('/api/customers', async (req) => {
  const body = req.body as Record<string, unknown>;
  try {
    return svc.createCustomer({
      name: String(body.name ?? ''),
      phone: body.phone ? String(body.phone) : undefined,
      email: body.email ? String(body.email) : undefined,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
});

// --------------------------------------------------------------------------
// Заказы
// --------------------------------------------------------------------------

app.get('/api/orders', async (req) => {
  const q = req.query as { status?: string; search?: string };
  return svc.listOrders({ status: q.status, search: q.search });
});
app.get('/api/orders/:id', async (req) => {
  const id = Number((req.params as { id: string }).id);
  const order = svc.getOrder(id);
  if (!order) return { error: 'Заказ не найден' };
  return { ...order, items: svc.getOrderItems(id) };
});

const orderAction =
  (action: 'accept' | 'store' | 'ready' | 'issue' | 'cancel') =>
  async (req: { params: { id: string } }) => {
    const id = Number(req.params.id);
    try {
      switch (action) {
        case 'accept':
          return svc.acceptOrder(id);
        case 'store':
          return svc.storeOrder(id);
        case 'ready':
          return svc.markReady(id);
        case 'issue':
          return svc.issueOrder(id);
        case 'cancel':
          return svc.cancelOrder(id);
      }
    } catch (e) {
      return { error: (e as Error).message };
    }
  };

app.post('/api/orders/:id/accept', orderAction('accept'));
app.post('/api/orders/:id/store', orderAction('store'));
app.post('/api/orders/:id/ready', orderAction('ready'));
app.post('/api/orders/:id/issue', orderAction('issue'));
app.post('/api/orders/:id/cancel', orderAction('cancel'));

// --------------------------------------------------------------------------
// Статистика, журнал, поиск
// --------------------------------------------------------------------------

app.get('/api/dashboard', async () => svc.getDashboard());
app.get('/api/events', async (req) => {
  const q = req.query as { limit?: string };
  return svc.listEvents(q.limit ? Number(q.limit) : 200);
});
app.get('/api/search', async (req) => {
  const q = req.query as { q?: string };
  if (!q.q) return [];
  return svc.searchByBarcode(q.q.trim());
});

// --------------------------------------------------------------------------
// Сброс демо-данных
// --------------------------------------------------------------------------

app.post('/api/seed', async () => {
  resetWarehouse();
  return { ok: true, message: 'Демо-данные пересозданы' };
});

// --------------------------------------------------------------------------

const port = Number(process.env.WMS_PORT ?? 3000);
try {
  await app.listen({ port, host: '127.0.0.1' });
  console.log(`WMS server: http://127.0.0.1:${port}`);
  console.log(`API:        http://127.0.0.1:${port}/api/health`);
} catch (err) {
  console.error('Не удалось запустить сервер:', err);
  process.exit(1);
}
