/**
 * Проход 2: из кадров Р2-до-*.png, Р2-после-*.png, Р2-фото-*.png собирает листы «как было | как стало | Фото» по сценам
 * (одна камера, свет и состав; «до» — коммит 7b1a1ac) и общий лист «Фото» (все шесть комнат одной картинкой).
 * Запуск: node scripts/сравнение-р2.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('C:/Users/makar/.dsh/profiles/desktop/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const папка = path.join(process.cwd(), 'проверка', 'v2');
const СЦЕНЫ = ['кухня', 'шкаф-купе', 'спальня', 'гостиная', 'прихожая', 'ванная'];

(async () => {
  const б = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const стр = await б.newPage();
  await стр.setContent('<canvas id="c"></canvas>');
  const чит = (ф) => (fs.existsSync(path.join(папка, ф)) ? fs.readFileSync(path.join(папка, ф)).toString('base64') : null);
  for (const сц of СЦЕНЫ) {
    const кадры = [['как было', чит(`Р2-до-${сц}.png`)], ['как стало («Стандарт»)', чит(`Р2-после-${сц}.png`)], ['«Фото»', чит(`Р2-фото-${сц}.png`)]].filter((x) => x[1]);
    const png = await стр.evaluate(async (кадры, сц) => {
      const загрузить = (b) => new Promise((ok) => { const и = new Image(); и.onload = () => ok(и); и.src = 'data:image/png;base64,' + b; });
      const ии = await Promise.all(кадры.map((к) => загрузить(к[1])));
      const w = 680;
      const h = Math.round((ии[0].height / ии[0].width) * w);
      const c = document.getElementById('c');
      c.width = w * ии.length + 12 * (ии.length + 1);
      c.height = h + 70;
      const g = c.getContext('2d');
      g.fillStyle = '#1e1914';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#f3ece1';
      g.font = '600 22px Segoe UI, sans-serif';
      g.fillText(сц, 12, 30);
      g.font = '500 15px Segoe UI, sans-serif';
      g.fillStyle = '#c7bba9';
      ии.forEach((и, i) => {
        g.fillText(кадры[i][0], 12 + i * (w + 12), 56);
        g.drawImage(и, 12 + i * (w + 12), 66, w, h);
      });
      return c.toDataURL('image/png').split(',')[1];
    }, кадры, сц);
    fs.writeFileSync(path.join(папка, `Р2-сравнение-${сц}.png`), Buffer.from(png, 'base64'));
    console.log('Р2-сравнение-' + сц);
  }
  // общий лист «Фото»: шесть комнат
  const фото = СЦЕНЫ.map((с) => [с, чит(`Р2-фото-${с}.png`)]).filter((x) => x[1]);
  const png = await стр.evaluate(async (фото) => {
    const загрузить = (b) => new Promise((ok) => { const и = new Image(); и.onload = () => ok(и); и.src = 'data:image/png;base64,' + b; });
    const ии = await Promise.all(фото.map((к) => загрузить(к[1])));
    const w = 640;
    const h = Math.round((ии[0].height / ии[0].width) * w);
    const c = document.getElementById('c');
    c.width = w * 3 + 40;
    c.height = (h + 34) * 2 + 20;
    const g = c.getContext('2d');
    g.fillStyle = '#1e1914';
    g.fillRect(0, 0, c.width, c.height);
    g.font = '600 18px Segoe UI, sans-serif';
    ии.forEach((и, i) => {
      const x = 10 + (i % 3) * (w + 10);
      const y = 10 + Math.floor(i / 3) * (h + 34);
      g.fillStyle = '#f3ece1';
      g.fillText(фото[i][0] + ' — профиль «Фото»', x, y + 20);
      g.drawImage(и, x, y + 28, w, h);
    });
    return c.toDataURL('image/png').split(',')[1];
  }, фото);
  fs.writeFileSync(path.join(папка, 'Р2-фото-квартира-лист.png'), Buffer.from(png, 'base64'));
  console.log('Р2-фото-квартира-лист');
  await б.close();
})();
