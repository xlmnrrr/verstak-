/**
 * Проход 1: замер §4б по профилям качества в настоящем окне Electron (GTX 1650): 200 модулей состава «интерфейс»,
 * тени каждый кадр, окно 1920 × 1080. Профили: «Стандарт» (норма ≥ 60 fps и ≥ 30 fps при ЗАМЕР_CPU=4), «Быстро», «Фото» (без нормы).
 * Запуск: node scripts/замер-профилей.cjs http://127.0.0.1:5274/   (кириллические переменные задаются здесь, из node)
 * Итог — проверка/замер-профилей.json и таблица в консоли.
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');

const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const electronExe = require(path.join(корень, 'node_modules', 'electron'));
const пауза = (мс) => new Promise((r) => setTimeout(r, мс));

const ПРОГОНЫ = [
  { имя: 'Стандарт', качество: 'standard', cpu: 1 },
  { имя: 'Стандарт, CPU×4', качество: 'standard', cpu: 4 },
  { имя: 'Быстро', качество: 'fast', cpu: 1 },
  { имя: 'Фото', качество: 'photo', cpu: 1 },
];

(async () => {
  const итог = [];
  for (const п of ПРОГОНЫ) {
    const данные = path.join(корень, 'проверка', 'данные-замера');
    fs.rmSync(данные, { recursive: true, force: true });
    fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
    const env = { ...process.env, VERSTAK_DATA_DIR: данные, VERSTAK_AUTOSAVE_SEC: '3600' };
    delete env.ELECTRON_RUN_AS_NODE;
    env['КУХНЯ_DEV_URL'] = АДРЕС;
    const эл = spawn(electronExe, ['.', '--remote-debugging-port=9222'], { cwd: корень, env, stdio: 'ignore' });
    await пауза(6000);
    const env2 = { ...process.env, VERSTAK_QUALITY: п.качество };
    env2['КУХНЯ_URL'] = АДРЕС;
    env2['ЗАМЕР_N'] = '200';
    env2['ЗАМЕР_СОСТАВ'] = 'интерфейс';
    env2['ЗАМЕР_CPU'] = String(п.cpu);
    env2['ЗАМЕР_СЕК'] = '8';
    env2['ЗАМЕР_ПЕРЕТАСКИВАНИЕ'] = '0';
    const р = spawnSync(process.execPath, ['scripts/замер.cjs', 'electron'], { cwd: корень, env: env2, encoding: 'utf8', timeout: 240000 });
    эл.kill();
    const вывод = (р.stdout || '') + (р.stderr || '');
    const fps = /fps[^\d]*([\d.,]+)/i.exec(вывод)?.[1];
    итог.push({ ...п, вывод: вывод.split('\n').filter((с) => /fps|draw|треуг|кадр|профиль|видеокарт|1%/i.test(с)).slice(0, 14) });
    console.log(`\n=== ${п.имя} ===\n${итог.at(-1).вывод.join('\n')}`);
    await пауза(2500);
  }
  fs.writeFileSync(path.join(корень, 'проверка', 'замер-профилей.json'), JSON.stringify(итог, null, 2));
})();
