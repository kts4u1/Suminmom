# 수민맘(suminmom.com) 홍보 영상

수민맘 답례품 쇼핑몰을 소개하는 1분 30초(30fps) 홍보 영상입니다.
판매 상품과 선물세트, 그리고 위성 지도로 회사 위치(부천테크노파크)까지 찾아가는 장면을 담았습니다.

완성본

- 세로 · 모바일용 (1080×1920, 9:16 — 인스타그램 릴스, 유튜브 쇼츠, 틱톡): `output/suminmom_promo_vertical.mp4`
- 가로 (1920×1080, 16:9 — 유튜브, 홈페이지): `output/suminmom_promo.mp4`

세로 버전은 같은 장면을 세로 화면에 맞게 다시 배치했습니다. 휴대폰에서 읽기 쉽게 글자를 키웠고,
장면마다 내용의 높이를 재서 위아래 여백이 같도록 화면 가운데에 자동으로 맞춥니다(`main.js`의 세로 가운데 정렬 부분).
지도 장면은 주소 카드 · 본사 핀 · 정보창을 위아래로 쌓아 화면 가운데에 두었습니다.

## 구성 (타임라인)

| 시간 | 장면 |
|---|---|
| 0:00 – 0:07 | 오프닝: 수민맘 로고, "전하는 마음에 특별함을 더하는, 진심을 담은 수건" |
| 0:07 – 0:15 | 모든 감사의 순간에: 첫돌 · 웨딩 · 고희/회갑 · 기업 행사 · 교회/기념일 · 조문 |
| 0:15 – 0:25 | 첫돌 답례품: 이름과 날짜를 수놓는 자수 애니메이션, 자수 수건 디자인 슬라이드 |
| 0:25 – 0:30 | 100% 국산 호텔급 수건(40×80cm) 원사별 특징 — 30수 면사 170g ~ 뱀부얀 220g · 40수 코마사 180g |
| 0:30 – 0:34 | 친환경 뱀부얀 수건: 항균도 99.9% · 흡수력 3배 · 먼지 50% 감소 · 캐시미어급 촉감 |
| 0:34 – 0:37 | 선물세트 타이틀 |
| 0:37 – 0:43 | 시그니처 4P세트(호두정과 + 꿀스틱 + 핑크소금스틱)와 구성품, 호두정과+꿀스틱20P 시그니처세트 |
| 0:43 – 0:49 | 프리미엄 세트: 호두정과+꿀스틱+핑크소금스틱, 호두정과+꿀스틱20P, 호두정과 프리미엄세트 |
| 0:49 – 0:54 | 수건 선물세트: 호텔수건 3P 시그니처세트, 수건+핸드워시, 수건+꿀·소금스틱 |
| 0:54 – 1:00 | 조문답례품 프리미엄 세트(수건 · 핑크솔트 스틱 · 꿀스틱 · 조의 감사 카드) |
| 1:00 – 1:09 | 위성 지도(2025년 6월 여름 촬영본): 한반도 → 서울·인천·부천 → 수민맘 본사로 하강 |
| 1:09 – 1:16 | 부천테크노파크 202동 805호 (경기도 부천시 송내대로 388) 핀과 꽃잎 효과, 직접 제작 · 전국 택배 · 고객센터 |
| 1:16 – 1:23 | 특별 혜택: 행사 3주 전 할인 · 3인 공구 · 사전기대글 캐쉬백 · 후기 캐쉬백 |
| 1:23 – 1:30 | 엔딩: www.suminmom.com · 032-201-1344 · @sumin.mom_gift |

## 내용 수정하는 법

모든 문구, 가격, 사진, 장면 시간은 `config.json`에 있습니다.

- 화면 문구: `text`
- 상품 · 사진: `data` (`sig`, `prem`, `towelSets`, `condol`, `towels` 등) — 영상에는 가격을 넣지 않았습니다.
- 회사 위치(지도 핀): `data.office.lat`, `lon` — OpenStreetMap의 송내대로 388 202동 건물 좌표입니다.
- 장면 시간: `scenes`, 지도 비행 시간: `map`
- 위성사진 시기: `map.release` — Esri World Imagery Wayback 릴리스 번호입니다. 48925는 나무가 푸른 2025년 6월 촬영본입니다.

문구를 바꾼 뒤에는 `python3 scripts/fetch_fonts.py`를 다시 실행해야 새 글자가 명조체로 나옵니다(빌드 스크립트가 자동으로 실행합니다).

## 다시 만들기

