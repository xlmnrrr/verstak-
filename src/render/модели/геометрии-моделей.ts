/**
 * Геометрии частей моделей (docs/модели.md §2): строятся кодом по размерам, в метрах, центр в нуле, с UV в метрах
 * (текстура ткани и шлифовки одного масштаба на любой детали). Ключ кодирует вид и размеры в мм:
 *   брус:ш,в,г,r[,с]     — скруглённый брус (RoundedBoxGeometry), r — радиус, с — сегментов скругления
 *   пруток:d,L[,сег]     — цилиндр вдоль Y (диаметр d, длина L), торцы закрыты; UV вдоль длины — v
 *   трубка:d,L           — то же без торцов
 *   точёная:<вид>,d,h    — тело вращения вокруг Y: кноб духовки, мебельная кнопка, ножка
 *   подушка:ш,в,г,r,b    — мягкий скруглённый короб (матрас, изголовье, сиденье), b — выпуклость верха
 *   рамка:ш,в,ш1,г       — плоская рамка (уплотнитель двери): наружный ш×в, ширина полосы ш1, толщина г
 *   овал:вид,ш,г,в        — тело вращения вида, растянутое по ширине (унитаз, овальная чаша)
 *   пирамида:ш1,г1,ш2,г2,в — усечённая пирамида (кожух вытяжки), шар:d, штора:ш,в,шаг,амп — полотно со складками,
 *   крона:d,h,n          — крона растения из n листьев (цвет вершин), дуга:d,R,угол — тор (излив, конфорка)
 * Кэш живёт сессию (ключи округлены до 0,5 мм); `освободитьНеиспользуемые` чистит при открытии проекта.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  // тарелка: неглубокая чаша с утолщённым бортом
  тарелка: [[0, 0], [0.55, 0], [0.6, 0.08], [0.98, 0.55], [1, 1], [0.95, 1], [0.9, 0.42], [0.55, 0.2], [0, 0.17]],
  // кружка и стакан: стенка и дно
  кружка: [[0, 0], [0.9, 0], [1, 0.05], [1, 1], [0.91, 1], [0.91, 0.09], [0, 0.09]],
  // ваза: пузатое тело с узким горлом
  ваза: [[0, 0], [0.42, 0], [0.5, 0.03], [0.88, 0.32], [1, 0.52], [0.84, 0.78], [0.42, 0.93], [0.4, 1], [0.32, 1], [0.32, 0.9], [0.72, 0.76], [0.9, 0.52], [0.8, 0.3], [0, 0.07]],
  // кашпо: конус с бортом
  кашпо: [[0, 0], [0.66, 0], [0.74, 0.04], [1, 1], [0.94, 1], [0.84, 0.1], [0, 0.08]],
  // абажур: усечённый конус-оболочка (видна внутренняя сторона)
  абажур: [[0.99, 0], [1, 0.015], [0.64, 1], [0.62, 1], [0.97, 0.01], [0.99, 0]],
  // купол подвесного светильника: полусфера-оболочка
  купол: [[0.97, 0], [1, 0], [0.99, 0.3], [0.88, 0.62], [0.62, 0.86], [0.3, 0.97], [0.0001, 1], [0.0001, 0.965], [0.28, 0.935], [0.58, 0.82], [0.84, 0.6], [0.95, 0.3], [0.97, 0]],
  // стекло люка стиральной машины: выпуклый купол
  люк: [[1, 0], [0.98, 0.4], [0.88, 0.78], [0.55, 0.96], [0.0001, 1]],
  // колпачок конфорки: ступень и выпуклая крышка
  колпачок: [[0, 0], [0.9, 0], [1, 0.25], [0.78, 0.55], [0.6, 0.95], [0.4, 1], [0, 1]],
  // шайба с закруглённым краем (ножки, диски)
  шайба: [[0, 0], [0.96, 0], [1, 0.2], [1, 0.8], [0.96, 1], [0, 1]],
  // сужающаяся ножка (стул, стол, журнальный столик)
  'ножка-конус': [[0, 0], [0.55, 0], [0.58, 0.03], [1, 1], [0, 1]],
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

/** Усечённая пирамида (кожух вытяжки): низ ш1 × г1, верх ш2 × г2, плоские грани */
function пирамидаГ(ш1: number, г1: number, ш2: number, г2: number, в: number, dz = 0): THREE.BufferGeometry {
  const y0 = -в / 2;
  const y1 = в / 2;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const A = [v(-ш1 / 2, y0, -г1 / 2), v(ш1 / 2, y0, -г1 / 2), v(ш1 / 2, y0, г1 / 2), v(-ш1 / 2, y0, г1 / 2)];
  const B = [v(-ш2 / 2, y1, -г2 / 2 + dz), v(ш2 / 2, y1, -г2 / 2 + dz), v(ш2 / 2, y1, г2 / 2 + dz), v(-ш2 / 2, y1, г2 / 2 + dz)];
  const pos: number[] = [];
  const квад = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    for (const p of [a, b, c, a, c, d]) pos.push(p.x, p.y, p.z);
  };
  квад(A[3], A[2], B[2], B[3]); // перед
  квад(A[1], A[0], B[0], B[1]); // зад
  квад(A[2], A[1], B[1], B[2]); // право
  квад(A[0], A[3], B[3], B[0]); // лево
  квад(B[3], B[2], B[1], B[0]); // верх
  квад(A[0], A[1], A[2], A[3]); // низ
  const г = new THREE.BufferGeometry();
  г.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  г.computeVertexNormals();
  return uvПоМетрам(г);
}

