/** Вступление в собранной программе (C:\VerstakTest\Верстак.exe): несколько кадров, ошибки консоли. node scripts/интро-exe.cjs */
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { puppeteer, пауза } = require('./электрон-общее.cjs');

(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VERSTAK_DATA_DIR;
  const п = spawn('C:\\VerstakTest\\Верстак.exe', ['--remote-debugging-port=9399'], { env, stdio: 'ignore' });
  try {
    let браузер;
    for (let i = 0; i < 60 && !браузер; i++) {
      try {
        браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9399', defaultViewport: null });
      } catch {
        await пауза(500);
      }
    }
    const стр = (await браузер.pages())[0];
    const ошибки = [];
    стр.on('console', (м) => {
      if (м.type() === 'error') ошибки.push(м.text().slice(0, 300));
    });
    стр.on('pageerror', (e) => ошибки.push('pageerror: ' + e.message));
    await пауза(2500);
    const url = стр.url().split('?')[0] + '?интро=1';
    await стр.goto(url, { waitUntil: 'domcontentloaded' });
    await стр.waitForSelector('.интро', { timeout: 20000 });
    const папка = path.join(process.cwd(), 'проверка', 'v2');
    for (const сек of [1.5, 6.5, 11, 16]) {
      await пауза(сек === 1.5 ? 1500 : сек === 6.5 ? 5000 : сек === 11 ? 4500 : 5000);
      const ф = path.join(папка, `Интро-exe-${сек}.png`);
      await стр.screenshot({ path: ф });
      console.log('кадр', сек, fs.statSync(ф).size);
    }
    await пауза(4000);
    const осталось = await стр.evaluate(() => !!document.querySelector('.интро'));
    console.log('вступление закончилось само:', !осталось);
    console.log('ошибки консоли:', ошибки.length ? ошибки.slice(0, 5) : 'нет');
    браузер.disconnect();
  } finally {
    spawnSync('taskkill', ['/PID', String(п.pid), '/T', '/F'], { stdio: 'ignore' });
  }
})();
