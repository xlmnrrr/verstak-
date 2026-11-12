/**
 * Куски GLSL: размер детали из aSize, фаска, кромка, шероховатость и металл из атрибутов инстанса.
 * Патчим минимум кусков three (`begin_vertex`, `color_fragment`, `roughnessmap_fragment`, `metalnessmap_fragment`,
 * `normal_fragment_maps`). three закреплён на 0.187.0.
 */
import * as THREE from 'three';

export interface ОпцииШейдера {
  /** настоящая фаска (геометрия с aOff) */
  фаска: boolean;
  /** шейдерная фаска на ребре плоского куба */
  скругление: boolean;
  /** цвет торца: кромка / сырая ЛДСП */
  кромка: boolean;
  /** шум сырой ЛДСП */
  шум: boolean;
  /** скрытие стены между камерой и комнатой */
  стена: boolean;
}

/** Массив текстур материалов и масштаб (метров на повтор) каждого слоя: общий для всех групп плит */
export const МАССИВ_ТЕКСТУР = { value: null as THREE.Texture | null };
export const МАСШТАБЫ_СЛОЁВ = { value: new Float32Array(32).fill(1) };

/** Общий uniform положения камеры для стен */
export const ПОЛОЖЕНИЕ_КАМЕРЫ = { value: new THREE.Vector3() };

const ВЕРШИНА_ОБЩАЯ = /* glsl */ `
attribute vec3 aSize;
attribute vec4 aSurf;
varying vec4 vSurf;
#ifdef BEVEL
attribute vec3 aOff;
#endif
#ifdef WALL
uniform vec3 uViewPos;
#endif
#ifdef DETAIL
varying vec3 vLocal;
varying vec3 vHalf;
varying vec3 vNl;
varying vec3 vAx;
varying vec3 vAy;
varying vec3 vAz;
#endif
`;

/** Замена begin_vertex: положение из aSize (и aOff для фаски) */
const НАЧАЛО_ВЕРШИНЫ = /* glsl */ `
vec3 transformed;
#ifdef BEVEL
  float rr = min(aSurf.w * 0.001, 0.25 * min(aSize.x, min(aSize.y, aSize.z)));
  transformed = (position * 2.0) * max(aSize * 0.5 - rr, 0.0) + aOff * rr;
#else
  transformed = position * aSize;
#endif
#ifdef WALL
  {
    vec3 nw = normalize(mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0));
    vec3 cw = instanceMatrix[3].xyz;
    if (dot(uViewPos - cw, nw) < 0.0) transformed = vec3(0.0);
  }
#endif
vSurf = aSurf;
#ifdef DETAIL
  vLocal = position * aSize;
  vHalf = aSize * 0.5;
  vNl = normal;
  {
    mat3 im = mat3(instanceMatrix);
    vAx = normalize(normalMatrix * im[0]);
    vAy = normalize(normalMatrix * im[1]);
    vAz = normalize(normalMatrix * im[2]);
  }
#endif
`;

const ФРАГМЕНТ_ОБЩИЙ = /* glsl */ `
varying vec4 vSurf;
#ifdef DETAIL
uniform highp sampler2DArray uTex;
uniform float uTexScale[32];
#endif
#ifdef DETAIL
varying vec3 vLocal;
varying vec3 vHalf;
varying vec3 vNl;
varying vec3 vAx;
varying vec3 vAy;
varying vec3 vAz;
#endif
`;

/** Текстура материала: UV из миллиметров детали, волокно вдоль длинной стороны; RGB × цвет, альфа — шероховатость */
const ТЕКСТУРА = /* glsl */ `
float texR = -1.0;
#ifdef DETAIL
{
  int layer = int( vSurf.z + 0.5 ) >> 7;
  if ( layer > 0 ) {
    vec3 an = abs( vNl );
    vec2 uv;
    vec2 hs;
    if ( an.x > 0.5 ) { uv = vec2( vLocal.z, vLocal.y ); hs = vec2( vHalf.z, vHalf.y ); }
    else if ( an.y > 0.5 ) { uv = vec2( vLocal.x, vLocal.z ); hs = vec2( vHalf.x, vHalf.z ); }
    else { uv = vec2( vLocal.x, vLocal.y ); hs = vec2( vHalf.x, vHalf.y ); }
    if ( hs.y > hs.x ) uv = uv.yx;
    uv = uv / uTexScale[ layer ] + 0.5;
    vec4 t = texture( uTex, vec3( uv, float( layer - 1 ) ) );
    diffuseColor.rgb *= t.rgb;
    texR = t.a;
  }
}
#endif
`;

