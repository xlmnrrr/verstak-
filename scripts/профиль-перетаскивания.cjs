/**
 * Профиль шага перетаскивания (CDP Profiler): где тратится время, пока модуль двигается командой изменитьОбъект.
 * Запуск: окно Electron уже открыто на dev-сервере с --remote-debugging-port=9222, затем
 *   node scripts/профиль-перетаскивания.cjs [N=200] [CPU=4]
 * Печатает топ функций по собственному времени (мс на 300 шагов, с учётом замедления).
 */
const PUPPETEER = 'C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core';
const puppeteer = require(PUPPETEER);
const N = Number(process.argv[2] || 200);
const CPU = Number(process.argv[3] || 4);
const АДРЕС = process.env.КУХНЯ_URL || 'http://127.0.0.1:5274/';

(async () => {
  const браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const стр = (await браузер.pages()).find((p) => p.url().startsWith(АДРЕС));
  if (!стр) throw new Error('нет окна приложения');
  await стр.evaluate(async (N) => {
    const useКухня = window.__верстакStore;
    const { КАТАЛОГ } = await import('/src/data/modules.ts');
    const { новый_проект, пустая_комната } = await import('/src/types.ts');
    const корпуса = КАТАЛОГ.filter((m) => m.вид === 'корпус' || m.вид === 'навесной');
    const сторона = Math.ceil(Math.sqrt(N));
    const шаг = 1300;
    const длина = Math.max(3600, сторона * шаг + 600);
    const п = новый_проект(`профиль ${N}`, пустая_комната(длина, длина, 2700));
    for (let i = 0; i < N; i++) {
      const м = корпуса[i % корпуса.length];
      const x = (i % сторона) * шаг - (сторона * шаг) / 2 + шаг / 2;
      const z = Math.floor(i / сторона) * шаг - (сторона * шаг) / 2 + шаг / 2;
      п.объекты.push({ id: `bench-${i}`, модуль: м.id, позиция: [Math.round(x), 0, Math.round(z)], поворот: (i * 90) % 360, габариты: { ш: Math.min(м.габариты.ш, 1200), г: Math.min(м.габариты.г, 650), в: м.габариты.в }, подъём: м.крепление === 'навесное' ? (м.подъём_по_умолчанию ?? 1400) : undefined, фасад: м.фасад, цоколь: м.цоколь });
    }
    useКухня.getState().загрузитьV1(п);
  }, N);
  await new Promise((r) => setTimeout(r, 3000));
  const cdp = await стр.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  const р = await стр.evaluate(async () => {
    const к = window.__кухня;
    const useКухня = window.__верстакStore;
    const { изменитьОбъект } = await import('/src/store/команды.ts');
    const { gl, scene, camera } = к;
    const с = useКухня.getState();
    const id = с.проект2.объекты[Math.floor(с.проект2.объекты.length / 2)].id;
    const старт = с.проект2.объекты.find((o) => o.id === id).позиция;
    с.выбрать([id]);
    с.начатьИзменение();
    const кадры = [];
    await new Promise((готово) => {
      let n = 0;
      let прошлый = performance.now();
      const кадр = (t) => {
        const dx = Math.round(Math.sin(n / 20) * 300);
        const dz = Math.round(Math.cos(n / 20) * 300);
        useКухня.getState().выполнить(изменитьОбъект(id, (э) => ({ ...э, позиция: [старт[0] + dx, э.позиция[1], старт[2] + dz] }), 'Переместить'));
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, camera);
        кадры.push(t - прошлый);
        прошлый = t;
        if (++n < 301) requestAnimationFrame(кадр);
        else готово();
      };
      requestAnimationFrame(кадр);
    });
    useКухня.getState().завершитьИзменение();
    const ср = кадры.slice(1).reduce((a, b) => a + b, 0) / (кадры.length - 1);
    return { fps: +(1000 / ср).toFixed(1), кадр_мс: +ср.toFixed(2) };
  });
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // собственное время узлов
  const время = new Map();
  const узлы = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const дт = (profile.timeDeltas[i] || 0) / 1000;
    const n = узлы.get(id);
    const ф = n.callFrame;
    const ключ = `${ф.functionName || '(анонимная)'} ${ф.url.split('/').slice(-2).join('/')}:${ф.lineNumber + 1}`;
    время.set(ключ, (время.get(ключ) || 0) + дт);
  });
  // включительное время компонентов и функций из src (с детьми)
  const родитель = new Map();
  for (const n of profile.nodes) for (const c of n.children || []) родитель.set(c, n.id);
  const собств = new Map();
  profile.samples.forEach((id, i) => собств.set(id, (собств.get(id) || 0) + (profile.timeDeltas[i] || 0) / 1000));
  const включ = new Map();
  for (const [id, мс] of собств) {
    const видели = new Set();
    for (let u = id; u != null; u = родитель.get(u)) {
      const ф = узлы.get(u).callFrame;
      if (!ф.url.includes('/src/')) continue;
      const ключ = (ф.functionName || '(анонимная)') + ' ' + decodeURIComponent(ф.url.split('/src/')[1].split('?')[0]) + ':' + (ф.lineNumber + 1);
      if (видели.has(ключ)) continue;
      видели.add(ключ);
      включ.set(ключ, (включ.get(ключ) || 0) + мс);
    }
  }
  console.log('--- включительно (src), мс на 300 шагов');
  for (const [к, мс] of [...включ.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16)) console.log(мс.toFixed(0).padStart(6) + ' мс  ' + к);
  const всего = [...время.values()].reduce((a, b) => a + b, 0);
  console.log(`${N} модулей, CPU×${CPU}: ${р.fps} fps, кадр ${р.кадр_мс} мс; всего в профиле ${всего.toFixed(0)} мс`);
  for (const [к, мс] of [...время.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`${мс.toFixed(0).padStart(6)} мс  ${к}`);
  await браузер.disconnect();
})();
