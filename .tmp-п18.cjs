const fs=require('fs');
function прав(p, ф){ let s=fs.readFileSync(p,'utf8'); s=ф(s); fs.writeFileSync(p,s); }
const зам=(s,a,b)=>{ if(!s.includes(a)) throw new Error('нет: '+a.slice(0,60)); return s.replace(a,()=>b); };
прав('src/render/модели/проёмы.ts', s=>{
  s=зам(s,"    const ц = изд.материалы.фасад?.startsWith('#') ? изд.материалы.фасад : '#ece8df';","    const ц = цвет && цвет.startsWith('#') ? цвет : '#ece8df';");
  s=зам(s,"export function примитивыПроёма(изд: Pick<Изделие, 'id' | 'материалы'>, габ: Габариты): Примитив[] | null {","export function примитивыПроёма(изд: Pick<Изделие, 'id'>, габ: Габариты, цвет?: string): Примитив[] | null {");
  return s;
});
прав('src/render/примитивы.ts', s=>зам(s,"примитивыПроёма(изд, экз.габариты) ??","примитивыПроёма(изд, экз.габариты, экз.материалы?.фасад) ??"));
прав('src/render/модели/декор.ts', s=>зам(s,"р.push(точёная('шайба', 'краска-белая', [0, H - 14, 0], d * 0.62, 28, 'y'));","р.push(точёная('шайба', 'краска-белая', [0, H - 14, 0], d * 1.0, 28, 'y'));"));
прав('src/render/модели/материалы-моделей.ts', s=>зам(s,"emissive: '#ffae5c', emissiveIntensity: 1.3","emissive: '#ffae5c', emissiveIntensity: 0.7"));
