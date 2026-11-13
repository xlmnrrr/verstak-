const fs=require('fs');
let p='src/render/модели/материалы-моделей.ts';
let s=fs.readFileSync(p,'utf8');
s=s.replace("текстура?: { имя: string; шаг: number; вращение?: number };","текстура?: { имя: string; шаг: number; вращение?: number; безЦвета?: boolean };");
s=s.replace("текстура: { имя: 'металл-шлифованный', шаг: 0.3 } },\n  'нержавейка-пруток'","текстура: { имя: 'металл-шлифованный', шаг: 0.6, безЦвета: true } },\n  'нержавейка-пруток'");
s=s.replace("      мат.map = т.map;\n","      if (!безЦвета) мат.map = т.map;\n");
s=s.replace("const { имя, шаг, вращение } = о.текстура;","const { имя, шаг, вращение, безЦвета } = о.текстура;");
fs.writeFileSync(p,s);
