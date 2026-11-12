import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { БИБЛИОТЕКА, МАСШТАБ_ТЕКСТУР, ТЕКСТУРЫ, слойТекстуры } from './библиотека';

const папка = join(process.cwd(), 'public', 'Библиотека', 'текстуры');

describe('текстуры материалов 2.0', () => {
  it('слоёв не больше 16 (размер массива в загрузчике), имена не повторяются', () => {
    expect(ТЕКСТУРЫ.length).toBeLessThanOrEqual(16);
    expect(new Set(ТЕКСТУРЫ).size).toBe(ТЕКСТУРЫ.length);
  });

  it('у каждой текстуры есть фото-файл, normal-карта и масштаб; файлы настоящие WebP', () => {
    for (const имя of ТЕКСТУРЫ) {
      for (const файл of [`${имя}.webp`, `${имя}.нормаль.webp`]) {
        const путь = join(папка, файл);
        expect(existsSync(путь), файл).toBe(true);
        const байты = readFileSync(путь);
        expect(байты.subarray(0, 4).toString('latin1'), `${файл}: не RIFF`).toBe('RIFF');
        expect(байты.subarray(8, 12).toString('latin1'), `${файл}: не WebP`).toBe('WEBP');
      }
      expect(МАСШТАБ_ТЕКСТУР[имя], `масштаб ${имя}`).toBeGreaterThan(0);
    }
  });

  it('у процедурных запасных есть файл для каждой из первых 11 текстур', () => {
    for (const имя of ТЕКСТУРЫ.slice(0, 11)) expect(existsSync(join(папка, 'запасные', `${имя}.webp`)), имя).toBe(true);
  });

  it('каждая текстура в лицензиях одной строкой с CC0', () => {
    const л = readFileSync(join(process.cwd(), 'public', 'Библиотека', 'лицензии.md'), 'utf8').split('\n');
    for (const имя of ТЕКСТУРЫ) {
      const строки = л.filter((с) => с.startsWith(`| ${имя} |`));
      expect(строки.length, `лицензия ${имя}`).toBe(1);
      expect(строки[0]).toContain('CC0');
      expect(строки[0]).toContain('ambientcg.com/a/');
    }
  });

  it('материалы библиотеки ссылаются на существующие текстуры; для стен и пола есть выбор', () => {
    for (const м of БИБЛИОТЕКА) if (м.текстура) expect(слойТекстуры(м.текстура), `${м.id}: нет слоя`).toBeGreaterThan(0);
    expect(БИБЛИОТЕКА.filter((м) => м.группа === 'Стены').length).toBeGreaterThanOrEqual(5);
    expect(БИБЛИОТЕКА.filter((м) => м.группа === 'Пол').length).toBeGreaterThanOrEqual(5);
    expect(new Set(БИБЛИОТЕКА.map((м) => м.id)).size).toBe(БИБЛИОТЕКА.length);
  });
});
