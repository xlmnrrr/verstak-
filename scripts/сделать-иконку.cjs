/**
 * Иконка приложения: build/знак.svg → PNG 16…256 → build/icon.ico (PNG внутри ICO) + build/icon.png (256) + electron/иконка.png.
 * Рендер — через Chrome (puppeteer-core), без внешних утилит. Запуск: node scripts/сделать-иконку.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const РАЗМЕРЫ = [16, 24, 32, 48, 64, 128, 256];

(async () => {
  const svg = fs.readFileSync(path.join('build', 'знак.svg'), 'utf8');
  const браузер = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const стр = await браузер.newPage();
  const png = {};
  for (const р of РАЗМЕРЫ) {
    await стр.setViewport({ width: р, height: р, deviceScaleFactor: 1 });
    await стр.setContent(`<body style="margin:0;background:transparent"><img style="width:${р}px;height:${р}px;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
    await стр.evaluate(() => document.querySelector('img').decode());
    png[р] = await стр.screenshot({ omitBackground: true, type: 'png', clip: { x: 0, y: 0, width: р, height: р } });
  }
  await браузер.close();
  // ICO: ICONDIR + записи + PNG-данные
  const заг = Buffer.alloc(6);
  заг.writeUInt16LE(0, 0);
  заг.writeUInt16LE(1, 2);
  заг.writeUInt16LE(РАЗМЕРЫ.length, 4);
  const записи = [];
  let смещение = 6 + 16 * РАЗМЕРЫ.length;
  for (const р of РАЗМЕРЫ) {
    const e = Buffer.alloc(16);
    e.writeUInt8(р === 256 ? 0 : р, 0);
    e.writeUInt8(р === 256 ? 0 : р, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png[р].length, 8);
    e.writeUInt32LE(смещение, 12);
    смещение += png[р].length;
    записи.push(e);
  }
  fs.writeFileSync(path.join('build', 'icon.ico'), Buffer.concat([заг, ...записи, ...РАЗМЕРЫ.map((р) => png[р])]));
  fs.writeFileSync(path.join('build', 'icon.png'), png[256]);
  fs.mkdirSync('electron', { recursive: true });
  fs.writeFileSync(path.join('electron', 'иконка.png'), png[256]);
  fs.copyFileSync(path.join('build', 'icon.ico'), path.join('electron', 'иконка.ico'));
  fs.mkdirSync(path.join('проверка', 'v2'), { recursive: true });
  fs.writeFileSync(path.join('проверка', 'v2', '1Б1-иконка-16.png'), png[16]);
  fs.writeFileSync(path.join('проверка', 'v2', '1Б1-иконка-256.png'), png[256]);
  console.log('ICO размеры:', РАЗМЕРЫ.join(', '), '| байт:', fs.statSync(path.join('build', 'icon.ico')).size);
})();
