import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { api } from '../api';
import { fillColor } from '../format';
import type { CellView, Layout } from '../types';

/**
 * 3D-модель помещения со стеллажами на Three.js.
 * Коробки на полках отражают реальное содержимое ячеек (qty из stock).
 *
 * Параметр URL ?order=ID подсвечивает ячейки конкретного заказа и подводит
 * камеру к соответствующему стеллажу — чтобы кладовщик сразу увидел место.
 */
export default function Warehouse3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [selected, setSelected] = useState<CellView | null>(null);
  const [hovered, setHovered] = useState<CellView | null>(null);
  const [searchParams] = useSearchParams();
  const [highlight, setHighlight] = useState<Set<number>>(new Set());
  const [highlightLabel, setHighlightLabel] = useState('');

  // Загружаем данные планировки.
  useEffect(() => {
    api
      .layout()
      .then(setLayout)
      .catch(() => setLayout(null));
  }, []);

  // Подсветка заказа по параметру ?order=ID.
  useEffect(() => {
    const orderId = searchParams.get('order');
    if (!orderId) return;
    api
      .order(Number(orderId))
      .then((order) => {
        const ids = new Set<number>();
        for (const it of order.items ?? []) if (it.locationId != null) ids.add(it.locationId);
        setHighlight(ids);
        setHighlightLabel(`Заказ ${order.number}`);
        const first = layout?.cells.find((c) => ids.has(c.id));
        if (first) setSelected(first);
      })
      .catch(() => setHighlight(new Set()));
  }, [searchParams, layout]);

  // Строим сцену при получении данных; при изменении подсветки обновляем цвета.
  useEffect(() => {
    if (!layout || !mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1120');

    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(14, 12, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(layout.room.width / 2, 1, layout.room.depth / 2);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;

    // Освещение.
    scene.add(new THREE.HemisphereLight('#dbeafe', '#1e293b', 1.1));
    const dirLight = new THREE.DirectionalLight('#ffffff', 1.6);
    dirLight.position.set(10, 18, 8);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight('#94a3b8', 0.5);
    fillLight.position.set(-8, 6, -6);
    scene.add(fillLight);

    const clickable: THREE.Object3D[] = [];
    const boxesByCell = new Map<number, THREE.Mesh[]>();

    // Пол помещения.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.room.width, layout.room.depth),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(layout.room.width / 2, 0, layout.room.depth / 2);
    scene.add(floor);

    const grid = new THREE.GridHelper(layout.room.width, Math.round(layout.room.width), '#334155', '#273449');
    grid.position.set(layout.room.width / 2, 0.01, layout.room.depth / 2);
    scene.add(grid);

    // Прозрачные стены.
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.8,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const RW = layout.room.width;
    const RD = layout.room.depth;
    const makeWall = (w: number, x: number, z: number, ry: number) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), wallMat);
      wall.position.set(x, 1.5, z);
      wall.rotation.y = ry;
      scene.add(wall);
    };
    makeWall(RW, RW / 2, 0, 0);
    makeWall(RD, 0, RD / 2, Math.PI / 2);
    makeWall(RD, RW, RD / 2, Math.PI / 2);

    // Индекс ячеек.
    const cellIndex = new Map<string, CellView>();
    for (const cell of layout.cells) {
      cellIndex.set(`${cell.rackId}-${cell.level}-${cell.position}`, cell);
    }

    const postMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.6, metalness: 0.3 });
    const shelfMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 });

    for (const rack of layout.racks) {
      const group = new THREE.Group();
      const rackH = rack.levels * rack.levelHeight;

      for (const [px, pz] of [
        [0, 0],
        [rack.width, 0],
        [0, rack.depth],
        [rack.width, rack.depth],
      ] as const) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, rackH, 0.08), postMat);
        post.position.set(px, rackH / 2, pz);
        group.add(post);
      }

      for (let level = 1; level <= rack.levels; level++) {
        const y = (level - 0.5) * rack.levelHeight;

        const shelf = new THREE.Mesh(new THREE.BoxGeometry(rack.width, 0.04, rack.depth), shelfMat);
        shelf.position.set(rack.width / 2, y, rack.depth / 2);
        group.add(shelf);

        const cellDepth = rack.depth / rack.cellsPerLevel;
        for (let pos = 1; pos <= rack.cellsPerLevel; pos++) {
          const cell = cellIndex.get(`${rack.id}-${level}-${pos}`);
          const zCenter = (pos - 0.5) * cellDepth;

          if (cell && cell.used > 0) {
            const boxes = Math.min(cell.used, 3);
            const meshes: THREE.Mesh[] = [];
            const isHl = highlight.has(cell.id);
            for (let b = 0; b < boxes; b++) {
              const size = 0.3;
              const box = new THREE.Mesh(
                new THREE.BoxGeometry(size, size, size),
                new THREE.MeshStandardMaterial({
                  color: isHl ? '#f97316' : fillColor(cell.fill, cell.status),
                  emissive: isHl ? '#f97316' : '#000000',
                  emissiveIntensity: isHl ? 0.5 : 0,
                  roughness: 0.5,
                }),
              );
              box.position.set(
                rack.width / 2 + (b % 2 === 0 ? -0.2 : 0.2),
                y + 0.04 + size / 2,
                zCenter + (b === 2 ? 0.18 : 0),
              );
              group.add(box);
              meshes.push(box);
            }
            boxesByCell.set(cell.id, meshes);
          }

          if (cell) {
            const zone = new THREE.Mesh(
              new THREE.BoxGeometry(rack.width, rack.levelHeight, cellDepth),
              new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
            );
            zone.position.set(rack.width / 2, y, zCenter);
            zone.userData = { cell };
            group.add(zone);
            clickable.push(zone);
          }
        }
      }

      group.position.set(rack.x, 0, rack.y);
      scene.add(group);
    }

    // Если задан заказ — наводим камеру на его стеллаж.
    if (highlight.size > 0) {
      const firstCell = layout.cells.find((c) => highlight.has(c.id));
      const rack = layout.racks.find((r) => r.id === firstCell?.rackId);
      if (rack && firstCell) {
        const cx = rack.x + rack.width / 2;
        const cz = rack.y + rack.depth / 2;
        controls.target.set(cx, 1.2, cz);
        camera.position.set(cx + 5, 5.5, cz + 5.5);
      }
    }

    // Наведение и выбор ячейки.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickable, false);
      return hits.length > 0 ? (hits[0].object.userData.cell as CellView) : null;
    };

    const onPointerMove = (event: MouseEvent) => {
      const cell = pick(event);
      setHovered(cell);
      renderer.domElement.style.cursor = cell ? 'pointer' : 'default';
    };
    const onClick = (event: MouseEvent) => {
      const cell = pick(event);
      if (cell) setSelected(cell);
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [layout, highlight]);

  const info = selected ?? hovered;

  return (
    <div>
      <h1 className="page-title">Склад — 3D модель</h1>
      <p className="page-sub">
        Интерактивная модель помещения со стеллажами. Вращайте мышью, приближайте колесом. Коробки на полках —
        размещённые товары, оранжевым подсвечены ячейки выбранного заказа.
      </p>

      {highlightLabel && (
        <div className="card" style={{ marginBottom: 8, padding: '8px 14px', borderColor: 'var(--accent)' }}>
          <span className="muted">Подсветка:</span> <b>{highlightLabel}</b>
          <span className="muted"> · {highlight.size} ячеек</span>
        </div>
      )}

      <div className="view3d-wrap" ref={mountRef}>
        {!layout && <div className="empty">Загрузка модели…</div>}
        <div className="view3d-hint">ЛКМ — выбрать ячейку · колесо — масштаб · ЛКМ с зажатой — вращение</div>
      </div>

      {info && (
        <div className="card" style={{ marginTop: 12 }}>
          <b style={{ color: 'var(--accent)' }}>{info.code}</b>
          <span className="muted">
            {' '}
            · Стеллаж {info.rackCode} · Полка {info.level} · Занято {info.used}/{info.capacity}
          </span>
          {info.contents.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {info.contents.map((c, i) => (
                <li key={i}>
                  {c.productName}{' '}
                  <span className="muted">
                    ({c.sku}) — {c.qty} шт.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
