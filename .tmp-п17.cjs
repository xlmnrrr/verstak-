const fs=require('fs');
let p='src/render/модели/геометрии-моделей.ts';
let s=fs.readFileSync(p,'utf8');
const зам=(a,b)=>{ if(!s.includes(a)) throw new Error('нет: '+a.slice(0,60)); s=s.replace(a,()=>b); };
зам("      г = uvПоМетрам(new RoundedBoxGeometry(м(0), м(1), м(2), Number(ч[4] ?? 3), r));","      // скругление дорогое (300 треугольников при 2 сегментах): у мелких деталей и острых рёбер — меньше сегментов или обычный брус\n      const сегм = r < 0.0009 ? 0 : r < 0.003 ? 1 : Number(ч[4] ?? 3);\n      г = uvПоМетрам(сегм === 0 ? new THREE.BoxGeometry(м(0), м(1), м(2)) : new RoundedBoxGeometry(м(0), м(1), м(2), сегм, r));");
зам("      г = пруток(м(0), м(1), Number(ч[2] ?? 16), true);","      // тонкие прутки — меньше граней\n      г = пруток(м(0), м(1), м(0) < 0.008 ? 6 : м(0) < 0.016 ? Math.min(10, Number(ч[2] ?? 16)) : Number(ч[2] ?? 16), true);");
зам("  const г = new THREE.LatheGeometry(пр, 40);","  // чем мельче деталь, тем меньше граней по окружности (шляпки, кнопки, колпачки)\n  const сегм = d < 0.04 ? 14 : d < 0.09 ? 24 : 40;\n  const г = new THREE.LatheGeometry(пр, сегм);");
зам("      г = new THREE.TorusGeometry(м(1), м(0) / 2, 16, 40, (Number(ч[2] ?? 180) * Math.PI) / 180);","      г = new THREE.TorusGeometry(м(1), м(0) / 2, м(0) < 0.008 ? 5 : 12, Number(ч[2] ?? 180) > 200 ? 48 : 28, (Number(ч[2] ?? 180) * Math.PI) / 180);");
fs.writeFileSync(p,s);
