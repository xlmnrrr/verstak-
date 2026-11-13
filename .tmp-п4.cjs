const fs=require('fs');
let p='scripts/лист-изделий.cjs';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/          \/\/ размер холста ядра не трогаем[\s\S]*?void сто;\n/,'');
fs.writeFileSync(p,s);
