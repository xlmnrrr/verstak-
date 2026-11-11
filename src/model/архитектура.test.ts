import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { очиститьИмя } from '../../electron/имя-файла.mjs';

function всеФайлы(папка: string): string[] {
  return readdirSync(папка).flatMap((имя) => {
    const п = join(папка, имя);
    return statSync(п).isDirectory() ? всеФайлы(п) : [п];
  });
}

const ЗАПРЕЩЕНО = ['three', 'react', 'react-dom', 'zustand', '@react-three/fiber', '@react-three/drei'];

describe('архитектура: слои', () => {
  const модель = всеФайлы(join(process.cwd(), 'src', 'model')).filter((ф) => ф.endsWith('.ts') && !ф.endsWith('.test.ts'));

  it('src/model не импортирует three, react, zustand и DOM', () => {
    expect(модель.length).toBeGreaterThan(5);
    for (const файл of модель) {
      const текст = readFileSync(файл, 'utf8');
      for (const м of текст.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const имя = м[1];
        for (const з of ЗАПРЕЩЕНО) {
          expect(имя === з || имя.startsWith(з + '/'), `${файл}: запрещённый импорт «${имя}»`).toBe(false);
        }
        // слои выше модели не импортируем
        expect(/\/(three|ui|store|render)\//.test(имя), `${файл}: импорт верхнего слоя «${имя}»`).toBe(false);
      }
      expect(/\b(window|document|localStorage|navigator)\./.test(текст.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${файл}: обращение к DOM`).toBe(false);
    }
  });

  it('src/store не импортирует three и react', () => {
    const стор = всеФайлы(join(process.cwd(), 'src', 'store')).filter((ф) => ф.endsWith('.ts') && !ф.endsWith('.test.ts'));
    for (const файл of стор) {
      const текст = readFileSync(файл, 'utf8');
      for (const м of текст.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        expect(['three', 'react', 'react-dom'].includes(м[1]), `${файл}: «${м[1]}»`).toBe(false);
      }
    }
  });
});

describe('очистка имени файла', () => {
  it('убирает запрещённые символы Windows и разделители пути', () => {
    expect(очиститьИмя('Кв. 160: кухня/гардеробная?')).toBe('Кв. 160_ кухня_гардеробная_');
    expect(очиститьИмя('..\\..\\Windows\\system32')).toBe('_._Windows_system32');
    expect(очиститьИмя('a<b>c|d"e*f')).toBe('a_b_c_d_e_f');
  });
  it('защищает от служебных имён, пустых и длинных имён', () => {
    expect(очиститьИмя('CON')).toBe('Проект');
    expect(очиститьИмя('nul.txt')).toBe('Проект');
    expect(очиститьИмя('com1')).toBe('Проект');
    expect(очиститьИмя('')).toBe('Проект');
    expect(очиститьИмя('   ...  ')).toBe('Проект');
    expect(очиститьИмя(undefined)).toBe('Проект');
    expect(очиститьИмя('я'.repeat(200)).length).toBe(80);
    expect(очиститьИмя('Кухня.')).toBe('Кухня');
    expect(очиститьИмя('Кухня 3D')).toBe('Кухня 3D');
  });
  it('путь с «..» не может выйти из папки', () => {
    const н = очиститьИмя('../../секрет');
    expect(н.includes('/') || н.includes('\\')).toBe(false);
  });
});
