/**
 * Материалы 2.0: фотосканы CC0 с ambientCG (лицензия CC0 1.0, без атрибуции) → вшитые WebP.
 *   albedo + шероховатость: public/Библиотека/текстуры/<имя>.webp, 1024×1024, RGB — цвет, альфа = 0,4 + 0,6 × шероховатость
 *     (так цвет не теряет точность на низкой альфе; загрузчик возвращает шероховатость обратно);
 *   normal-карта OpenGL: public/Библиотека/текстуры/<имя>.нормаль.webp, 512×512.
 * Процедурные текстуры лежат в текстуры/запасные/ и подставляются, если файла нет.
 * Исходники качаются во временную папку (кэш), в проект идут только готовые WebP. Запуск: node scripts/текстуры-cc0.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const puppeteer = require('C:/Users/makar/.dsh/profiles/desktop/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** имя в «Верстаке» → id на ambientCG */
const НАБОР = {
  'мрамор-каррара': 'Marble005',
  'мрамор-калакатта': 'Marble012',
  гранит: 'Granite002A',
  кварц: 'Marble025',
  плитка: 'Tiles107',
  дуб: 'Wood049',
  орех: 'Wood027',
  шпон: 'Wood058',
  'лдсп-дерево': 'Wood021',
  текстиль: 'Fabric030',
  'металл-шлифованный': 'Metal009',
  // добавка B: стены и пол
  штукатурка: 'Plaster002',
  бетон: 'Concrete042A',
  паркет: 'WoodFloor051',
  'паркет-корзина': 'WoodFloor070',
  'обои-под-покраску': 'Wallpaper001A',
};
/** Поправка яркости albedo (скан шлифованной стали тёмный: при металличности 0,95 цвет отражения берётся из него) */
const УСИЛЕНИЕ = { 'металл-шлифованный': 1.9 };
const КЭШ = path.join(os.tmpdir(), 'верстак-ambientcg');
const ВЫХОД = path.join(process.cwd(), 'public', 'Библиотека', 'текстуры');

async function скачать(ид) {
  const папка = path.join(КЭШ, ид);
  const цвет = path.join(папка, `${ид}_1K-JPG_Color.jpg`);
  if (fs.existsSync(цвет)) return папка;
  fs.mkdirSync(папка, { recursive: true });
  const архив = path.join(КЭШ, `${ид}.zip`);
  const ответ = await fetch(`https://ambientcg.com/get?file=${ид}_1K-JPG.zip`, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!ответ.ok) throw new Error(`${ид}: HTTP ${ответ.status}`);
  const данные = Buffer.from(await ответ.arrayBuffer());
  if (данные.slice(0, 2).toString('latin1') !== 'PK') throw new Error(`${ид}: это не zip`);
  fs.writeFileSync(архив, данные);
  const р = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${архив}' -DestinationPath '${папка}' -Force`], { encoding: 'utf8' });
  if (р.status !== 0) throw new Error(`${ид}: не распаковался: ${р.stderr}`);
  if (!fs.existsSync(цвет)) throw new Error(`${ид}: нет Color.jpg в архиве`);
  return папка;
}

(async () => {
  fs.mkdirSync(КЭШ, { recursive: true });
  const папки = {};
  for (const [имя, ид] of Object.entries(НАБОР)) {
    папки[имя] = await скачать(ид);
    console.log('скачано', ид);
  }
  const браузер = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const стр = await браузер.newPage();
  await стр.setContent('<canvas id="c"></canvas>');
  const сводка = [];
  for (const [имя, ид] of Object.entries(НАБОР)) {
    const п = папки[имя];
    const b64 = (суффикс) => {
      const ф = path.join(п, `${ид}_1K-JPG_${суффикс}.jpg`);
      return fs.existsSync(ф) ? fs.readFileSync(ф).toString('base64') : null;
    };
    const цвет = b64('Color');
    const шер = b64('Roughness');
    const нормаль = b64('NormalGL');
    const результат = await стр.evaluate(
      async ({ цвет, шер, нормаль, усиление }) => {
        const загрузить = (b) =>
          new Promise((ok, нет) => {
            const и = new Image();
            и.onload = () => ok(и);
            и.onerror = () => нет(new Error('картинка не читается'));
            и.src = 'data:image/jpeg;base64,' + b;
          });
        const пиксели = (и, N) => {
          const c = document.createElement('canvas');
          c.width = c.height = N;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(и, 0, 0, N, N);
          return g.getImageData(0, 0, N, N);
        };
        const вWebp = (данные, N, качество) =>
          new Promise((ok) => {
            const c = document.createElement('canvas');
            c.width = c.height = N;
            c.getContext('2d').putImageData(данные, 0, 0);
            c.toBlob(
              (б) => {
                const чт = new FileReader();
                чт.onload = () => ok(чт.result.split(',')[1]);
                чт.readAsDataURL(б);
              },
              'image/webp',
              качество,
            );
          });
        const N = 1024;
        const ц = пиксели(await загрузить(цвет), N);
        if (усиление !== 1) for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) ц.data[i * 4 + c] = Math.min(255, Math.round(ц.data[i * 4 + c] * усиление));
        if (шер) {
          const ш = пиксели(await загрузить(шер), N);
          for (let i = 0; i < N * N; i++) ц.data[i * 4 + 3] = Math.round(255 * (0.4 + 0.6 * (ш.data[i * 4] / 255)));
        } else {
          for (let i = 0; i < N * N; i++) ц.data[i * 4 + 3] = Math.round(255 * 0.7);
        }
        const вых = { альбедо: await вWebp(ц, N, 0.9) };
        if (нормаль) {
          const н = пиксели(await загрузить(нормаль), 512);
          for (let i = 0; i < 512 * 512; i++) н.data[i * 4 + 3] = 255;
          вых.нормаль = await вWebp(н, 512, 0.9);
        }
        return вых;
      },
      { цвет, шер, нормаль, усиление: УСИЛЕНИЕ[имя] ?? 1 },
    );
    const ф1 = path.join(ВЫХОД, `${имя}.webp`);
    fs.writeFileSync(ф1, Buffer.from(результат.альбедо, 'base64'));
    let размерН = 0;
    if (результат.нормаль) {
      const ф2 = path.join(ВЫХОД, `${имя}.нормаль.webp`);
      fs.writeFileSync(ф2, Buffer.from(результат.нормаль, 'base64'));
      размерН = fs.statSync(ф2).size;
    }
    сводка.push({ имя, ид, альбедоКБ: Math.round(fs.statSync(ф1).size / 1024), нормальКБ: Math.round(размерН / 1024), шероховатость: !!шер });
    console.log('готово', имя, ид, сводка[сводка.length - 1].альбедоКБ + ' КБ', сводка[сводка.length - 1].нормальКБ + ' КБ');
  }
  await браузер.close();
  const всего = сводка.reduce((s, x) => s + x.альбедоКБ + x.нормальКБ, 0);
  console.log(`Итого: ${сводка.length} материалов, ${(всего / 1024).toFixed(2)} МБ`);
})().catch((е) => {
  console.error('СБОЙ:', е.message);
  process.exit(1);
});