/** Штора: полотно со складками по синусу (шаг складки, амплитуда), лицом в +Z */
function шторка(ш: number, в: number, шаг: number, амп: number): THREE.BufferGeometry {
  const сегШ = Math.max(12, Math.round((ш / Math.max(0.02, шаг)) * 10));
  const г = new THREE.PlaneGeometry(ш, в, сегШ, 2);
  const p = г.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, амп * Math.sin((x / Math.max(0.02, шаг)) * Math.PI * 2));
  }
  г.computeVertexNormals();
  const uv = г.getAttribute('uv');
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getY(i));
  return г;
}

/** Детерминированный генератор для кроны и др. (одинаковая модель в любой сессии) */
function случайный(семя: number) {
  let a = семя >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Крона комнатного растения: n листьев-эллипсоидов в объёме d × h, светлее к краю (цвет вершин) */
function крона(d: number, h: number, n: number): THREE.BufferGeometry {
  const rnd = случайный(Math.round(d * 1000 + h * 7 + n));
  const куски: THREE.BufferGeometry[] = [];
  const лист = Math.max(0.02, Math.min(d, h) * 0.34);
  for (let i = 0; i < n; i++) {
    // точка в эллипсоиде, больше листьев к краю
    const u = rnd() * 2 - 1;
    const φ = rnd() * Math.PI * 2;
    const r0 = 0.45 + 0.55 * Math.cbrt(rnd());
    const s = Math.sqrt(1 - u * u);
    const x = (s * Math.cos(φ) * d * r0) / 2;
    const y = (u * h * r0) / 2;
    const z = (s * Math.sin(φ) * d * r0) / 2;
    const л = new THREE.SphereGeometry(0.5, 7, 5);
    л.scale(лист * (0.7 + rnd() * 0.5), лист * 0.06, лист * (1.3 + rnd() * 0.6));
    // лист смотрит наружу и вверх
    const e = new THREE.Euler(-0.5 + rnd() - (y / h) * 0.9, φ + Math.PI / 2 + (rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.8);
    л.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
    л.translate(x, y, z);
    // цвет: у центра темнее, к краю и вверх светлее
    const св = 0.5 + 0.5 * r0 * (0.8 + 0.2 * (y / h + 0.5));
    const цв = new Float32Array(л.getAttribute('position').count * 3);
    for (let k = 0; k < цв.length; k += 3) {
      цв[k] = св * (0.85 + rnd() * 0.06);
      цв[k + 1] = св;
      цв[k + 2] = св * 0.8;
    }
    л.setAttribute('color', new THREE.BufferAttribute(цв, 3));
    л.deleteAttribute('uv');
    куски.push(л);
  }
  const г = mergeGeometries(куски, false);
  return uvПоМетрам(г);
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
    case 'овал': {
      // тело вращения вида ч[0], растянутое по X до ширины м(1) при диаметре м(2) по Z (унитаз, овальная чаша)
      const пр = (ПРОФИЛИ[ч[0]] ?? ПРОФИЛИ.чаша).map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x * (м(2) / 2)), y * м(3) - м(3) / 2));
      const л = new THREE.LatheGeometry(пр, 48);
      л.scale(м(1) / м(2), 1, 1);
      л.computeVertexNormals();
      г = uvПоМетрам(л);
      break;
    }
    case 'пирамида':
      г = пирамидаГ(м(0), м(1), м(2), м(3), м(4), м(5));
      break;
    case 'шар':
      г = uvПоМетрам(new THREE.SphereGeometry(м(0) / 2, 28, 18));
      break;
    case 'штора':
      г = шторка(м(0), м(1), м(2), м(3));
      break;
    case 'крона':
      г = крона(м(0), м(1), Number(ч[2] ?? 40));
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
