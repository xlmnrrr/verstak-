/**
 * Проход 1: листы «как было | как стало» для трёх эталонов из скриншотов проверка/v2/Р1-до-Э-*.png и Р1-после-Э-*.png
 * (одна камера, свет и профиль). Строки — 0,5 м, 1 м, 3 м и «открыто»; вырезается только область сцены (без панелей).
 * Выход: проверка/v2/Р1-сравнение-<эталон>.png. Запуск: node scripts/сравнение-эталонов.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('C:/Users/makar/.dsh/profiles/desktop/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const папка = path.join(process.cwd(), 'проверка', 'v2');
const ЭТАЛОНЫ = { духовка: 'Духовка встраиваемая', шкаф: 'Распашной шкаф 900', кровать: 'Кровать (до — обычная, после — с подъёмником)' };
const СТРОКИ = [['0,5м', '0,5 м'], ['1м', '1 м'], ['3м', '3 м'], ['открыт', 'открыто']];

(async () => {
  const б = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const стр = await б.newPage();
  await стр.setContent('<canvas id="c"></canvas>');
  for (const [ключ, заголовок] of Object.entries(ЭТАЛОНЫ)) {
    const пары = [];
    for (const [суф, подпись] of СТРОКИ) {
      const найти = (пр) => fs.readdirSync(папка).find((ф) => ф.startsWith(`Р1-${пр}-Э-${ключ}-${суф}`));
      const до = найти('до');
      const после = найти('после');
      if (!до || !после) continue;
      пары.push({ подпись, до: fs.readFileSync(path.join(папка, до)).toString('base64'), после: fs.readFileSync(path.join(папка, после)).toString('base64') });
    }
    const png = await стр.evaluate(
      async ({ пары, заголовок }) => {
        const загрузить = (b) => new Promise((ok) => { const и = new Image(); и.onload = () => ok(и); и.src = 'data:image/png;base64,' + b; });
        // область сцены в кадре окна 1424 × 861: слева полоса 56, сверху шапка 52, снизу строка 45
        const sx = 56, sy = 52, sw = 1368, sh = 764;
        const k = 0.5;
        const w = Math.round(sw * k), h = Math.round(sh * k), поле = 14, шапка = 54, подпись = 26;
        const c = document.getElementById('c');
        c.width = поле * 3 + w * 2;
        c.height = шапка + пары.length * (h + подпись + поле) + поле;
        const g = c.getContext('2d');
        g.fillStyle = '#1e1914';
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#f3ece1';
        g.font = '600 22px Segoe UI, sans-serif';
        g.fillText(заголовок, поле, 34);
        g.font = '500 15px Segoe UI, sans-serif';
        g.fillStyle = '#c7bba9';
        g.fillText('как было (коммит до прохода)', поле, шапка - 4);
        g.fillText('как стало (профиль «Стандарт»)', поле * 2 + w, шапка - 4);
        let y = шапка + 6;
        for (const п of пары) {
          g.fillStyle = '#d9ad5f';
          g.font = '600 15px Segoe UI, sans-serif';
          g.fillText(п.подпись, поле, y + 16);
          y += подпись;
          g.drawImage(await загрузить(п.до), sx, sy, sw, sh, поле, y, w, h);
          g.drawImage(await загрузить(п.после), sx, sy, sw, sh, поле * 2 + w, y, w, h);
          y += h + поле;
        }
        return c.toDataURL('image/png').split(',')[1];
      },
      { пары, заголовок },
    );
    const выход = path.join(папка, `Р1-сравнение-${ключ}.png`);
    fs.writeFileSync(выход, Buffer.from(png, 'base64'));
    console.log(выход, Math.round(fs.statSync(выход).size / 1024), 'КБ, строк', пары.length);
  }
  await б.close();
})();
