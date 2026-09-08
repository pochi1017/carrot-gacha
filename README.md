# 포치의 당근 뽑기 🥕

버튼을 누르면 포치가 당근밭에서 당근을 뽑아 올리는 가챠 게임입니다.
정적 파일(HTML/CSS/JS)로만 되어 있어 `index.html`을 열면 바로 동작합니다.

## 플레이
- 당근을 클릭 → 캐릭터가 당근 뽑는 영상 재생 → 등급별 결과 카드 공개 → 당근 도감에 등록
- 당근 10종 · 4등급(일반/레어/슈퍼레어/울트라레어). 확률·데이터는 `gacha-data.js`에서 관리합니다.
- 획득 기록은 브라우저 localStorage에 저장됩니다.

## 구성
- `index.html` · `style.css` · `gacha.js` · `gacha-data.js`
- `assets/carrots/` 당근 10종 PNG, `assets/pochi-carrot-pull.mp4` 뽑기 영상
