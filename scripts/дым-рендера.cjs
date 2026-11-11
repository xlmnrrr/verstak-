/** Быстрый дым рендера в окне Electron: пример кухни, статистика, скриншот, ошибки консоли. Аргумент: адрес dev-сервера */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, открытьПример, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const куда = path.join(process.cwd(), 'проверка', 'v2');
fs.mkdirSync(куда, { recursive: true });

(async () => {
  const процесс = запуститьElectron({ адрес: АДРЕС, данные: path.join(process.cwd(), 'проверка', 'данные-дым') });
  try {
    const { браузер, стр } = await подключиться(АДРЕС);
    const к = слушатьКонсоль(стр);
    await пауза(1200);
    await открытьПример(стр);
    await пауза(2500);
    const ст = await стр.evaluate(async () => {
      const x = window.__кухня;
      if (!x) return null;
      await x.самопроверкаГотова;
      x.gl.render(x.scene, x.camera);
      return x.статистика();
    });
    console.log('статистика:', JSON.stringify({ ...ст, группы: undefined }));
    const пр = await стр.evaluate(() => { const я = window.__кухня.ядро; return я.проблемы.map((x) => ({ ...x, изд: window.__кухня.ядро.сборщик.запись(x.id)?.экз.изделие })); });
    console.log('проблемы «влезает»:', JSON.stringify(пр));
    await стр.screenshot({ path: path.join(куда, 'дым-пример.png') });
    console.log('ошибок:', к.ошибки.length, 'шейдер:', к.шейдер.length);
    for (const е of к.ошибки.slice(0, 8)) console.log('  ошибка:', е);
    for (const е of к.шейдер.slice(0, 3)) console.log('  шейдер:', е);
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
})().catch((e) => {
  console.error('ДЫМ УПАЛ:', e.message);
  process.exit(1);
});
