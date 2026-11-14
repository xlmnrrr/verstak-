/**
 * Вступление: снимает кадры в заданные моменты (секунды от появления .интро) в окне Electron и собирает лист.
 * Запуск: node scripts/интро-кадры.cjs <адрес dev-сервера> [--моменты 1,2.5,4,...]
 * Выход: проверка/v2/Интро-лист.png и отдельные Интро-<сек>.png. Окно 1600 × 900, вступление включается параметром ?интро=1.
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const арг = process.argv.slice(2);
const АДРЕС = арг.find((а) => /^https?:\/\//.test(а)) || 'http://127.0.0.1:5274/';
const i = арг.indexOf('--моменты');
const МОМЕНТЫ = (i >= 0 ? арг[i + 1] : '0.8,2,3.2,4.6,6,7.5,9.5,11.5,13.5,15.5,17.2,18.6').split(',').map(Number);
const корень = process.cwd();
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });

(async () => {
  const данные = path.join(корень, 'проверка', 'данные-интро');
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9395, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9395);
    const к = слушатьКонсоль(стр);
    const сессия = await стр.target().createCDPSession();
    try {
      const { windowId } = await сессия.send('Browser.getWindowForTarget');
      await сессия.send('Browser.setWindowBounds', { windowId, bounds: { width: 1600, height: 960, windowState: 'normal' } });
    } catch {
      /* размер окна не главное */
    }
    await пауза(2500);
    await стр.goto(АДРЕС + '?интро=1', { waitUntil: 'domcontentloaded' });
    try {
      await стр.waitForSelector('.интро', { timeout: 15000 });
    } catch (e) {
      console.log('нет .интро; консоль:', к.все.slice(-12).join(' | '), ' URL:', стр.url());
      throw e;
    }
    const старт = Date.now();
    const файлы = [];
    for (const м of МОМЕНТЫ) {
      const ждать = м * 1000 - (Date.now() - старт);
      if (ждать > 0) await пауза(ждать);
      const факт = ((Date.now() - старт) / 1000).toFixed(1);
      console.log('интро:', JSON.stringify(await стр.evaluate(() => { const e = document.querySelector('.интро'); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { op: c.opacity, pos: c.position, z: c.zIndex, bg: c.backgroundColor, r: [r.x, r.y, r.width, r.height], cls: e.className, холст: !!e.querySelector('canvas'), стр: document.querySelectorAll('link,style').length }; })));
      const ф = path.join(снимки, `Интро-${String(м).replace('.', '_')}.png`);
      await стр.screenshot({ path: ф });
      файлы.push([м, факт, ф]);
      console.log(`кадр ${м} с (факт ${факт})`);
    }
    // собрать лист 4 × 3
    const данныеКадров = файлы.map(([м, факт, ф]) => [м, факт, fs.readFileSync(ф).toString('base64')]);
    const лист = await стр.evaluate(async (кадры) => {
      const загрузить = (b) => new Promise((ok) => { const и = new Image(); и.onload = () => ok(и); и.src = 'data:image/png;base64,' + b; });
      const ии = await Promise.all(кадры.map((к) => загрузить(к[2])));
      const w = 480;
      const h = Math.round((ии[0].height / ии[0].width) * w);
      const c = document.createElement('canvas');
      const КОЛ = 4;
      const стр = Math.ceil(ии.length / КОЛ);
      c.width = КОЛ * w + (КОЛ + 1) * 8;
      c.height = стр * (h + 26) + 8;
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, c.width, c.height);
      g.font = '600 14px Segoe UI, sans-serif';
      ии.forEach((и, k) => {
        const x = 8 + (k % КОЛ) * (w + 8);
        const y = 8 + Math.floor(k / КОЛ) * (h + 26);
        g.fillStyle = '#d9ad5f';
        g.fillText(`${кадры[k][0]} с`, x, y + 14);
        g.drawImage(и, x, y + 20, w, h);
      });
      return c.toDataURL('image/png').split(',')[1];
    }, данныеКадров);
    fs.writeFileSync(path.join(снимки, 'Интро-лист.png'), Buffer.from(лист, 'base64'));
    console.log('лист: проверка/v2/Интро-лист.png');
    if (к.шейдер.length) console.log('ОШИБКИ ШЕЙДЕРА:', к.шейдер.slice(0, 3));
    if (к.ошибки.length) console.log('ошибки консоли:', к.ошибки.slice(0, 6));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
