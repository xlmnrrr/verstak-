/**
 * Геометрии частей моделей (docs/модели.md §2): строятся кодом по размерам, в метрах, центр в нуле, с UV в метрах
 * (текстура ткани и шлифовки одного масштаба на любой детали). Ключ кодирует вид и размеры в мм:
 *   брус:ш,в,г,r[,с]     — скруглённый брус (RoundedBoxGeometry), r — радиус, с — сегментов скругления
 *   пруток:d,L[,сег]     — цилиндр вдоль Y (диаметр d, длина L), торцы закрыты; UV вдоль длины — v
 *   трубка:d,L           — то же без торцов
 *   точёная:<вид>,d,h    — тело вращения вокруг Y: кноб духовки, мебельная кнопка, ножка
 *   подушка:ш,в,г,r,b    — мягкий скруглённый короб (матрас, изголовье, сиденье), b — выпуклость верха
 *   рамка:ш,в,ш1,г       — плоская рамка (уплотнитель двери): наружный ш×в, ширина полосы ш1, толщина г
 * Кэш живёт сессию (ключи округлены до 0,5 мм); `освободитьНеиспользуемые` чистит при открытии проекта.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const кэш = new Map<string, THREE.BufferGeometry>();

/** UV в метрах: проекция по главной оси нормали (волокно и стёжка одного шага на детали любого размера) */
function uvПоМетрам(г: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = г.getAttribute('position');
  const n = г.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = p.getX(i);
      v = p.getZ(i);
    } else if (ax >= az) {
      u = p.getZ(i);
      v = p.getY(i);
    } else {
      u = p.getX(i);
      v = p.getY(i);
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  г.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return г;
}

/** Цилиндр вдоль Y с UV: u — по окружности (метры дуги), v — вдоль оси (метры): шлифовка идёт вдоль прутка */
function пруток(d: number, L: number, сег: number, торцы: boolean): THREE.BufferGeometry {
  const г = new THREE.CylinderGeometry(d / 2, d / 2, L, сег, 1, !торцы);
  const p = г.getAttribute('position');
  const uv = г.getAttribute('uv');
  const окр = Math.PI * d;
  for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * окр, p.getY(i));
  return г;
}

/** Профили тел вращения: x — доля радиуса, y — доля высоты */
const ПРОФИЛИ: Record<string, [number, number][]> = {
  // кноб духовки: юбка, тело, проточка под пальцы, торец с фаской
  кноб: [[0, 0], [0.98, 0], [1, 0.08], [1, 0.62], [0.92, 0.7], [0.92, 0.78], [0.96, 0.84], [0.9, 0.98], [0.75, 1], [0, 1]],
  // мебельная кнопка: ножка и шляпка
  кнопка: [[0, 0], [0.42, 0], [0.42, 0.45], [0.6, 0.5], [0.95, 0.62], [1, 0.75], [0.92, 0.92], [0.6, 1], [0, 1]],
  // раковина-чаша: наружная стенка вверх, борт, внутренняя стенка вниз к дну (стенка ~8 % радиуса)
  чаша: [[0, 0], [0.32, 0], [0.55, 0.05], [0.85, 0.35], [0.98, 0.8], [1, 1], [0.93, 1], [0.9, 0.82], [0.78, 0.4], [0.5, 0.14], [0, 0.11]],
  // фланец точечного светильника: плоский диск с фаской снизу
  фланец: [[0, 0], [0.95, 0], [1, 0.4], [1, 1], [0, 1]],
  // корпус лампы GX53: короткий цилиндр со скруглённым низом
  линза: [[0, 0], [0.9, 0], [0.98, 0.18], [1, 0.45], [1, 1], [0, 1]],
  // кольцо с отверстием 84 % (низ накладного цилиндра): видна внутренняя стенка
  'кольцо-84': [[0.84, 0], [0.97, 0], [1, 0.12], [1, 1], [0.84, 1], [0.84, 0]],
  // ножка кровати: сужение к полу
  ножка: [[0, 0], [0.78, 0], [0.82, 0.04], [0.9, 0.85], [1, 0.9], [1, 1], [0, 1]],
};

function точёная(вид: string, d: number, h: number): THREE.BufferGeometry {
  const пр = (ПРОФИЛИ[вид] ?? ПРОФИЛИ.кнопка).map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x * (d / 2)), y * h - h / 2));
  const г = new THREE.LatheGeometry(пр, 40);
  г.computeVertexNormals();
  return uvПоМетрам(г);
}

/**
 * Подушка: мягкий скруглённый короб — скруглённый в плане прямоугольник, выдавленный по высоте со скруглением рёбер
 * (bevel радиусом r в 5 сегментов). Нормали сглажены через рёбра, стёжку и ворс даёт normal-карта ткани.
 * b — небольшая выпуклость верха к середине, 0 — ровный верх.
 */
