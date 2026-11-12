import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { КАТАЛОГ_V2 } from '../model/каталог';
import { новыйЭкземпляр } from '../model/проект';
import { примитивыЭкземпляра } from './примитивы';

/** Тот же хэш, что в scripts/превью-изделий.cjs: изменилась рисуемая геометрия — превью надо переснять */
const fnv = (с: string) => {
  let h = 2166136261;
  for (let i = 0; i < с.length; i++) {
    h ^= с.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
};

const хэшГеометрии = (id: string) => {
  const и = КАТАЛОГ_V2.find((x) => x.id === id)!;
  const р = примитивыЭкземпляра(и, новыйЭкземпляр(и, 'п1'));
  return fnv(
    JSON.stringify([
      р.примитивы.map((п) => [п.форма, п.размер.map((v) => +v.toFixed(1)), п.t.map((v) => +v.toFixed(1)), п.R.map((v) => +v.toFixed(3)), typeof п.мат === 'string' ? п.мат : п.мат.цвет, п.биты, п.r]),
      и.материалы,
      и.габариты,
    ]),
  );
};

const папка = join(process.cwd(), 'public', 'Библиотека', 'превью');

describe('мини-превью изделий', () => {
  it('у каждого изделия каталога есть файл превью (снять: node scripts/превью-изделий.cjs <адрес dev-сервера>)', () => {
    const нет = КАТАЛОГ_V2.filter((и) => !existsSync(join(папка, `${и.id}.webp`))).map((и) => и.id);
    expect(нет).toEqual([]);
  });

  it('файлы превью не пустые и небольшие', () => {
    for (const и of КАТАЛОГ_V2) {
      const размер = statSync(join(папка, `${и.id}.webp`)).size;
      expect(размер, и.id).toBeGreaterThan(300);
      expect(размер, и.id).toBeLessThan(60_000);
    }
  });

  it('геометрия не менялась с момента съёмки (хэш в манифесте совпадает); иначе переснять изменённые', () => {
    const м = JSON.parse(readFileSync(join(папка, '_манифест.json'), 'utf8')) as { хэши: Record<string, string> };
    const устарели = КАТАЛОГ_V2.filter((и) => м.хэши[и.id] !== хэшГеометрии(и.id)).map((и) => и.id);
    expect(устарели).toEqual([]);
  });
});
