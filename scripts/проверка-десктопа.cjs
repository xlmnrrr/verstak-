/**
 * Проверка десктопной версии: подключается к запущенному Electron по CDP,
 * проходит по интерфейсу и проверяет РЕАЛЬНОЕ сохранение проекта в папку «Проекты\».
 *
 * Запуск:
 *   1) в одном окне:  npx electron . --remote-debugging-port=9222
 *   2) в другом:      node scripts/проверка-десктопа.cjs
 */
const path = require('node:path');
const fs = require('node:fs');
const PUPPETEER = 'C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core';
const puppeteer = require(PUPPETEER);

const пауза = (мс) => new Promise((r) => setTimeout(r, мс));
const папкаПроектов = path.join(process.cwd(), 'Проекты');

(async () => {
  const браузер = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
  });
  const страницы = await браузер.pages();
  const страница = страницы.find((p) => !p.url().startsWith('devtools://')) || страницы[0];
  if (!страница) throw new Error('не нашёл страницу приложения');

  const ошибки = [];
  страница.on('pageerror', (e) => ошибки.push(e.message));
  страница.on('console', (м) => {
    if (м.type() === 'error') ошибки.push(м.text());
  });

  await страница.bringToFront();
  await пауза(1200);

  const естьМост = await страница.evaluate(() => typeof window.кухня === 'object' && !!window.кухня);
  const адрес = страница.url();

  // 1. Открыть пример кухни
  const нажалПример = await страница.evaluate(() => {
    const э = [...document.querySelectorAll('.карточка')].find((x) =>
      x.textContent.includes('Пример кухни'),
    );
    if (!э) return false;
    э.click();
    return true;
  });
  await пауза(3000);
  const наЭкране = await страница.evaluate(() => {
    const сч = document.querySelector('.низ span:last-child');
    const канва = !!document.querySelector('canvas');
    return { счётчик: сч ? сч.textContent : null, естьКанва: канва };
  });

  // 2. Дать проекту понятное имя
  await страница.evaluate(() => {
    const и = document.querySelector('.шапка input');
    if (!и) return;
    const сеттер = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    сеттер.call(и, 'Проверка сохранения');
    и.dispatchEvent(new Event('input', { bubbles: true }));
    и.dispatchEvent(new Event('blur', { bubbles: true }));
  });
  await пауза(600);

  // 3. Сохранить
  const нажалСохранить = await страница.evaluate(() => {
    const к = [...document.querySelectorAll('.шапка button')].find((b) =>
      b.textContent.includes('Сохранить'),
    );
    if (!к) return false;
    к.click();
    return true;
  });
  await пауза(2500);

  const сообщение = await страница.evaluate(() => {
    const с = document.querySelector('.сообщение');
    return с ? с.textContent : null;
  });

  // 4. Проверить, что файл реально появился
  const файлы = fs.existsSync(папкаПроектов) ? fs.readdirSync(папкаПроектов) : [];
  const наш = файлы.filter((ф) => ф.includes('Проверка сохранения'));
  let содержимоеОк = false;
  let объектов = 0;
  if (наш.length) {
    const полный = path.join(папкаПроектов, наш.find((ф) => ф.endsWith('.kitchen')));
    const данные = JSON.parse(fs.readFileSync(полный, 'utf8'));
    объектов = (данные.объекты ?? []).length;
    содержимоеОк = данные.схема === undefined && данные.schemaVersion === 1 && объекты > 0;
  }

  const итог = {
    адрес,
    мост_кухня_доступен: естьМост,
    нажалПример,
    наЭкране,
    нажалСохранить,
    сообщение,
    папкаПроектов,
    файлыВПапке: файлы,
    нашПроект: наш,
    объектовВФайле: объектов,
    файлВалиден: содержимоеОк,
    ошибок: ошибки.length,
    ошибки: ошибки.slice(0, 10),
  };
  console.log(JSON.stringify(итог, null, 2));
  браузер.disconnect();
  process.exit(содержимоеОк ? 0 : 2);
})().catch((e) => {
  console.error('ПРОВЕРКА УПАЛА:', e.message);
  process.exit(1);
});
