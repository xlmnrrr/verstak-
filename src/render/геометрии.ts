/**
 * Общие единичные геометрии: одна на форму на всё время работы.
 * Размер детали приходит из атрибута инстанса aSize, поэтому геометрия одна на все размеры.
 *  - плита: куб 12 треугольников, position = ±0.5 (масштаб aSize·position);
 *  - плита-фаска: куб с настоящей фаской 45° (44 треугольника): position = знак угла ±0.5, aOff = смещение к ребру;
 *    вершина = знак ⊙ max(aSize/2 − r, 0) + aOff · r, поэтому фаска одного радиуса на детали любого размера;
 *  - цилиндр, сфера, конус: единичные примитивы, масштаб по aSize.
 */
import * as THREE from 'three';

export type ФормаГеометрии = 'плита' | 'плита-фаска' | 'цилиндр' | 'сфера' | 'конус' | 'сектор' | 'обод';

/**
 * Диск 3/4 (карусель углового модуля): радиус 0,5, высота 1, ось Y, центр в нуле; нет четверти −X / +Z
 * (вырез к створкам). `обод` — бортик по дуге того же диска, стенка 1 % диаметра.
 */
function сектор270(внутр: number): THREE.BufferGeometry {
  const ф = new THREE.Shape();
  if (внутр <= 0) {
    ф.moveTo(0, 0);
    ф.lineTo(0, -0.5);
    ф.absarc(0, 0, 0.5, -Math.PI / 2, Math.PI, false);
    ф.lineTo(0, 0);
  } else {
    ф.moveTo(0, -0.5);
    ф.absarc(0, 0, 0.5, -Math.PI / 2, Math.PI, false);
    ф.lineTo(-внутр, 0);
    ф.absarc(0, 0, внутр, Math.PI, -Math.PI / 2, true);
    ф.lineTo(0, -0.5);
  }
  const g = new THREE.ExtrudeGeometry(ф, { depth: 1, bevelEnabled: false, curveSegments: 36 });
  // фигура в XY → ось выдавливания в +Y; координата y фигуры уходит в −Z, вырез III четверти → (−X, +Z)
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.5, 0);
  g.deleteAttribute('uv');
  return g;
}

const кэш = new Map<ФормаГеометрии, THREE.BufferGeometry>();

function плита(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.deleteAttribute('uv');
  return g;
}

/** Куб с фаской. Контроль направления граней — по образцу размеров (полу-размеры 0.5, 0.4, 0.3; r = 0.1). */
function плитаФаска(): THREE.BufferGeometry {
  const pos: number[] = [];
  const off: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const образец = { half: [0.5, 0.4, 0.3], r: 0.1 };

  const вершина = (знак: number[], смещение: number[], нормаль: number[]) => {
    const л = Math.hypot(...нормаль);
    pos.push(знак[0] * 0.5, знак[1] * 0.5, знак[2] * 0.5);
    off.push(смещение[0], смещение[1], смещение[2]);
    nor.push(нормаль[0] / л, нормаль[1] / л, нормаль[2] / л);
    return pos.length / 3 - 1;
  };
  const точка = (i: number) => {
    const знак = [pos[i * 3] * 2, pos[i * 3 + 1] * 2, pos[i * 3 + 2] * 2];
    return [0, 1, 2].map((k) => знак[k] * Math.max(образец.half[k] - образец.r, 0) + off[i * 3 + k] * образец.r);
  };
  /** добавить четырёхугольник; треугольники разворачиваются, если смотрят внутрь */
  const четыре = (a: number, b: number, c: number, d: number, нормаль: number[]) => {
    for (const [i, j, k] of [
      [a, b, c],
      [a, c, d],
    ]) {
      const p0 = точка(i);
      const p1 = точка(j);
      const p2 = точка(k);
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[0] * нормаль[0] + n[1] * нормаль[1] + n[2] * нормаль[2] >= 0) idx.push(i, j, k);
      else idx.push(i, k, j);
    }
  };

  const оси = [0, 1, 2];

  // грани: ось a, знак s; остальные оси b, c
  for (const a of оси) {
    for (const s of [-1, 1]) {
      const [b, c] = оси.filter((x) => x !== a);
      const н = [0, 0, 0];
      н[a] = s;
      const смещение = [0, 0, 0];
      смещение[a] = s;
      const углы = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sb, sc]) => {
        const знак = [0, 0, 0];
        знак[a] = s;
        знак[b] = sb;
        знак[c] = sc;
        return вершина(знак, смещение, н);
      });
      четыре(углы[0], углы[1], углы[2], углы[3], н);
    }
  }
  // рёбра: пары осей (a < b), знаки sa, sb, третья ось c
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 3; b++) {
      const c = 3 - a - b;
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const н = [0, 0, 0];
          н[a] = sa;
          н[b] = sb;
          const вА = [0, 0, 0];
          вА[a] = sa;
          const вБ = [0, 0, 0];
          вБ[b] = sb;
          const ряд = [-1, 1].map((sc) => {
            const знак = [0, 0, 0];
            знак[a] = sa;
            знак[b] = sb;
            знак[c] = sc;
            return [вершина(знак, вА, н), вершина(знак, вБ, н)];
          });
          четыре(ряд[0][0], ряд[0][1], ряд[1][1], ряд[1][0], н);
        }
      }
    }
  }
  // углы: три вершины с разными смещениями
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const н = [sx, sy, sz];
        const знак = [sx, sy, sz];
        const v0 = вершина(знак, [sx, 0, 0], н);
        const v1 = вершина(знак, [0, sy, 0], н);
        const v2 = вершина(знак, [0, 0, sz], н);
        const p0 = точка(v0);
        const p1 = точка(v1);
        const p2 = точка(v2);
        const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
        const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        if (nn[0] * н[0] + nn[1] * н[1] + nn[2] * н[2] >= 0) idx.push(v0, v1, v2);
        else idx.push(v0, v2, v1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 3));
  g.setIndex(idx);
  return g;
}

export function геометрияФормы(форма: ФормаГеометрии): THREE.BufferGeometry {
  let г = кэш.get(форма);
  if (г) return г;
  switch (форма) {
    case 'плита':
      г = плита();
      break;
    case 'плита-фаска':
      г = плитаФаска();
      break;
    case 'цилиндр':
      г = new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1);
      г.deleteAttribute('uv');
      break;
    case 'сфера':
      г = new THREE.SphereGeometry(0.5, 18, 12);
      г.deleteAttribute('uv');
      break;
    case 'конус':
      г = new THREE.ConeGeometry(0.5, 1, 20, 1, false);
      г.deleteAttribute('uv');
      break;
    case 'сектор':
      г = сектор270(0);
      break;
    case 'обод':
      г = сектор270(0.49);
      break;
  }
  кэш.set(форма, г);
  return г;
}

/** Число треугольников формы (для отчёта и тестов) */
export const треугольниковВФорме = (форма: ФормаГеометрии): number => {
  const г = геометрияФормы(форма);
  return (г.index ? г.index.count : г.getAttribute('position').count) / 3;
};

/**
 * Геометрия группы: общие буферы вершин + свои инстансные атрибуты.
 * Dispose освобождает буферы на видеокарте; общие вершины пересоздаются при следующем рисовании.
 */
export function геометрияГруппы(форма: ФормаГеометрии): THREE.BufferGeometry {
  const база = геометрияФормы(форма);
  const г = new THREE.BufferGeometry();
  for (const имя of Object.keys(база.attributes)) г.setAttribute(имя, база.getAttribute(имя));
  if (база.index) г.setIndex(база.index);
  return г;
}
