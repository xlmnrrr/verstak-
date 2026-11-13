const fs = require('fs');
let p = 'src/model/каталог/index.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.replace("import { ТЕХНИКА_ВАРИАНТЫ } from './техника-варианты';", "import { ТЕХНИКА_ВАРИАНТЫ } from './техника-варианты';\nimport { ИЗДЕЛИЯ_ИНТЕРЬЕРА } from './интерьер';");
s = s.replace('...НОВЫЕ_ИЗДЕЛИЯ, ...ТЕХНИКА_ВАРИАНТЫ]', '...НОВЫЕ_ИЗДЕЛИЯ, ...ТЕХНИКА_ВАРИАНТЫ, ...ИЗДЕЛИЯ_ИНТЕРЬЕРА]');
s = s.replace("  'Свет и декор',\n", "  'Свет и декор',\n  'Климат',\n");
fs.writeFileSync(p, s);
