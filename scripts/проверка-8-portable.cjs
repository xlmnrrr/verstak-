/**
 * Этап 8, п. 3: portable хранит данные рядом с .exe. Копия portable кладётся в C:\VerstakPortable, запускается, сохраняет проект;
 * проверяем, что Проекты\ появились рядом с .exe. Запуск: node scripts/проверка-8-portable.cjs
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { puppeteer, пауза } = require('./электрон-общее.cjs');

const папка = 'C:\\VerstakPortable';
const исходный = path.join(process.cwd(), 'release', 'Верстак-0.1.0-portable.exe');
const exe = path.join(папка, 'Верстак-portable.exe');
const снимки = path.join(process.cwd(), 'проверка', 'v2');
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};
(async () => {
  fs.rmSync(папка, { recursive: true, force: true });
  fs.mkdirSync(папка, { recursive: true });
  fs.copyFileSync(исходный, exe);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VERSTAK_DATA_DIR;
  delete env['КУХНЯ_DEV_URL'];
  const t0 = Date.now();
  const п = spawn(exe, ['--remote-debugging-port=9371'], { env, stdio: 'ignore', cwd: папка });
  let браузер;
  for (let i = 0; i < 160 && !браузер; i++) {
    try {
      браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9371', defaultViewport: null });
    } catch {
      await пауза(250);
    }
  }
  let стр;
  for (let i = 0; i < 100 && !стр; i++) {
    стр = (await браузер.pages()).find((x) => x.url().startsWith('file://'));
    if (!стр) await пауза(200);
  }
  await стр.waitForSelector('button', { timeout: 30000 });
  console.log(`время запуска portable до окна: ${Date.now() - t0} мс`);
  await пауза(2500);
  await стр.evaluate(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
  await стр.reload();
  await пауза(2000);
  await стр.evaluate(async () => {
    const с = window.__верстакStore.getState();
    с.создать('Проект portable', { длина: 4000, ширина: 3000, высота_стен: 2700, толщина_стен: 100, форма: 'прямоугольник', обои: '#d8cdb8', пол: '#a58865', фон: '#171a1f' });
    window.__верстакStore.getState().добавитьМодуль('тумба-ящики-600', [0, 0, -1200]);
  });
  await пауза(500);
  await стр.keyboard.down('Control');
  await стр.keyboard.press('KeyS');
  await стр.keyboard.up('Control');
  await пауза(2500);
  const проекты = path.join(папка, 'Проекты');
  const файлы = fs.existsSync(проекты) ? fs.readdirSync(проекты) : [];
  проверка('Проекты\\ создана рядом с .exe', fs.existsSync(проекты), файлы.join(', '));
  проверка('файл проекта лежит рядом с .exe', файлы.some((x) => x.endsWith('.kitchen')));
  await стр.screenshot({ path: path.join(снимки, '8-portable.png') });
  await браузер.disconnect();
  spawnSync('taskkill', ['/PID', String(п.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('taskkill', ['/IM', 'Верстак-portable.exe', '/F'], { stdio: 'ignore' });
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`Итог: ${ок} из ${итоги.length}`);
  process.exit(ок === итоги.length ? 0 : 1);
})().catch((е) => {
  console.error('сбой:', е.message);
  spawnSync('taskkill', ['/IM', 'Верстак-portable.exe', '/F'], { stdio: 'ignore' });
  process.exit(1);
});
