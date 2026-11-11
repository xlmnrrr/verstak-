/**
 * Скрипт: собирает демо-кухню и кладёт её в public/Библиотека/пример-проекта.kitchen,
 * чтобы этот файл можно было отдать Claude как образец формата.
 *
 * Запуск (из папки приложения):
 *   npx esbuild scripts/пример.ts --bundle --format=esm --platform=node --outfile=.tmp-пример.mjs && node .tmp-пример.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { собратьДемо } from '../src/lib/демо';

const проект = собратьДемо();
const папка = join(process.cwd(), 'public', 'Библиотека');
mkdirSync(папка, { recursive: true });
const файл = join(папка, 'пример-проекта.kitchen');
writeFileSync(файл, JSON.stringify(проект, null, 2), 'utf8');
console.log(`Записан ${файл}`);
console.log(`Объектов: ${проект.объекты.length}`);
console.log(`Комната: ${проект.комната.длина} × ${проект.комната.ширина} × ${проект.комната.высота_стен}`);
