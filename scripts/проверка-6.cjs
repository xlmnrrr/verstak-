/**
 * Проверка этапа 6: все четыре файла выгружаются и открываются, деталировка сходится, XLSX разбирается как zip + XML.
 * Запуск: node scripts/проверка-6.cjs http://127.0.0.1:5274/ ; файлы — проверка\выгрузка\
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза, puppeteer } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-6');
const выгрузка = path.join(корень, 'проверка', 'выгрузка');
const снимки = path.join(корень, 'проверка', 'v2');
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.rmSync(выгрузка, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, доп: { VERSTAK_AUTOSAVE_SEC: '3600', VERSTAK_EXPORT_DIR: выгрузка } });
  let ожидаемоДеталей = 0;
  try {
    const { браузер, стр } = await подключиться(АДРЕС);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true, заказ: '2026-0142', клиент: 'Иванов И. И.', дизайнер: 'Макар' })));
    await стр.reload();
    await пауза(2000);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3000);
    ожидаемоДеталей = await S(async () => {
      const м = await import('/src/model/производство.ts');
      return м.деталировка(window.__верстакStore.getState().проект2).length;
    });
    for (const ф of ['csv', 'xlsx', 'gltf', 'pdf']) {
      const t0 = Date.now();
      const ок = await S((формат) => window.__верстакВыгрузка(формат), ф);
      console.log(`   выгрузка ${ф}: ${ок ? 'готово' : 'не вышло'} за ${Date.now() - t0} мс`);
    }
    await стр.screenshot({ path: path.join(снимки, '6-после-выгрузки.png') });
    проверка('в консоли нет ошибок и Shader Error', к.шейдер.length === 0 && к.ошибки.length === 0, (к.ошибки[0] ?? '').slice(0, 200));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
  const имя = 'Пример_ кухня из шаблонов';
  const файл = (р) => path.join(выгрузка, имя.replace(/:/g, '_') + '.' + р);
  const есть = fs.existsSync(выгрузка) ? fs.readdirSync(выгрузка) : [];
  console.log('   файлы:', есть.join(', '));
  const найти = (р) => есть.find((x) => x.endsWith('.' + р));
  /* CSV */
  const csvИмя = найти('csv');
  const csv = csvИмя ? fs.readFileSync(path.join(выгрузка, csvИмя), 'utf8') : '';
  const строк = csv.split('\r\n').filter(Boolean).length - 1;
  проверка('CSV: строк деталей равно деталировке модели', строк === ожидаемоДеталей && csv.startsWith('\ufeff'), `${строк} из ${ожидаемоДеталей}, байт ${csv.length}`);
  /* XLSX: zip + XML */
  const xlsxИмя = найти('xlsx');
  let xl = '';
  if (xlsxИмя) {
    const код = `
import zipfile, sys, xml.dom.minidom as m
z = zipfile.ZipFile(sys.argv[1]); out=[]
assert z.testzip() is None
for n in z.namelist():
    if n.endswith('.xml') or n.endswith('.rels'): m.parseString(z.read(n))
for i in (1,2,3):
    d = m.parseString(z.read('xl/worksheets/sheet%d.xml' % i)); out.append(len(d.getElementsByTagName('row')))
print(','.join(map(str,out)), len(z.namelist()))`;
    try {
      xl = execFileSync('python', ['-c', код, path.join(выгрузка, xlsxИмя)], { encoding: 'utf8' }).trim();
    } catch (e) {
      xl = 'ОШИБКА ' + (e.stderr || e.message).toString().slice(0, 200);
    }
  }
  const [строкиЛистов] = xl.split(' ');
  const ряды = (строкиЛистов || '').split(',').map(Number);
  проверка('XLSX: zip целый, все XML разбираются, три листа, деталировка совпадает', ряды[0] === ожидаемоДеталей + 1 && ряды.length === 3, xl);
  /* GLB */
  const glbИмя = найти('glb');
  let glbИнфо = '';
  let glbОк = false;
  if (glbИмя) {
    const б = fs.readFileSync(path.join(выгрузка, glbИмя));
    const длинаJson = б.readUInt32LE(12);
    const json = JSON.parse(б.slice(20, 20 + длинаJson).toString('utf8'));
    glbОк = б.slice(0, 4).toString() === 'glTF' && json.asset.version === '2.0' && json.nodes.length > 100 && json.meshes.length > 10;
    glbИнфо = `байт ${б.length}, узлов ${json.nodes.length}, мешей ${json.meshes.length}, материалов ${json.materials?.length}`;
  }
  проверка('glTF (.glb): заголовок, версия 2.0, узлы и меши', glbОк, glbИнфо);
  /* PDF */
  const pdfИмя = найти('pdf');
  let pdfИнфо = '';
  let pdfОк = false;
  if (pdfИмя) {
    const б = fs.readFileSync(path.join(выгрузка, pdfИмя));
    const текст = б.toString('latin1');
    const страниц = (текст.match(/\/Type\s*\/Page[^s]/g) || []).length;
    pdfОк = текст.startsWith('%PDF-') && страниц >= 4;
    pdfИнфо = `байт ${б.length}, страниц ${страниц}`;
  }
  проверка('PDF: открывается как документ, не меньше 4 страниц (план, спецификация, расход, деталировка)', pdfОк, pdfИнфо);
  /* страница чертежа в картинку */
  const html = найти('html');
  if (html) {
    const бр = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
    const п = await бр.newPage();
    await п.setViewport({ width: 1123, height: 794 });
    await п.goto('file:///' + path.join(выгрузка, html).replace(/\\/g, '/'));
    await пауза(500);
    await п.screenshot({ path: path.join(снимки, '6-чертёж-лист-1.png') });
    await бр.close();
  }
  fs.writeFileSync(path.join(корень, 'проверка', 'проверка-6.json'), JSON.stringify(итоги, null, 2), 'utf8');
  const упало = итоги.filter((x) => !x.ок);
  console.log(`Итого: ${итоги.length - упало.length} из ${итоги.length}`);
  process.exitCode = упало.length ? 2 : 0;
})().catch((e) => {
  console.error('УПАЛО:', e.stack || e.message);
  process.exit(1);
});