/** Цвет торца: есть кромка — цвет плиты, нет — «сырая» ЛДСП с шумом (бит 6 в aSurf.z — деталь из ЛДСП) */
const ЦВЕТ_ТОРЦА = /* glsl */ `
#if defined( DETAIL ) && defined( EDGES )
{
  vec3 an = abs( vNl );
  int ax = ( an.x > an.y && an.x > an.z ) ? 0 : ( an.y > an.z ? 1 : 2 );
  float sg = ax == 0 ? vNl.x : ( ax == 1 ? vNl.y : vNl.z );
  int ta = ( vHalf.x <= vHalf.y && vHalf.x <= vHalf.z ) ? 0 : ( vHalf.y <= vHalf.z ? 1 : 2 );
  if ( ax != ta ) {
    int bits = int( vSurf.z + 0.5 );
    int bi = ax * 2 + ( sg < 0.0 ? 1 : 0 );
    bool hasEdge = ( ( bits >> bi ) & 1 ) == 1;
    bool rawEdge = ( ( bits >> 6 ) & 1 ) == 1;
    if ( !hasEdge && rawEdge ) {
      float px = length( fwidth( vLocal ) );
      #ifdef NOISE
        float n = fract( sin( dot( floor( vLocal * 1500.0 ), vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
        float k = 0.92 + 0.16 * mix( n, 0.5, smoothstep( 0.0007, 0.003, px ) );
      #else
        float k = 1.0;
      #endif
      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.485, 0.392, 0.254 ), 0.75 ) * k;
    }
  }
}
#endif
`;

/** Шейдерная фаска: у ребра грани нормаль плавно наклоняется к соседней грани, полоса не уже пикселя */
const ФАСКА_НОРМАЛИ = /* glsl */ `
#if defined( DETAIL ) && defined( FILLET )
{
  vec3 mask = vec3( 1.0 ) - step( 0.5, abs( vNl ) );
  vec3 d = vHalf - abs( vLocal );
  float px = length( fwidth( vLocal ) );
  float r = vSurf.w * 0.001;
  r = min( r, 0.25 * min( vHalf.x, min( vHalf.y, vHalf.z ) ) * 2.0 );
  float rE = max( r, px * 1.2 );
  float fade = smoothstep( 0.5 * px, px, r );
  vec3 t = mask * ( 1.0 - smoothstep( 0.0, rE, d ) ) * fade;
  vec3 tilt = t * sign( vLocal );
  normal = normalize( normal + vAx * tilt.x + vAy * tilt.y + vAz * tilt.z );
}
#endif
`;

export function ключПрограммы(имя: string, о: ОпцииШейдера): string {
  return `${имя}|${о.фаска ? 'ф' : ''}${о.скругление ? 'с' : ''}${о.кромка ? 'к' : ''}${о.шум ? 'ш' : ''}${о.стена ? 'с' : ''}`;
}

export function определения(о: ОпцииШейдера, деталь: boolean): Record<string, string> {
  const д: Record<string, string> = {};
  if (деталь) d_set(д, 'DETAIL');
  if (о.фаска) d_set(д, 'BEVEL');
  if (о.скругление) d_set(д, 'FILLET');
  if (о.кромка) d_set(д, 'EDGES');
  if (о.шум) d_set(д, 'NOISE');
  if (о.стена) d_set(д, 'WALL');
  return д;
}
const d_set = (д: Record<string, string>, k: string) => {
  д[k] = '';
};

/** Патч шейдера цветового прохода (MeshStandardMaterial) */
export function патчЦвета(шейдер: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) {
  шейдер.uniforms.uViewPos = ПОЛОЖЕНИЕ_КАМЕРЫ;
  шейдер.uniforms.uTex = МАССИВ_ТЕКСТУР;
  шейдер.uniforms.uTexScale = МАСШТАБЫ_СЛОЁВ;
  шейдер.vertexShader = шейдер.vertexShader
    .replace('#include <common>', `#include <common>\n${ВЕРШИНА_ОБЩАЯ}`)
    .replace('#include <begin_vertex>', НАЧАЛО_ВЕРШИНЫ);
  шейдер.fragmentShader = шейдер.fragmentShader
    .replace('#include <common>', `#include <common>\n${ФРАГМЕНТ_ОБЩИЙ}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\n${ТЕКСТУРА}\n${ЦВЕТ_ТОРЦА}`)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = texR >= 0.0 ? texR : vSurf.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.y;')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${ФАСКА_НОРМАЛИ}`);
}

/** Патч шейдера прохода тени: тот же размер детали, без цветовой части */
export function патчГлубины(шейдер: { vertexShader: string }) {
  шейдер.vertexShader = шейдер.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
attribute vec3 aSize;
attribute vec4 aSurf;
#ifdef BEVEL
attribute vec3 aOff;
#endif`,
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `
vec3 transformed;
#ifdef BEVEL
  float rr = min(aSurf.w * 0.001, 0.25 * min(aSize.x, min(aSize.y, aSize.z)));
  transformed = (position * 2.0) * max(aSize * 0.5 - rr, 0.0) + aOff * rr;
#else
  transformed = position * aSize;
#endif
`,
    );
}
