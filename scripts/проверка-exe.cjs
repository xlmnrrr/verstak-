/**
 * Запуск СОБРАННОГО приложения (release\win-unpacked\Верстак.exe или portable) на этой машине:
 * окно открылось, 3D нарисовано на видеокарте, пример открывается, ошибок шейдера нет, данные лежат там, где ожидается.
 * Запуск: node scripts/проверка-exe.cjs <путь к exe> [папка данных]
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { puppeteer, пауза } = require('./электрон-общее.cjs');

const exe = process.argv[2];
const данные = process.argv[3];
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env['КУХНЯ_DEV_URL'];
  if (данные) env.VERSTAK_DATA_DIR = данные;
  const п = spawn(exe, ['--remote-debugging-port=9335'], { env, stdio: 'ignore' });
  let браузер;
  try {
    for (let i = 0; i < 80 && !браузер; i++) {
      try {
        браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9335', defaultViewport: null });
      } catch {
        await пауза(500);
      }
    }
    if (!браузер) throw new Error('окно собранного приложения не открылось');
    let стр;
    for (let i = 0; i < 40 && !стр; i++) {
      стр = (await браузер.pages()).find((p) => p.url().startsWith('file://'));
      if (!стр) await пауза(300);
    }
    const ошибки = [];
    стр.on('console', (м) => { if (м.type() === 'error' || м.type() === 'warning' || /Shader Error/.test(м.text())) ошибки.push(м.text().slice(0, 300)); });
    стр.on('pageerror', (e) => ошибки.push(e.message));
    if (!process.env.NO_RELOAD) await стр.reload();
    await пауза(2000);
    const заголовок = await стр.title();
    await стр.evaluate(() => {
      const э = [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'));
      if (э) э.click();
    });
    await пауза(3500);
    const р = await стр.evaluate(async () => {
      const x = window.__кухня;
      if (!x) return null;
      await x.самопроверкаГотова;
      x.gl.shadowMap.needsUpdate = true;
      x.gl.render(x.scene, x.camera);
      return { draw_calls: x.gl.info.render.calls, видеокарта: x.статистика().видеокарта, профиль: x.статистика().профиль, проблем: x.проблемы().length };
    });
    const папкаПроектов = await стр.evaluate(() => window.кухня && window.кухня.путьПроектов ? window.кухня.путьПроектов() : null);
    await стр.screenshot({ path: path.join(process.cwd(), 'проверка', 'v2', `1А2-exe-${path.basename(exe).replace(/\W+/g, '_')}.png`) });
    console.log(JSON.stringify({ заголовок, сцена: р, папкаПроектов, ошибок: ошибки.length, ошибки: ошибки.slice(0, 3) }));
    браузер.disconnect();
    process.exitCode = р && р.draw_calls > 0 && ошибки.length === 0 ? 0 : 2;
  } finally {
    п.kill();
  }
})().catch((e) => { console.error('УПАЛО:', e.message); process.exit(1); });
