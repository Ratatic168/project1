/** Диагностика бизнес-цикла: показывает ответы действий по заказу. */
const B = 'http://127.0.0.1:3000/api';

async function req(path: string, init?: RequestInit) {
  const r = await fetch(B + path, { headers: { 'Content-Type': 'application/json' }, ...init });
  const text = await r.text();
  return { status: r.status, body: text };
}

const orders = JSON.parse((await req('/orders')).body) as any[];
console.log('Статусы заказов:', orders.map((o) => `${o.id}:${o.status}`).join(' '));

const transit = orders.find((o) => o.status === 'in_transit');
console.log('Выбран заказ in_transit:', transit?.id, transit?.number, transit?.status);

if (transit) {
  console.log('\nPOST /accept ->', JSON.stringify(await req(`/orders/${transit.id}/accept`, { method: 'POST' })));
  console.log('GET  /orders/:id ->', (await req(`/orders/${transit.id}`)).body.slice(0, 200));
}
