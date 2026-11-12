/**
 * Этап 8: 12 экранов × 2 темы = 24 скриншота в проверка\v2\8-NN-<экран>-<тема>.png (окно Electron).
 * Экраны: первый запуск, обложка, проекты, мастер, редактор, каталог, свойства, материалы, проверки, настройки, справка, экспорт.
 * Запуск: node scripts/скриншоты-8.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

async function прогон(тема, суффикс, порт) {
  const данные = path.join(корень, 'проверка', `данные-скриншоты-${суффикс}`);
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  for (const имя of ['Пример кухни', 'Кухня Ивановых', 'Гостиная']) fs.copyFileSync(path.join(корень, 'public', 'Библиотека', 'пример-проекта.kitchen'), path.join(данные, 'Проекты', `${имя}.kitchen`));
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  let сделано = 0;
  try {
    const { браузер, стр } = await подключиться(АДРЕС, порт);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    const снять = async (n, имя) => {
      await пауза(600);
      await стр.screenshot({ path: path.join(снимки, `8-${String(n).padStart(2, '0')}-${имя}-${суффикс}.png`) });
      сделано++;
    };
    await пауза(2500);
    await S((т) => window.__верстакStore.getState().установитьТему(т), тема);
    await пауза(600);
    // 1. первый запуск (диалог с туром)
    const диалог = await S(() => !!document.querySelector('[aria-label="Первый запуск"]'));
    await снять(1, 'первый-запуск');
    await S(() => [...document.querySelectorAll('.модал button')].find((b) => b.textContent.includes('Пропустить'))?.click());
    await пауза(500);
    // 2. обложка
    await снять(2, 'обложка');
    // 3. проекты
    await S(() => window.__верстакStore.getState().наЭкран('проекты'));
    await пауза(1200);
    await снять(3, 'проекты');
    // 4. мастер
    await S(() => window.__верстакStore.getState().наЭкран('комната'));
    await пауза(600);
    await снять(4, 'мастер');
    // 5. редактор с примером
    await S(() => window.__верстакStore.getState().наЭкран('меню'));
    await пауза(500);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3500);
    await снять(5, 'редактор');
    // 6. каталог
    await S(() => window.__верстакStore.getState().переключитьКаталог(true));
    await пауза(500);
    await снять(6, 'каталог');
    await S(() => window.__верстакStore.getState().переключитьКаталог(false));
    await пауза(400);
    // 7. свойства
    await S(() => window.__верстакStore.getState().выбрать([window.__верстакStore.getState().проект2.объекты[2].id]));
    await пауза(1200);
    await снять(7, 'свойства');
    // 8. материалы (панель свойств, раздел материалов)
    await S(() => {
      const т = [...document.querySelectorAll('.выезд.справа h3')].find((h) => /Материал|Фасад|Цвет/.test(h.textContent));
      (т ?? document.querySelector('[aria-label="Поиск материала"]'))?.scrollIntoView({ block: 'start' });
    });
    await снять(8, 'материалы');
    await S(() => window.__верстакStore.getState().выбрать([]));
    // 9–12. окна
    const окна = [['Проверки', 9, 'проверки'], ['Настройки', 10, 'настройки'], ['Справка', 11, 'справка'], ['Экспорт', 12, 'экспорт']];
    for (const [метка, n, имя] of окна) {
      await S((м) => [...document.querySelectorAll('.полоса .кн-и')].find((b) => b.getAttribute('aria-label') === м)?.click(), метка);
      await пауза(600);
      const есть = await S(() => !!document.querySelector('.модал.окно'));
      if (!есть) console.log(`   окно «${метка}» не открылось`);
      await снять(n, имя);
      await стр.keyboard.press('Escape');
      await пауза(300);
    }
    проверка(`тема «${тема}»: 12 скриншотов, ошибок консоли нет`, сделано === 12 && к.шейдер.length === 0 && к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e)).length === 0, `снято ${сделано}, диалог первого запуска ${диалог}`);
    await браузер.disconnect();
  } catch (е) {
    проверка(`тема «${тема}»`, false, е && е.message ? е.message : String(е));
  } finally {
    spawnSync('taskkill', ['/PID', String(процесс.pid), '/T', '/F'], { stdio: 'ignore' });
    await пауза(1500);
  }
}

(async () => {
  await прогон('мастерская', 'dark', 9396);
  await прогон('калька', 'light', 9397);
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`Итог: ${ок} из ${итоги.length}; файлов 8-*: ${fs.readdirSync(снимки).filter((x) => /^8-\d\d-.*-(dark|light)\.png$/.test(x)).length}`);
  process.exit(ок === итоги.length ? 0 : 1);
})();
