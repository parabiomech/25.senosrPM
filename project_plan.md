# ♿ Wheelchair Mobility Analyzer (Web-based)

## 1. 프로젝트 개요
이 프로젝트는 **SensorLogger** 앱에서 수집된 데이터를 웹 브라우저상에서 분석하고 시각화하는 도구입니다. 별도의 서버 없이 브라우저의 연산 능력(Client-side)만을 사용하여 구동되며, GitHub Pages를 통해 무료로 배포할 수 있도록 설계되었습니다.

### 주요 기능
1. **데이터 업로드**: SensorLogger CSV 파일 파싱.
2. **3D 시각화**: Three.js를 이용한 웹 기반 3D 재생 (휠체어 움직임 재현).
3. **모빌리티 테스트 분석**:
    - **직진 푸시 (Straight)**: 최대 가속도, 도달 시간, 가속 면적(Impulse) 계산.
    - **회전 (Turn)**: 최대 회전 속도, 회전 가속도 계산.
    - **휠리 (Wheelie)**: 휠리 유지 구간 감지, 피치(Pitch) 각도 흔들림(안정성) 분석.

---

## 2. 기술 스택 (Lightweight)
복잡한 설치 없이 CDN 링크로 바로 사용할 수 있는 라이브러리들을 사용합니다.

- **Language**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **3D Engine**: [Three.js](https://threejs.org/) (가볍고 웹 표준인 WebGL 라이브러리)
- **Chart**: [Chart.js](https://www.chartjs.org/) (가속도/각속도 그래프 시각화)
- **CSV Parser**: [PapaParse](https://www.papaparse.com/) (빠르고 강력한 브라우저용 CSV 파서)
- **Hosting**: GitHub Pages

---

## 3. 프로젝트 폴더 구조 (VS Code)
```text
/wheelchair-analyzer
├── index.html          # 메인 UI 구조
├── style.css           # 스타일링 (레이아웃, 대시보드 디자인)
├── app.js              # 메인 로직 (파일 업로드, 차트 제어)
├── analyzer.js         # 3가지 테스트 알고리즘 (수학적 계산)
├── visualizer.js       # Three.js 관련 3D 렌더링 로직
└── assets/
    └── wheelchair.obj  # (선택사항) 간단한 3D 모델 파일, 없으면 박스로 대체