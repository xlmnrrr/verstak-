/**
 * Этап 2, п. 6: деинсталлятор nsis не удаляет «Проекты\» и «Бэкапы\».
 * На собранном установщике: поставить в C:\VerstakTest → запустить, создать и сохранить проект → скриншот «до» →
 * удалить программу → проверить, что проект и бэкап живы, а программа убрана → поставить заново → скриншот «после».
 * Запуск: node scripts/проверка-удаления.cjs [путь к установщику]
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { puppeteer, пауза } = require('./электрон-общее.cjs');

const корень = process.cwd();
const установщик = process.argv[2] || path.join(корень, 'release', 'Верстак-0.1.0-установщик.exe');
const папка = 'C:\\VerstakTest';
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};
const список = (p) => (fs.existsSync(p) ? fs.readdirSync(p).sort() : null);

async function ждать(условие, мс = 60000) {
  const t = Date.now();
  while (Date.now() - t < мс) {
    if (условие()) return true;
    await пауза(500);
  }
  return false;
}

async function поставить() {
  const р = spawnSync(установщик, ['/S', `/D=${папка}`], { stdio: 'ignore' });
  const ок = await ждать(() => fs.existsSync(path.join(папка, 'Верстак.exe')), 90000);
  return ок && (р.status === 0 || р.status === null);
}

async function запустить(порт) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VERSTAK_DATA_DIR;
  delete env['КУХНЯ_DEV_URL'];
  const п = spawn(path.join(папка, 'Верстак.exe'), [`--remote-debugging-port=${порт}`], { env, stdio: 'ignore' });
  let браузер;
  for (let i = 0; i < 80 && !браузер; i++) {
    try {
      браузер = await puppeteer.connect({ browserURL: `http://127.0.0.1:${порт}`, defaultViewport: null });
    } catch {
      await пауза(500);
    }
  }
  if (!браузер) throw new Error('окно собранного приложения не открылось');
  let стр;
  for (let i = 0; i < 40 && !стр; i++) {
    стр = (await браузер.pages()).find((x) => x.url().startsWith('file://'));
    if (!стр) await пауза(300);
  }
  return { процесс: п, браузер, стр };
}

function закрыть(п) {
  spawnSync('taskkill', ['/PID', String(п.pid), '/T', '/F'], { stdio: 'ignore' });
}

(async () => {
  fs.rmSync(папка, { recursive: true, force: true });
  проверка('установщик на месте', fs.existsSync(установщик), установщик);
  let ок = await поставить();
  проверка('установка в тихом режиме', ок, JSON.stringify(список(папка)));
  if (!ок) return финиш();

  // 1. запуск, проект, бэкап
  let { процесс, браузер, стр } = await запустить(9351);
  await пауза(2500);
  await стр.evaluate(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
  await стр.reload();
  await пауза(2000);
  const имя = 'Проверка удаления';
  await стр.evaluate(async (н) => {
    const с = window.__верстакStore.getState();
    с.создать(н, { длина: 4000, ширина: 3000, высота_стен: 2700, толщина_стен: 100, форма: 'прямоугольник', обои: '#d8cdb8', пол: '#a58865', фон: '#171a1f' });
    await new Promise((r) => setTimeout(r, 800));
    window.__верстакStore.getState().добавитьМодуль('тумба-ящики-600');
    window.__верстакStore.getState().добавитьМодуль('холодильник-600');
    await window.__верстакStore.getState().сохранить();
  }, имя);
  await пауза(1500);
  await стр.evaluate(() => window.__верстакStore.getState().наЭкран('проекты'));
  await пауза(1500);
  await стр.screenshot({ path: path.join(снимки, '2-удаление-до.png') });
  const проекты = path.join(папка, 'Проекты');
  const до = список(проекты) ?? [];
  const файл = до.find((x) => x.endsWith('.kitchen'));
  проверка('проект сохранён рядом с программой (Проекты\\ в каталоге установки)', !!файл, JSON.stringify(до));
  // бэкап: кладём копию в Бэкапы\ (папка создаётся приложением при записи/бэкапе)
  fs.mkdirSync(path.join(папка, 'Бэкапы'), { recursive: true });
  if (файл) fs.copyFileSync(path.join(проекты, файл), path.join(папка, 'Бэкапы', 'бэкап-проверки.kitchen'));
  const до_состав = список(папка);
  console.log('до удаления, каталог установки:', JSON.stringify(до_состав));
  const содержимоеДо = файл ? fs.readFileSync(path.join(проекты, файл), 'utf8') : '';
  await браузер.disconnect();
  закрыть(процесс);
  await пауза(2500);

  // 2. удаление
  const деинсталлятор = path.join(папка, 'Uninstall Верстак.exe');
  проверка('деинсталлятор установлен', fs.existsSync(деинсталлятор));
  spawnSync(деинсталлятор, ['/S'], { stdio: 'ignore' });
  const убрано = await ждать(() => !fs.existsSync(path.join(папка, 'Верстак.exe')), 90000);
  await пауза(2500);
  const после = список(папка);
  console.log('после удаления, каталог установки:', JSON.stringify(после));
  проверка('программа удалена (Верстак.exe, ресурсы)', убрано && !(после ?? []).includes('Верстак.exe') && !(после ?? []).includes('resources'), JSON.stringify(после));
  проверка('папка Проекты\\ осталась', (после ?? []).includes('Проекты'));
  проверка('папка Бэкапы\\ осталась', (после ?? []).includes('Бэкапы'));
  const проектПосле = файл && fs.existsSync(path.join(проекты, файл)) ? fs.readFileSync(path.join(проекты, файл), 'utf8') : '';
  проверка('файл проекта цел побайтно', !!проектПосле && проектПосле === содержимоеДо, `${проектПосле.length} байт`);
  проверка('бэкап цел', fs.existsSync(path.join(папка, 'Бэкапы', 'бэкап-проверки.kitchen')));
  проверка('больше в каталоге установки ничего нет', (после ?? []).every((x) => x === 'Проекты' || x === 'Бэкапы'), JSON.stringify(после));

  // 3. установка заново: проект на месте
  ок = await поставить();
  проверка('повторная установка поверх данных', ок, JSON.stringify(список(папка)));
  if (ок) {
    ({ процесс, браузер, стр } = await запустить(9352));
    await пауза(2500);
    await стр.evaluate(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2000);
    await стр.evaluate(() => window.__верстакStore.getState().наЭкран('проекты'));
    await пауза(2000);
    await стр.screenshot({ path: path.join(снимки, '2-удаление-после.png') });
    const видно = await стр.evaluate((н) => document.body.innerText.includes(н), имя);
    проверка('после переустановки проект виден в списке', видно);
    // обновление без удаления: ещё одна установка поверх (сценарий «обновил программу»)
    await браузер.disconnect();
    закрыть(процесс);
    await пауза(2000);
    ок = await поставить();
    проверка('установка поверх (обновление) не трогает данные', ок && fs.existsSync(path.join(проекты, файл)) && fs.existsSync(path.join(папка, 'Бэкапы', 'бэкап-проверки.kitchen')));
  }
  // уборка тестового каталога (создан этим сценарием)
  spawnSync(path.join(папка, 'Uninstall Верстак.exe'), ['/S'], { stdio: 'ignore' });
  await ждать(() => !fs.existsSync(path.join(папка, 'Верстак.exe')), 60000);
  await пауза(2000);
  fs.rmSync(папка, { recursive: true, force: true });
  финиш();

  function финиш() {
    const н = итоги.filter((x) => !x.ок);
    console.log(`\nИтого: ${итоги.length - н.length} из ${итоги.length}`);
    fs.writeFileSync(path.join(снимки, '2-удаление-итоги.json'), JSON.stringify(итоги, null, 1));
    process.exitCode = н.length ? 2 : 0;
  }
})().catch((е) => {
  console.log('СБОЙ', е && е.stack ? е.stack : е);
  process.exitCode = 3;
});
