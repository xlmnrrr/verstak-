import { КАТАЛОГ_V2 } from './src/model/каталог/index';
for (const и of КАТАЛОГ_V2) console.log([и.id, и.категория, и.вид ?? '', и.название, JSON.stringify(и.габариты?.по_умолчанию ?? и.габариты)].join(' | '));
console.log(КАТАЛОГ_V2.length);
