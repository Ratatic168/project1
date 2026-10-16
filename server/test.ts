/**
 * Функциональный тест API: проверяет все эндпоинты и полный бизнес-цикл
 * заказа (приёмка → размещение → готовность → выдача) с контролем
 * освобождения ячеек. Запуск: node server/test.ts
 */
const B = 'http://127.0.0.1:3000/api';

let pass = 0;
let fail = 0;
function chk(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (cond) pass++;
  else fail++;
}

async function req(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {};
  if (init?.body != null) headers['Content-Type'] = 'application/json';
  const r = await fetch(B + path, { ...init, headers });
  const text = await r.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data };
}

async function main() {
  // --- 1. Все GET-эндпоинты ---
  const gets = [
    '/health',
    '/layout',
    '/cells',
    '/cells/1',
    '/products',
    '/customers',
    '/orders',
    '/orders/16',
    '/dashboard',
    '/events',
    '/search?q=OZ-2026-01016',
  ];
  for (const p of gets) {
    const r = await req(p);
    chk(`GET ${p}`, r.status === 200);
  }

  // --- 2. Структура layout ---
  const layout = (await req('/layout')).data as any;
  chk('layout: помещение задано', layout?.room?.width === 10 && layout?.room?.depth === 8);
  chk('layout: 8 стеллажей', Array.isArray(layout?.racks) && layout.racks.length === 8);
  chk('layout: 256 ячеек', Array.isArray(layout?.cells) && layout.cells.length === 256);
  const withContents = layout.cells.filter((c: any) => c.contents.length > 0).length;
  chk('layout: есть заполненные ячейки', withContents > 0, `${withContents} шт.`);

  // --- 3. Поиск по штрихкоду и по номеру заказа ---
  const searchProduct = (await req('/search?q=4600000001001')).data as any[];
  chk('поиск: товар по штрихкоду', Array.isArray(searchProduct) && searchProduct.some((x) => x.type === 'product'));
  const searchOrder = (await req('/search?q=OZ-2026-01016')).data as any[];
  chk('поиск: заказ по номеру', Array.isArray(searchOrder) && searchOrder.some((x) => x.type === 'order'));

  // --- 4. Полный бизнес-цикл на новом заказе ---
  const orders = (await req('/orders')).data as any[];
  const transit = orders.find((o) => o.status === 'in_transit');
  if (!transit) {
    chk('бизнес-цикл: найден заказ in_transit', false);
  } else {
    const id = transit.id;
    const a = (await req(`/orders/${id}/accept`, { method: 'POST' })).data as any;
    chk('приёмка: статус accepted', a?.status === 'accepted', a?.status);

    const st = (await req(`/orders/${id}/store`, { method: 'POST' })).data as any;
    chk('размещение: статус stored', st?.order?.status === 'stored', st?.order?.status);
    chk('размещение: есть ячейки', Array.isArray(st?.placements) && st.placements.length > 0);

    const detail = (await req(`/orders/${id}`)).data as any;
    const placedItems = (detail.items ?? []).filter((i: any) => i.locationId != null);
    chk('размещение: позиции получили ячейки', placedItems.length > 0, `${placedItems.length} шт.`);

    const locId = placedItems[0].locationId;
    // Сколько единиц именно этого заказа лежит в ячейке — их и должно списать.
    const issuedQty = placedItems
      .filter((i: any) => i.locationId === locId)
      .reduce((s: number, i: any) => s + i.qty, 0);

    const beforeCell = (await req(`/cells/${locId}`)).data as any;
    chk('ячейка до выдачи: занята', beforeCell?.used > 0, `used=${beforeCell?.used}`);

    const rdy = (await req(`/orders/${id}/ready`, { method: 'POST' })).data as any;
    chk('готовность: статус ready', rdy?.status === 'ready', rdy?.status);

    const iss = (await req(`/orders/${id}/issue`, { method: 'POST' })).data as any;
    chk('выдача: статус issued', iss?.status === 'issued', iss?.status);

    // В ячейке могут лежать товары разных заказов: списываются только позиции
    // выданного заказа, поэтому used должен уменьшиться ровно на issuedQty.
    const afterCell = (await req(`/cells/${locId}`)).data as any;
    chk(
      'после выдачи: списаны позиции заказа',
      afterCell?.used === beforeCell.used - issuedQty,
      `used ${beforeCell.used} -> ${afterCell?.used}, списано ожидалось ${issuedQty}`,
    );

    const another = orders.find((o) => o.id !== id && (o.status === 'accepted' || o.status === 'in_transit'));
    if (another) {
      const c = (await req(`/orders/${another.id}/cancel`, { method: 'POST' })).data as any;
      chk('отмена: статус cancelled', c?.status === 'cancelled', c?.status);
    }
  }

  // --- 5. Создание товара и клиента ---
  const np = (await req('/products', {
    method: 'POST',
    body: JSON.stringify({ sku: `TEST-${Date.now()}`, name: 'Тестовый товар', price: 100 }),
  })).data as any;
  chk('создание товара', np?.id != null && np?.name === 'Тестовый товар');

  const nc = (await req('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: 'Тестовый клиент', phone: '+7 000 000-00-00' }),
  })).data as any;
  chk('создание клиента', nc?.id != null && nc?.name === 'Тестовый клиент');

  console.log('\n========================================');
  console.log(`ИТОГО: PASS=${pass}  FAIL=${fail}`);
  console.log('========================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Ошибка теста:', e);
  process.exit(1);
});
