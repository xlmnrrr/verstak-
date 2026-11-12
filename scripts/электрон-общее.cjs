/**
 * Общие помощники для проверок в настоящем окне Electron: запуск с подменой папки данных, подключение через CDP,
 * сбор ошибок консоли (падает на Shader Error), открытие примера, скриншоты.
 * Боевые данные не трогаются: приложение стартует с VERSTAK_DATA_DIR.
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const PUPPETEER = 'C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core';
const puppeteer = require(PUPPETEER);
const electronExe = require(path.join(process.cwd(), 'node_modules', 'electron'));

const пауза = (мс) => new Promise((r) => setTimeout(r, мс));

function запуститьElectron({ адрес, данные, порт = 9333, доп = {} }) {
  fs.mkdirSync(данные, { recursive: true });
  const env = { ...process.env, VERSTAK_DATA_DIR: данные, ...доп };
  delete env.ELECTRON_RUN_AS_NODE;
  env['КУХНЯ_DEV_URL'] = адрес;
  return spawn(electronExe, ['.', `--remote-debugging-port=${порт}`], { cwd: process.cwd(), env, stdio: 'ignore' });
}

async function подключиться(адрес, порт = 9333) {
  for (let i = 0; i < 80; i++) {
    try {
      const браузер = await puppeteer.connect({ browserURL: `http://127.0.0.1:${порт}`, defaultViewport: null });
      const стр = (await браузер.pages()).find((p) => p.url().startsWith(адрес));
      if (стр) return { браузер, стр };
      браузер.disconnect();
    } catch {
      /* ждём запуск */
    }
    await пауза(500);
  }
  throw new Error('не удалось подключиться к окну Electron');
}

/** Ошибки консоли окна: любая строка с Shader Error / THREE.WebGLProgram — критична */
function слушатьКонсоль(стр) {
  const ошибки = [];
  const шейдер = [];
  const все = [];
  стр.on('pageerror', (e) => ошибки.push(`pageerror: ${e.message}`));
  стр.on('console', (м) => {
    const т = м.text();
    все.push(`${м.type()}: ${т}`);
    if (/Shader Error|WebGLProgram|THREE\.WebGLShader/.test(т)) шейдер.push(т.slice(0, 600));
    if (м.type() === 'error') ошибки.push(т.slice(0, 400));
  });
  return { ошибки, шейдер, все };
}

async function открытьПример(стр) {
  await стр.evaluate(() => {
    const э = [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'));
    if (э) э.click();
  });
  await пауза(2500);
}

module.exports = { puppeteer, пауза, запуститьElectron, подключиться, слушатьКонсоль, открытьПример };
