/** Тихая установка собранного установщика в C:\VerstakTest (как в проверка-удаления.cjs): node scripts/поставить-тест.cjs [удалить] */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const папка = 'C:\\VerstakTest';
if (process.argv.includes('удалить')) {
  spawnSync(path.join(папка, 'Uninstall Верстак.exe'), ['/S'], { stdio: 'ignore' });
  console.log('удалено');
} else {
  const установщик = path.join(process.cwd(), 'release', 'Верстак-0.1.0-установщик.exe');
  const р = spawnSync(установщик, ['/S', `/D=${папка}`], { stdio: 'ignore' });
  console.log('код', р.status, fs.existsSync(path.join(папка, 'Верстак.exe')) ? 'установлено' : 'НЕ установлено', fs.readdirSync(папка).slice(0, 5));
}
