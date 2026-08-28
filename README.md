# Shadow Puzzle Prototype

그림자 생성과 위치 교환을 검증하는 Stage 1 정적 웹 프로토타입입니다.

## 현재 규칙

- 격자 표시 및 4방향 이동
- 그림자 생성 범위: 체비쇼프 거리 정확히 2
- 중간 벽과 무관하게 생성 가능
- 목적지가 벽 또는 장애물이면 생성 불가
- 그림자 생성과 스왑은 각각 1턴 소비
- 그림자는 생성 직후 6턴 유지
- 출구 도착 시 스테이지 클리어

별도 빌드 과정이나 서버가 필요 없습니다. `index.html`을 열거나 GitHub Pages로 배포하면 실행됩니다.

## GitHub Pages

저장소의 **Settings → Pages → Build and deployment**에서 Source를 **Deploy from a branch**, Branch를 **main / (root)**로 지정하면 됩니다.
