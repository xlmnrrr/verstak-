/**
 * Время запуска: от старта процесса Electron (собранный dist/) до готового главного экрана.
 * Запуск: npm run build, затем node scripts/замер-запуска.cjs [повторов=3]
 * «Готово» = в окне есть видимый элемент [data-готово] или карточка меню `.карточка` (v1).
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const puppeteer = require('C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core');

const ПОВТОРОВ = Number(process.argv[2] || 3);
const ПОРТ = 9333;
const пауза = (мс) => new Promise((r) => setTimeout(r, мс));
const корень = path.join(__dirname, '..');
const electron = path.join(корень, 'node_modules', 'electron', 'dist', 'electron.exe');

async function одинЗапуск() {
  const окружение = { ...process.env };
  delete окружение.ELECTRON_RUN_AS_NODE;
  delete окружение.КУХНЯ_DEV_URL;
  const t0 = Date.now();
  const п = spawn(electron, ['.', `--remote-debugging-port=${ПОРТ}`], { cwd: корень, env: окружение, stdio: 'ignore' });
  let браузер;
  for (let i = 0; i < 200 && !браузер; i++) {
    try {
      браузер = await puppeteer.connect({ browserURL: `http://127.0.0.1:${ПОРТ}`, defaultViewport: null });
    } catch {
      await пауза(25);
    }
  }
  if (!браузер) throw new Error('Electron не открыл порт отладки');
  let стр;
  while (!стр) {
    стр = (await браузер.pages()).find((p) => p.url().startsWith('file:'));
    if (!стр) await пауза(20);
  }
  let готово = 0;
  for (let i = 0; i < 1000 && !готово; i++) {
    const есть = await стр.evaluate(() => !!document.querySelector('[data-готово], .карточка')).catch(() => false);
    if (есть) готово = Date.now() - t0;
    else await пауза(10);
  }
  браузер.disconnect();
  п.kill();
  await пауза(800);
  return готово;
}

(async () => {
  const времена = [];
  for (let i = 0; i < ПОВТОРОВ; i++) времена.push(await одинЗапуск());
  console.log(JSON.stringify({ где: 'Electron, собранный dist/, холодный и тёплые запуски', мс: времена }, null, 2));
})().catch((e) => {
  console.error('ЗАМЕР ЗАПУСКА УПАЛ:', e.message);
  process.exit(1);
});