function подушка(ш: number, в: number, г: number, r: number, b: number): THREE.BufferGeometry {
  const rr = Math.max(0.002, Math.min(r, ш / 2 - 0.002, в / 2 - 0.002, г / 2 - 0.002));
  const a = ш / 2 - rr;
  const c = г / 2 - rr;
  const rc = Math.min(rr * 1.5, a, c);
  const ф = new THREE.Shape();
  ф.moveTo(-a + rc, -c);
  ф.lineTo(a - rc, -c);
  ф.quadraticCurveTo(a, -c, a, -c + rc);
  ф.lineTo(a, c - rc);
  ф.quadraticCurveTo(a, c, a - rc, c);
  ф.lineTo(-a + rc, c);
  ф.quadraticCurveTo(-a, c, -a, c - rc);
  ф.lineTo(-a, -c + rc);
  ф.quadraticCurveTo(-a, -c, -a + rc, -c);
  const глубина = Math.max(0.001, в - 2 * rr);
  let геом: THREE.BufferGeometry = new THREE.ExtrudeGeometry(ф, { depth: глубина, bevelEnabled: true, bevelThickness: rr, bevelSize: rr, bevelSegments: 5, curveSegments: 6, steps: 1 });
  геом.rotateX(-Math.PI / 2);
  геом.translate(0, -глубина / 2, 0);
  if (b > 0) {
    const p = геом.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < в / 2 - rr * 1.05) continue;
      const fx = 1 - Math.min(1, (p.getX(i) / (ш / 2)) ** 2);
      const fz = 1 - Math.min(1, (p.getZ(i) / (г / 2)) ** 2);
      p.setY(i, y + b * fx * fz);
    }
  }
  геом.deleteAttribute('uv');
  геом.deleteAttribute('normal');
  геом = mergeVertices(геом, 1e-5);
  геом.computeVertexNormals();
  return uvПоМетрам(геом);
}

/** Плоская рамка (уплотнитель, рамка стекла) одной геометрией */
function рамка(ш: number, в: number, ш1: number, г: number): THREE.BufferGeometry {
  const ф = new THREE.Shape();
  ф.moveTo(-ш / 2, -в / 2);
  ф.lineTo(ш / 2, -в / 2);
  ф.lineTo(ш / 2, в / 2);
  ф.lineTo(-ш / 2, в / 2);
  ф.lineTo(-ш / 2, -в / 2);
  const д = new THREE.Path();
  д.moveTo(-ш / 2 + ш1, -в / 2 + ш1);
  д.lineTo(-ш / 2 + ш1, в / 2 - ш1);
  д.lineTo(ш / 2 - ш1, в / 2 - ш1);
  д.lineTo(ш / 2 - ш1, -в / 2 + ш1);
  д.lineTo(-ш / 2 + ш1, -в / 2 + ш1);
  ф.holes.push(д);
  const г2 = new THREE.ExtrudeGeometry(ф, { depth: г, bevelEnabled: false, curveSegments: 4 });
  г2.translate(0, 0, -г / 2);
  return uvПоМетрам(г2);
}

/** Геометрия по ключу (размеры в ключе — мм) */
export function геометрияМодели(ключ: string): THREE.BufferGeometry {
  const в = кэш.get(ключ);
  if (в) return в;
  const [вид, хвост = ''] = ключ.split(':');
  const ч = хвост.split(',');
  const м = (i: number) => Number(ч[i] ?? 0) / 1000;
  let г: THREE.BufferGeometry;
  switch (вид) {
    case 'брус': {
      const r = Math.max(0.0003, Math.min(м(3), м(0) / 2 - 0.0002, м(1) / 2 - 0.0002, м(2) / 2 - 0.0002));
      г = uvПоМетрам(new RoundedBoxGeometry(м(0), м(1), м(2), Number(ч[4] ?? 3), r));
      break;
    }
    case 'пруток':
      г = пруток(м(0), м(1), Number(ч[2] ?? 16), true);
      break;
    case 'трубка':
      г = пруток(м(0), м(1), Number(ч[2] ?? 24), false);
      break;
    case 'точёная':
      г = точёная(ч[0], Number(ч[1]) / 1000, Number(ч[2]) / 1000);
      break;
    case 'подушка':
      г = подушка(м(0), м(1), м(2), м(3), м(4));
      break;
    case 'рамка':
      г = рамка(м(0), м(1), м(2), м(3));
      break;
    case 'дуга': {
      // дуга трубы (излив смесителя): тор радиуса R, труба d, угол в градусах; лежит в плоскости XY от +X против часовой
      г = new THREE.TorusGeometry(м(1), м(0) / 2, 16, 40, (Number(ч[2] ?? 180) * Math.PI) / 180);
      г = uvПоМетрам(г);
      break;
    }
    default:
      г = uvПоМетрам(new THREE.BoxGeometry(0.01, 0.01, 0.01));
  }
  г.computeBoundingSphere();
  кэш.set(ключ, г);
  return г;
}

/** Ключ с размерами, округлёнными до 0,5 мм: одинаковые детали делят геометрию */
export const ключ = (вид: string, ...числа: (number | string)[]) => `${вид}:${числа.map((x) => (typeof x === 'number' ? Math.round(x * 2) / 2 : x)).join(',')}`;

/** Треугольников в геометрии (для бюджетов и отчёта) */
export const треугольников = (к: string) => {
  const г = геометрияМодели(к);
  return (г.index ? г.index.count : г.getAttribute('position').count) / 3;
};

/** Освободить геометрии, ключей которых нет в наборе (при открытии другого проекта) */
export function освободитьНеиспользуемые(живые: Set<string>) {
  for (const [к, г] of кэш) {
    if (живые.has(к)) continue;
    г.dispose();
    кэш.delete(к);
  }
}
