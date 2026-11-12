/** План проекта для листа на обложке: контур помещения и следы предметов, мм */
export interface СхемаЛиста {
  контур: [number, number][];
  /** [x, z, ш, г, поворот, навесной 0|1] */
  объекты: [number, number, number, number, number, number][];
}
export function схемаПлана(данные: unknown, помещениеId?: string): СхемаЛиста | undefined;
