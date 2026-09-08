/*
 * gacha-data.js — 당근 가챠 데이터 정본
 * 등급 확률·개별 당근·리소스 경로는 전부 이 파일에서만 관리한다.
 * (gacha.js 는 이 구조를 읽기만 하고, 숫자를 하드코딩하지 않는다)
 */
window.GACHA_DATA = {
  /* 캐릭터가 당근을 뽑는 영상 (원본: 포치가 당근 뽑는 영상.mp4 / 720×1154, H.264+AAC, 5.17초) */
  video: 'assets/pochi-carrot-pull.mp4',

  /* 등급 — rate 는 상대 가중치. 합이 100 이 아니어도 자동 정규화된다. */
  grades: {
    common:    { label: '일반',     stars: 1, rate: 60, color: '#6B5E52', bg: '#F1EAE2', ring: '#D9CFC3', glow: 'rgba(150,130,110,.35)' },
    rare:      { label: '레어',     stars: 2, rate: 28, color: '#4F7A3A', bg: '#E3F0D9', ring: '#BBD8A6', glow: 'rgba(120,180,90,.45)' },
    superRare: { label: '슈퍼레어', stars: 3, rate: 9,  color: '#C2611F', bg: '#FDE3CC', ring: '#F5BE8E', glow: 'rgba(245,170,80,.55)' },
    ultraRare: { label: '울트라레어', stars: 4, rate: 3,  color: '#C4374A', bg: '#FBD9DE', ring: '#F3A7B4', glow: 'rgba(240,120,150,.6)' }
  },

  /* 등급이 정해진 뒤 그 등급 안에서 weight 비율로 당근을 고른다 (생략 시 1). */
  carrots: [
    { id: 'normal',  no: 1,  name: '보통 당근',   grade: 'common',    desc: '가장 흔한 크기. 포동포동하고 아삭해요.',   image: 'assets/carrots/carrot-01-normal.png' },
    { id: 'mini',    no: 2,  name: '미니 당근',   grade: 'common',    desc: '작지만 귀여운 한입 사이즈!',              image: 'assets/carrots/carrot-02-mini.png' },
    { id: 'heart',   no: 3,  name: '하트 당근',   grade: 'rare',      desc: '하트 모양이라 더 사랑스러워요.',           image: 'assets/carrots/carrot-03-heart.png' },
    { id: 'white',   no: 4,  name: '하얀 당근',   grade: 'rare',      desc: '보기 드문 하얀빛 당근이에요.',             image: 'assets/carrots/carrot-04-white.png' },
    { id: 'purple',  no: 5,  name: '보라 당근',   grade: 'rare',      desc: '신비로운 보라빛 당근이에요.',              image: 'assets/carrots/carrot-05-purple.png' },
    { id: 'kid',     no: 6,  name: '꼬마 당근',   grade: 'rare',      desc: '길쭉하고 날씬한 당근이에요.',              image: 'assets/carrots/carrot-06-kid.png' },
    { id: 'gold',    no: 7,  name: '황금 당근',   grade: 'superRare', desc: '빛나는 황금빛 당근이에요.',                image: 'assets/carrots/carrot-07-gold.png' },
    { id: 'choco',   no: 8,  name: '초코 당근',   grade: 'superRare', desc: '달콤한 초코가 묻은 당근이에요.',           image: 'assets/carrots/carrot-08-choco.png' },
    { id: 'rainbow', no: 9,  name: '무지개 당근', grade: 'ultraRare', desc: '행운을 가져다주는 특별한 당근이에요.',     image: 'assets/carrots/carrot-09-rainbow.png' },
    { id: 'king',    no: 10, name: '왕 당근',     grade: 'ultraRare', desc: '정말 크고 묵직한 거대한 당근이에요.',      image: 'assets/carrots/carrot-10-king.png' }
  ],

  /*
   * 중복 획득 보상 — 확장 자리.
   * 지금은 재화 시스템이 없어 enabled:false 로 두고 표시만 한다.
   * 나중에 재화가 생기면 enabled:true 로 바꾸고 gacha.js 의 onDuplicate() 에서 rewardByGrade 를 지급하면 된다.
   */
  duplicate: {
    enabled: false,
    rewardByGrade: { common: 1, rare: 2, superRare: 5, ultraRare: 10 }
  },

  /* 저장 키 (localStorage) */
  storageKey: 'pochiGacha:v1'
};
