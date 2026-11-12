/**
 * Замер настоящего жеста: 200 модулей «интерфейс», реальное перетаскивание мышью (прилипание, подсказки стыковки, размерные
 * линии, панели), fps по кадрам браузера. Окно Electron уже открыто на dev-сервере с --remote-debugging-port=9222:
 *   node scripts/замер-жеста.cjs [CPU=4]
 */
const PUPPETEER = 'C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core';
const puppeteer = require(PUPPETEER);
const CPU = Number(process.argv[2] || 4);
const АДРЕС = process.env.КУХНЯ_URL || 'http://127.0.0.1:5274/';
const пауза = (мс) => new Promise((r) => setTimeout(r, мс));

(async () => {
  const браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const стр = (await браузер.pages()).find((p) => p.url().startsWith(АДРЕС));
  const N = 200;
  await стр.evaluate(async (N) => {
    const useКухня = window.__верстакStore;
    const { КАТАЛОГ } = await import('/src/data/modules.ts');
    const { новый_проект, пустая_комната } = await import('/src/types.ts');
    const корпуса = КАТАЛОГ.filter((m) => m.вид === 'корпус' || m.вид === 'навесной');
    const сторона = Math.ceil(Math.sqrt(N));
    const длина = Math.max(3600, сторона * 1300 + 600);
    const п = новый_проект('жест', пустая_комната(длина, длина, 2700));
    for (let i = 0; i < N; i++) {
      const м = корпуса[i % корпуса.length];
      п.объекты.push({ id: `ж-${i}`, модуль: м.id, позиция: [Math.round((i % сторона) * 1300 - (сторона * 1300) / 2 + 650), 0, Math.round(Math.floor(i / сторона) * 1300 - (сторона * 1300) / 2 + 650)], поворот: 0, габариты: { ш: Math.min(м.габариты.ш, 1200), г: Math.min(м.габариты.г, 650), в: м.габариты.в }, подъём: м.крепление === 'навесное' ? 1400 : undefined, фасад: м.фасад, цоколь: м.цоколь });
    }
    useКухня.getState().загрузитьV1(п);
    useКухня.getState().установитьОбзор('сверху');
  }, N);
  await пауза(3500);
  // камера сверху на средний ряд; выбираем нижне-срединный модуль
  const инфо = await стр.evaluate(() => {
    const с = window.__верстакStore.getState();
    const о = с.проект2.объекты[Math.floor(с.проект2.объекты.length / 2)];
    window.__кухня.поставитьКамеру(o_x(о), 6, o_z(о) + 3, 0, -1.2);
    function o_x(о) { return о.позиция[0] / 1000; }
    function o_z(о) { return о.позиция[2] / 1000; }
    return { id: о.id, x: о.позиция[0], z: о.позиция[2] };
  });
  await пауза(800);
  const cdp = await стр.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const a = await стр.evaluate((x, y, z) => window.__кухня.экраннаяТочка(x / 1000, 0, z / 1000), инфо.x + 150, 0, инфо.z - 100);
  const b = await стр.evaluate((x, y, z) => window.__кухня.экраннаяТочка(x / 1000, 0, z / 1000), инфо.x + 150 + 420, 0, инфо.z - 100 + 260);
  await стр.evaluate(() => {
    window.__интервалы = [];
    let пр = performance.now();
    const шаг = (t) => {
      window.__интервалы.push(t - пр);
      пр = t;
      if (!window.__стоп) requestAnimationFrame(шаг);
    };
    window.__стоп = false;
    requestAnimationFrame(шаг);
  });
  const проф = process.argv[3] === 'проф';
  if (проф) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 300 });
    await cdp.send('Profiler.start');
  }
  await стр.mouse.move(a.x, a.y);
  await стр.mouse.down();
  const шагов = 90;
  for (let i = 1; i <= шагов; i++) {
    const т = i / шагов;
    const w = Math.sin(т * Math.PI * 3);
    await стр.mouse.move(a.x + (b.x - a.x) * т * 0.5 + (b.x - a.x) * 0.5 * w, a.y + (b.y - a.y) * т * 0.5 + (b.y - a.y) * 0.5 * w);
    await пауза(4);
  }
  await стр.mouse.up();
  await пауза(300);
  const р = await стр.evaluate(() => {
    window.__стоп = true;
    const и = window.__интервалы.slice(2).sort((x, y) => x - y);
    const ср = и.reduce((s, v) => s + v, 0) / и.length;
    return { кадров: и.length, fps: +(1000 / ср).toFixed(1), медиана_мс: +и[Math.floor(и.length / 2)].toFixed(1), p95_мс: +и[Math.floor(и.length * 0.95)].toFixed(1), худший_мс: +и[и.length - 1].toFixed(1), сдвинут: window.__верстакStore.getState().проект2.объекты.some((o) => o.id === 'ж-100') };
  });
  if (проф) {
    const { profile } = await cdp.send('Profiler.stop');
    const узлы = new Map(profile.nodes.map((n) => [n.id, n]));
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
    for (const [к, мс] of [...включ.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)) console.log(мс.toFixed(0).padStart(6) + ' мс  ' + к);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`настоящий жест мышью, ${N} модулей, CPU×${CPU}:`, JSON.stringify(р));
  await браузер.disconnect();
})();