```bash
./scripts/build.sh      # 가로 + 세로 둘 다
./scripts/build.sh v    # 세로(모바일)만
./scripts/build.sh h    # 가로만
```

순서대로 다음을 실행합니다.

1. `scripts/fetch_fonts.py` — 고운바탕 · Cormorant Garamond 글꼴을 영상에 쓰인 글자만 담아 내려받기 (Google Fonts)
2. `scripts/make_audio.py` — 배경음악과 효과음 합성 (numpy로 직접 생성, 저작권 문제 없음). 가로 · 세로 공통
3. `scripts/render.js --collect` — 카메라 경로에 필요한 위성 지도 타일 목록 생성
4. `scripts/fetch_tiles.sh` — 위성 타일 다운로드 (Esri World Imagery Wayback)
5. `scripts/render.js` — 헤드리스 Chromium으로 프레임 렌더링 (`index.html` + `main.js`, 세로는 `--fmt v`)
6. `scripts/encode.sh` — ffmpeg로 MP4 인코딩

세로 화면에서만 줄바꿈을 다르게 하는 문구는 `config.json`의 `vertical.text`에 있습니다.

미리보기: `video/` 폴더를 정적 서버로 띄우고 `index.html?play` (세로는 `index.html?fmt=v&play`, 특정 시점부터는 `&t=60`).
특정 장면 스틸: `node scripts/render.js --fmt v --stills 18,41,70 --out output/stills`

## 본사 찾아가는 길 (3D 지형 비행, 테스트)

본사 위치 장면만 따로 만든 25초짜리 시험 영상입니다: `output/suminmom_journey_vertical.mp4` (1080×1920)

위에서 수직으로 내려가는 대신, 실제 고도 데이터로 산과 강을 3D로 세우고 드론처럼 낮게 날아갑니다.

| 시간 | 장면 |
|---|---|
| 0:00 – 0:03 | "수민맘 본사 찾아가는 길 — 산 넘고 물 건너, 정성을 전하러 갑니다" |
| 0:02 – 0:07 | **산 넘고**: 북한산(836m) 봉우리를 넘어 내려갑니다 |
| 0:09 – 0:14 | **물 건너**: 한강을 건넙니다 |
| 0:14 – 0:19 | **수민맘 본사로**: 서울 서쪽을 지나 부천으로, 분홍색 안내선을 따라갑니다 |
| 0:19 – 0:25 | 도착: 본사 핀과 주소 카드, 직접 제작 · 택배 · 고객센터 안내, 천천히 한 바퀴 돌며 마무리 |

화면 위쪽에는 "본사까지 ○○ km" 남은 거리가 줄어들고, 지나가는 곳마다 이름표(북한산, 한강, 부천)가 붙습니다.

- 파일: `journey.html`, `journey.js`, 경로 · 자막 · 이름표 · 시간은 `config.json`의 `journey`
- 경로: `journey.route`의 각 점은 `[경도, 위도, 카메라 고도(m), 그 아래 지면 고도(m)]`. 산을 넘는 구간은 지형보다 충분히 높게 잡았습니다(높이 과장 `exaggeration` 1.5배).
- 지도: MapLibre GL JS(3D 지형) + Esri 여름 위성사진 + AWS 공개 지형 타일. 타일은 렌더링할 때 필요한 만큼 받아 `assets/tiles/`, `assets/dem/`에 저장합니다.

```bash
npm install                       # maplibre-gl
./scripts/build_journey.sh        # 세로 (h를 붙이면 가로 1920×1080)
```

3D 지도를 소프트웨어로 그리기 때문에 전체 렌더링에 20~30분쯤 걸립니다.
브라우저 미리보기: `node scripts/render_journey.js --serve 8765` 후 `http://127.0.0.1:8765/journey.html`

## 사용한 자료

- 상품 사진: suminmom.com 상품 페이지 이미지 (`assets/photos/`)
- 위성 이미지: Esri World Imagery Wayback, 2025-06-26 릴리스 (지도 장면 우측 하단에 출처 표기)
- 위치 좌표: OpenStreetMap (© OpenStreetMap contributors)
- 지형 고도(본사 찾아가는 길): Mapzen Terrain Tiles on AWS (SRTM, NASA, USGS 등)
- 3D 지도 라이브러리: MapLibre GL JS (BSD-3-Clause)
- 글꼴: Pretendard, 고운바탕(Gowun Batang), Cormorant Garamond — 모두 SIL Open Font License (`assets/fonts/LICENSE-*.txt`)
- 음악 · 효과음: 스크립트로 직접 합성
