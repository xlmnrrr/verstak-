/**
 * Этап 8, п. 2: собранный .exe, поставленный в C:\VerstakTest: запуск, заголовок и имя процесса, второй запуск, память окна,
 * время до главного окна, скриншоты окна и панели задач. Установку делает вызывающий (установщик /S /D=C:\VerstakTest).
 * Запуск: node scripts/проверка-8-exe.cjs
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { puppeteer, пауза } = require('./электрон-общее.cjs');

const exe = 'C:\\VerstakTest\\Верстак.exe';
const снимки = path.join(process.cwd(), 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};
const чистаяСреда = () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VERSTAK_DATA_DIR;
  delete env['КУХНЯ_DEV_URL'];
  return env;
};
const главные = () => {
  const р = spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='Верстак.exe'\" | Where-Object { $_.CommandLine -notmatch '--type=' } | Select-Object -ExpandProperty ProcessId"], { encoding: 'utf8' });
  return (р.stdout || '').split(/\s+/).filter(Boolean).map(Number);
};
const снимокЭкрана = (файл) =>
  spawnSync('powershell', ['-NoProfile', '-Command', `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${файл}'); $g.Dispose(); $bmp.Dispose()`], { encoding: 'utf8' });

async function запустить(порт) {
  const t0 = Date.now();
  const п = spawn(exe, [`--remote-debugging-port=${порт}`], { env: чистаяСреда(), stdio: 'ignore' });
  let браузер;
  for (let i = 0; i < 120 && !браузер; i++) {
    try {
      браузер = await puppeteer.connect({ browserURL: `http://127.0.0.1:${порт}`, defaultViewport: null });
    } catch {
      await пауза(250);
    }
  }
  if (!браузер) throw new Error('окно не открылось');
  let стр;
  for (let i = 0; i < 100 && !стр; i++) {
    стр = (await браузер.pages()).find((x) => x.url().startsWith('file://'));
    if (!стр) await пауза(200);
  }
  await стр.waitForSelector('.действие, .редактор, button', { timeout: 30000 });
  return { п, браузер, стр, мс: Date.now() - t0 };
}
const мягкоЗакрыть = async (п) => {
  spawnSync('taskkill', ['/PID', String(п.pid), '/T'], { stdio: 'ignore' });
  await пауза(2500);
  spawnSync('taskkill', ['/PID', String(п.pid), '/T', '/F'], { stdio: 'ignore' });
};

(async () => {
  проверка('Верстак.exe установлен', fs.existsSync(exe));
  // 1. запуск, заголовок, имя процесса, время
  const времена = [];
  let { п, браузер, стр, мс } = await запустить(9361);
  времена.push(мс);
  await пауза(2500);
  const заголовок = await стр.title();
  проверка('заголовок окна «Верстак»', /Верстак/.test(заголовок), заголовок);
  проверка('имя процесса «Верстак.exe»', главные().length === 1, `главных процессов: ${главные().length}`);
  const ошибкиНет = await стр.evaluate(() => !document.body.innerText.includes('Не удалось запустить 3D'));
  проверка('главное окно загрузилось, 3D не упал', ошибкиНет);
  await стр.screenshot({ path: path.join(снимки, '8-exe-запуск.png') });

  // 2. второй запуск поднимает уже открытое окно и не плодит процессы
  const второй = spawn(exe, [], { env: чистаяСреда(), stdio: 'ignore' });
  await пауза(4000);
  const живВторой = spawnSync('tasklist', ['/FI', `PID eq ${второй.pid}`, '/NH'], { encoding: 'utf8' }).stdout.includes(String(второй.pid));
  проверка('второй запуск завершается, главный процесс один', !живВторой && главные().length === 1, `второй жив: ${живВторой}, главных: ${главные().length}`);

  // 3. снимок экрана: окно и панель задач
  await стр.evaluate(() => { window.moveTo(160, 90); window.resizeTo(1180, 740); });
  await пауза(1500);
  const границы = (с) => с.evaluate(() => ({ left: window.screenX, top: window.screenY, width: window.outerWidth, height: window.outerHeight }));
  const до = await границы(стр);
  await браузер.disconnect();
  await мягкоЗакрыть(п);
  проверка('после закрытия процессов не осталось', главные().length === 0, `осталось: ${главные().length}`);

  // 4. память окна: размер и положение
  const r2 = await запустить(9362);
  времена.push(r2.мс);
  await пауза(2000);
  const после = await границы(r2.стр);
  проверка('окно помнит размер и положение', Math.abs(после.width - до.width) <= 20 && Math.abs(после.height - до.height) <= 20 && Math.abs(после.left - до.left) <= 20 && Math.abs(после.top - до.top) <= 20, `было ${JSON.stringify([до.left, до.top, до.width, до.height])}, стало ${JSON.stringify([после.left, после.top, после.width, после.height])}`);
  await r2.браузер.disconnect();
  await мягкоЗакрыть(r2.п);
  // 5. ещё один холодный запуск для времени
  const r3 = await запустить(9363);
  времена.push(r3.мс);
  await r3.браузер.disconnect();
  await мягкоЗакрыть(r3.п);
  console.log(`время запуска до главного окна, мс: ${времена.join(', ')}`);
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`\nИтог: ${ок} из ${итоги.length}`);
  process.exit(ок === итоги.length ? 0 : 1);
})().catch((е) => {
  console.error('сбой:', е.message);
  spawnSync('taskkill', ['/IM', 'Верстак.exe', '/F'], { stdio: 'ignore' });
  process.exit(1);
});
