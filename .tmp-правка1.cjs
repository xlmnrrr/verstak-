const fs = require('fs');
let p = 'src/render/модели/геометрии-моделей.ts';
let s = fs.readFileSync(p, 'utf8');
const замена = (a, b) => {
  if (!s.includes(a)) throw new Error('не найдено: ' + a.slice(0, 60));
  s = s.replace(a, () => b);
};
// профили
замена(
  '  // ножка кровати: сужение к полу\n  ножка:',
  `  // тарелка: неглубокая чаша с утолщённым бортом
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
  ножка:`,
);
// геометрии
замена(
  '/** Геометрия по ключу (размеры в ключе — мм) */',
  `/** Усечённая пирамида (кожух вытяжки): низ ш1 × г1, верх ш2 × г2, плоские грани */
function пирамидаГ(ш1: number, г1: number, ш2: number, г2: number, в: number): THREE.BufferGeometry {
  const y0 = -в / 2;
  const y1 = в / 2;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const A = [v(-ш1 / 2, y0, -г1 / 2), v(ш1 / 2, y0, -г1 / 2), v(ш1 / 2, y0, г1 / 2), v(-ш1 / 2, y0, г1 / 2)];
  const B = [v(-ш2 / 2, y1, -г2 / 2), v(ш2 / 2, y1, -г2 / 2), v(ш2 / 2, y1, г2 / 2), v(-ш2 / 2, y1, г2 / 2)];
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

/** Геометрия по ключу (размеры в ключе — мм) */`,
);
замена(
  "    case 'дуга': {",
  `    case 'пирамида':
      г = пирамидаГ(м(0), м(1), м(2), м(3), м(4));
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
    case 'дуга': {`,
);
замена('import { mergeVertices } from', 'import { mergeGeometries, mergeVertices } from');
замена(
  ' *   рамка:ш,в,ш1,г       — плоская рамка (уплотнитель двери): наружный ш×в, ширина полосы ш1, толщина г\n',
  ' *   рамка:ш,в,ш1,г       — плоская рамка (уплотнитель двери): наружный ш×в, ширина полосы ш1, толщина г\n *   пирамида:ш1,г1,ш2,г2,в — усечённая пирамида (кожух вытяжки), шар:d, штора:ш,в,шаг,амп — полотно со складками,\n *   крона:d,h,n          — крона растения из n листьев (цвет вершин), дуга:d,R,угол — тор (излив, конфорка)\n',
);
fs.writeFileSync(p, s);

p = 'src/render/модели/материалы-моделей.ts';
s = fs.readFileSync(p, 'utf8');
замена(
  "  | 'краска-белая';",
  "  | 'краска-белая'\n  | 'дерево'\n  | 'кожа'\n  | 'ткань'\n  | 'эмаль-белая'\n  | 'пластик-светлый'\n  | 'листва'\n  | 'земля'\n  | 'зеркало-м'\n  | 'тюль'\n  | 'штора';",
);
замена(
  '  берёза: {',
  `  // дерево: скан дуба, оттенок задаёт изделие (ножки стульев, столы, рамы)
  дерево: { создать: ф({ color: '#ffffff', roughness: 0.6, clearcoat: 0.22, clearcoatRoughness: 0.45 }), тень: 'всегда', текстура: { имя: 'дуб', шаг: 0.6, вращение: Math.PI / 2 } },
  // кожа и экокожа: ровная, с мягким глянцем
  кожа: { создать: ф({ color: '#ffffff', roughness: 0.5, clearcoat: 0.32, clearcoatRoughness: 0.4, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }), тень: 'всегда' },
  // гладкая ткань (велюр, подушки): мягкий отблеск по краю, без рисунка
  ткань: { создать: ф({ color: '#ffffff', roughness: 1, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#e6e1d8') }), тень: 'всегда' },
  // белая эмаль корпусов техники
  'эмаль-белая': { создать: ф({ color: '#eceeee', metalness: 0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1 }), тень: 'всегда' },
  'пластик-светлый': { создать: ф({ color: '#e4e4e1', metalness: 0, roughness: 0.46, clearcoat: 0.2, clearcoatRoughness: 0.5 }), тень: 'всегда' },
  // листва: тёмная к центру и светлая к краю (цвет вершин), мягкий отблеск
  листва: { создать: ф({ color: '#5f8a4c', roughness: 0.62, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#bfe3a0'), vertexColors: true, side: THREE.DoubleSide }), тень: 'всегда' },
  земля: { создать: ф({ color: '#35261c', roughness: 1 }), тень: 'фото' },
  // зеркало: серебро с минимальной шероховатостью, отражает комнату
  'зеркало-м': { создать: ф({ color: '#e8ecee', metalness: 1, roughness: 0.03, envMapIntensity: 1.1 }), тень: 'фото' },
  // тюль: лёгкая полупрозрачная вуаль
  тюль: { создать: ф({ color: '#f4f1ea', roughness: 1, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }), тень: 'нет' },
  штора: { создать: ф({ color: '#ffffff', roughness: 1, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color('#d8d2c6'), side: THREE.DoubleSide }), тень: 'всегда' },
  берёза: {`,
);
fs.writeFileSync(p, s);
console.log('ok');
