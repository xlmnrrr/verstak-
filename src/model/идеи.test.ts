import { describe, expect, it } from 'vitest';
import { ИДЕИ, проектИдеи } from './идеи';
import { изделиеПоИд } from './каталог';
import { проверитьПроект } from './валидатор';

describe('идеи от Claude', () => {
  for (const идея of ИДЕИ) {
    it(`«${идея.название}»: все изделия есть в каталоге, предметы внутри комнаты`, () => {
      for (const [id] of идея.предметы) expect(изделиеПоИд(id), id).toBeTruthy();
      const п = проектИдеи(идея);
      expect(п.объекты.length).toBe(идея.предметы.length);
      const xs = п.помещения[0].контур.map((т) => т[0]);
      const zs = п.помещения[0].контур.map((т) => т[1]);
      for (const э of п.объекты) {
        expect(э.позиция[0], `${э.изделие} x`).toBeGreaterThan(Math.min(...xs) - 100);
        expect(э.позиция[0], `${э.изделие} x`).toBeLessThan(Math.max(...xs) + 100);
        expect(э.позиция[2], `${э.изделие} z`).toBeGreaterThan(Math.min(...zs) - 100);
        expect(э.позиция[2], `${э.изделие} z`).toBeLessThan(Math.max(...zs) + 100);
      }
      // валидатор не падает и возвращает список (замечания допустимы: это интерьер, а не чертёж цеха)
      expect(Array.isArray(проверитьПроект(п))).toBe(true);
    });
  }
  it('идей не меньше шести и id уникальны', () => {
    expect(ИДЕИ.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ИДЕИ.map((и) => и.id)).size).toBe(ИДЕИ.length);
  });
});
