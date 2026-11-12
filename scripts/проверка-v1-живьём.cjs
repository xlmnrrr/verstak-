/**
 * Живой прогон миграции на НАСТОЯЩЕЙ папке Проекты\ (без подмены VERSTAK_DATA_DIR): открыть v1-проект, нажать «Сохранить»,
 * показать имя и schemaVersion файла в Проекты\ и .v1.kitchen в Бэкапы\. Исходник перед прогоном копируется в проверка\копия-до-прогона.
 * Запуск: node scripts/проверка-v1-живьём.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { puppeteer, пауза, подключиться } = require('./электрон-общее.cjs');
const { spawn } = require('node:child_process');

const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const имя = 'Пример_ кухня из шаблонов';
const файл = path.join(корень, 'Проекты', имя + '.kitchen');
const схема = (ф) => {
  try {
    return JSON.parse(fs.readFileSync(ф, 'utf8')).schemaVersion;
  } catch {
    return null;
  }
};

(async () => {
  const копия = path.join(корень, 'проверка', 'копия-до-прогона');
  fs.mkdirSync(копия, { recursive: true });
  fs.copyFileSync(файл, path.join(копия, имя + '.kitchen'));
  console.log(`ДО:    Проекты\\${имя}.kitchen — schemaVersion ${схема(файл)}`);
  console.log(`       Бэкапы\\: ${fs.readdirSync(path.join(корень, 'Бэкапы')).filter((f) => f.includes('.v1.')).join(', ') || '(.v1.kitchen нет)'}`);

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VERSTAK_DATA_DIR;
  env['КУХНЯ_DEV_URL'] = АДРЕС;
  const процесс = spawn(require(path.join(корень, 'node_modules', 'electron')), ['.', '--remote-debugging-port=9334'], { cwd: корень, env, stdio: 'ignore' });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9334);
    await пауза(1500);
    await стр.evaluate(() => {
      const к = [...document.querySelectorAll('.карточка')].find((x) => x.textContent.includes('Проекты') || x.textContent.includes('Открыть проект'));
      if (к) к.click();
    });
    await пауза(1200);
    await стр.evaluate((n) => {
      const к = [...document.querySelectorAll('.список-проектов > *')].find((x) => x.textContent.includes(n));
      const б = к && [...к.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Открыть');
      if (б) б.click();
    }, имя);
    await пауза(2500);
    const состояние = await стр.evaluate(() => {
      const с = window.__верстакStore.getState();
      return { экран: с.экран, схемаВПамяти: с.проект2.schemaVersion, объектов: с.проект2.объекты.length, название: с.проект2.название };
    });
    console.log('ОТКРЫТ:', JSON.stringify(состояние));
    await стр.evaluate(() => {
      const б = [...document.querySelectorAll('.шапка button')].find((x) => x.textContent.trim() === 'Сохранить');
      if (б) б.click();
    });
    await пауза(2000);
    await стр.screenshot({ path: path.join(корень, 'проверка', 'v2', '1А2-v1-живьём.png') });
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
  const б = path.join(корень, 'Бэкапы');
  const v1 = fs.readdirSync(б).filter((f) => f.includes('.v1.'));
  console.log(`ПОСЛЕ: Проекты\\${имя}.kitchen — schemaVersion ${схема(файл)}`);
  for (const f of v1) console.log(`       Бэкапы\\${f} — schemaVersion ${схема(path.join(б, f))}`);
  const ок = схема(файл) === 2 && v1.length > 0 && v1.every((f) => схема(path.join(б, f)) === 1);
  console.log(ок ? 'ИТОГ: ОК' : 'ИТОГ: НЕТ');
  process.exitCode = ок ? 0 : 2;
})().catch((e) => {
  console.error('УПАЛО:', e.message);
  process.exit(1);
});
