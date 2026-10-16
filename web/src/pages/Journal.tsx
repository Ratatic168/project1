import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateTime } from '../format';
import type { EventRow } from '../types';

export default function Journal() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.events(300).then(setEvents).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">Журнал операций</h1>
      <p className="page-sub">История событий склада: приёмка, размещение, выдача, изменения данных</p>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty">Загрузка…</div>
        ) : events.length === 0 ? (
          <div className="empty">Событий пока нет</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Время</th>
                <th>Тип</th>
                <th>Сущность</th>
                <th>Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.ts)}</td>
                  <td>
                    <span className="badge" style={{ background: '#334155', color: '#cbd5e1' }}>
                      {e.type}
                    </span>
                  </td>
                  <td className="muted">{e.entity}{e.entityId ? ` #${e.entityId}` : ''}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
