# 휠체어 이동성 분석 시스템 매뉴얼

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [측정 프로토콜](#측정-프로토콜)
3. [분석 알고리즘](#분석-알고리즘)
4. [성능 지표](#성능-지표)
5. [사용 방법](#사용-방법)
6. [데이터 해석](#데이터-해석)

---

## 🎯 시스템 개요

### 목적
수동 휠체어 사용자의 이동 능력을 **객관적으로 평가**하고 **성능 개선 방향**을 제시하기 위한 센서 기반 분석 시스템

### 주요 기능
- **3가지 테스트 모드**: 직진 푸시, 회전, 휠리
- **실시간 3D 시각화**: 휠체어 움직임 재현
- **6가지 성능 지표**: 추진능력, 직진성, 회전능력, 균형, 안정성
- **상세 분석 리포트**: 구간별 센서 데이터 분석

### 기술 스택
- **센서**: 가속도계, 자이로스코프, 오리엔테이션
- **플랫폼**: SensorLogger 앱 (iOS/Android)
- **샘플링**: 100Hz
- **필터링**: 2차 Butterworth 저역통과 필터 (5Hz)

---

## 📱 측정 프로토콜

### 1. 사전 준비

#### 장비
- 스마트폰 + SensorLogger 앱 설치
- 휠체어 좌석 중앙에 스마트폰 고정
- 수평 유지 (화면이 위를 향하도록)

#### 좌표계 설정
```
X축 (빨강): 좌우 방향 (+ = 오른쪽, - = 왼쪽)
Y축 (초록): 전후 방향 (+ = 앞, - = 뒤)
Z축 (파랑): 상하 방향 (+ = 위, - = 아래)
```

### 2. 측정 순서

#### ① 직진 푸시 (Straight Push)
**목적**: 추진능력과 직진성 평가

1. **시작 위치**: 직선 경로 (최소 5m)
2. **측정**:
   - `Annotation` 이벤트 1 입력 (시작)
   - 최대 힘으로 1회 푸시
   - `Annotation` 이벤트 2 입력 (종료)
3. **주의사항**: 한 번의 강한 푸시만 수행 (여러 번 X)

#### ② 회전 (Turn)
**목적**: 좌우 회전 능력 평가

1. **시작 위치**: 제자리 또는 넓은 공간
2. **측정**:
   - `Annotation` 이벤트 3 입력 (시작)
   - 좌회전 1회 (90-180°)
   - 우회전 1회 (90-180°)
   - `Annotation` 이벤트 4 입력 (종료)
3. **주의사항**: 좌우 회전을 **모두 포함**해야 함

#### ③ 휠리 (Wheelie)
**목적**: 균형 유지 능력 평가

1. **시작 위치**: 평평한 지면
2. **측정**:
   - `Annotation` 이벤트 5 입력 (시작)
   - 휠리 자세로 앞바퀴 들기
   - 1-2초 유지
   - 앞바퀴 내리기
   - `Annotation` 이벤트 6 입력 (종료)
3. **주의사항**: 유지 구간이 있어야 정확한 분석 가능

### 3. 데이터 수집
- SensorLogger에서 **Export** → CSV 형식 저장
- 필수 센서: `Accelerometer.csv`, `Gyroscope.csv`, `Orientation.csv`, `Annotation.csv`
- 선택 센서: `Metadata.csv` (기기 정보)

---

## 🔬 분석 알고리즘

### 1. 직진 푸시 분석

#### 사용 센서
- **Accelerometer Y**: 전후 가속도
- **Gyroscope Z**: 회전 각속도 (좌우 편향)

#### 신호 처리
```javascript
// 1. 데이터 추출
accelY = data.map(d => d.y)

// 2. 노이즈 제거 (Butterworth Filter)
filtered = butterworthFilter(accelY, cutoff=5Hz, fs=100Hz)

// 3. 전달 함수 (Transfer Function)
H(s) = ω_c² / (s² + √2·ω_c·s + ω_c²)
where ω_c = 2π × 5Hz
```

#### 계산 지표
```javascript
// 추진능력: 최대 전방 가속도
maxAccelY = max(filteredY)  // m/s²

// 직진성: Gyro Z 평균 (편향 방향)
avgGyroZ = mean(gyroZ)  // rad/s
biasDirection = {
  '좌측 편향': avgGyroZ > 0.05
  '우측 편향': avgGyroZ < -0.05
  '중앙': otherwise
}
```

#### 수식
$$
\text{추진능력} = \max(\text{accel}_y)
$$

$$
\text{직진성} = \left| \frac{1}{N} \sum_{i=1}^{N} \text{gyro}_z(i) \right| \times \frac{180}{\pi} \quad [\degree/s]
$$

---

### 2. 회전 분석

#### 사용 센서
- **Gyroscope Z**: 요(Yaw) 각속도 (+ = 좌회전, - = 우회전)

#### 분석 방법
```javascript
// 1. 좌우 회전 분리
leftTurnValues = gyroZ.filter(z => z > 0)
rightTurnValues = gyroZ.filter(z => z < 0).map(abs)

// 2. 최대 각속도 계산
leftMaxAngVel = max(leftTurnValues)   // rad/s
rightMaxAngVel = max(rightTurnValues) // rad/s

// 3. 균형 평가
balanceDiff = abs(leftMaxAngVel - rightMaxAngVel)
weakerSide = leftMaxAngVel < rightMaxAngVel ? '좌측' : '우측'
```

#### 수식
$$
\omega_{\text{left}} = \max(\text{gyro}_z > 0)
$$

$$
\omega_{\text{right}} = \max(|\text{gyro}_z < 0|)
$$

$$
\Delta\omega = |\omega_{\text{left}} - \omega_{\text{right}}| \times \frac{180}{\pi} \quad [\degree/s]
$$

---

### 3. 휠리 안정성 분석

#### 사용 센서
- **Gyroscope X**: 피치(Pitch) 각속도 (+ = 앞바퀴 들기, - = 앞바퀴 내리기)

#### 피크 검출
```javascript
// 1. 피크 찾기
maxPeakIdx = argmax(gyroX)  // 앞바퀴 들기
minPeakIdx = argmin(gyroX)  // 앞바퀴 내리기

// 2. 피크 간 시간 (안정성 지표)
peakToPeakTime = |timestamps[maxPeakIdx] - timestamps[minPeakIdx]|  // seconds

// 3. 유지 구간 변동성 (CV)
holdPhase = gyroX[min(maxIdx, minIdx) : max(maxIdx, minIdx)]
CV = (stddev(holdPhase) / |mean(holdPhase)|) × 100  // %
```

#### 수식
$$
T_{\text{stability}} = |t_{\max} - t_{\min}| \quad [s]
$$

$$
CV = \frac{\sigma}{\mu} \times 100 \quad [\%]
$$

where:
- $\sigma$ = 유지 구간 표준편차
- $\mu$ = 유지 구간 평균

---

## 📊 성능 지표

### 종합 퍼포먼스 (6개 지표)

| 지표 | 센서 | 계산식 | 단위 | 의미 |
|------|------|--------|------|------|
| **추진능력** | Accel Y | $\max(\text{accel}_y)$ | m/s² | 추진 힘의 크기 (↑ 좋음) |
| **직진성** | Gyro Z | $\|\overline{\text{gyro}_z}\| \times \frac{180}{\pi}$ | °/s | 직진 시 편향 (↓ 좋음) |
| **좌측회전** | Gyro Z | $\max(\text{gyro}_z > 0) \times \frac{180}{\pi}$ | °/s | 좌회전 각속도 (↑ 좋음) |
| **우측회전** | Gyro Z | $\max(\|\text{gyro}_z < 0\|) \times \frac{180}{\pi}$ | °/s | 우회전 각속도 (↑ 좋음) |
| **회전균형** | Gyro Z | $\|\omega_L - \omega_R\|$ | °/s | 좌우 차이 (↓ 좋음) |
| **안정성** | Gyro X | $\|t_{\text{peak}} - t_{\text{trough}}\|$ | s | 휠리 유지 시간 (↑ 좋음) |

### 평가 기준 (예시)

#### 추진능력 (m/s²)
- 우수: > 3.0
- 양호: 2.0 - 3.0
- 보통: 1.0 - 2.0
- 부족: < 1.0

#### 직진성 (°/s)
- 우수: < 5.0
- 양호: 5.0 - 10.0
- 보통: 10.0 - 20.0
- 개선 필요: > 20.0

#### 회전균형 (°/s)
- 균등: < 10.0
- 약간 불균형: 10.0 - 30.0
- 불균형: > 30.0

#### 안정성 (s)
- 우수: > 2.0
- 양호: 1.0 - 2.0
- 보통: < 1.0

---

## 💻 사용 방법

### 1. 데이터 업로드
1. 웹 브라우저에서 `index.html` 열기
2. **"📁 데이터 업로드"** 영역 클릭 또는 드래그
3. SensorLogger CSV 파일들 선택 (다중 선택 가능)
4. 자동 파싱 및 로딩

### 2. 테스트 모드 선택
- **직진 푸시** (➡️): Event 1-2 분석
- **회전** (🔄): Event 3-4 분석
- **휠리** (⚖️): Event 5-6 분석

### 3. 재생 및 시각화
- **▶️ 재생**: 3D 애니메이션 시작
- **⏸️ 일시정지**: 현재 프레임에서 정지
- **🔄 리셋**: 세그먼트 시작으로 이동
- **재생 속도**: 0.1x - 3.0x 조절 가능
- **프로그레스 바**: 드래그하여 특정 시점 이동

### 4. 3D 뷰 컨트롤
| 조작 | 기능 |
|------|------|
| 오른쪽 마우스 드래그 | 3D 회전 |
| 마우스 휠 | 확대/축소 |
| 왼쪽 마우스 드래그 | 이동(팬) |
| 🔽 버튼 | 수평면 (Top View) |
| ➡️ 버튼 | 측면 (Side View) |
| ⬆️ 버튼 | 정면 (Front View) |
| 🔄 버튼 | 시점 리셋 |

### 5. 결과 확인
- **📊 분석 결과**: 선택한 모드의 상세 지표
- **📈 센서 데이터 그래프**: 가속도/각속도/오리엔테이션 시계열
- **🎯 종합 퍼포먼스**: 6가지 성능 지표 한눈에 비교

---

## 📖 데이터 해석

### 직진 푸시 결과 해석

#### 예시 출력
```
분석 구간: 5.23s - 7.45s
최대 가속도 (앞): 2.84 m/s²
최소 가속도 (뒤): -0.52 m/s²
방향 편향: 좌측 편향
편향 크기: 12.3 °/s
```

#### 해석
- **추진능력 우수**: 최대 가속도 2.84 m/s² (>2.0)
- **직진성 개선 필요**: 좌측으로 12.3°/s 편향 (>10.0)
- **개선 방향**: 우측 팔 힘 강화 또는 좌측 제어 개선

---

### 회전 결과 해석

#### 예시 출력
```
분석 구간: 10.12s - 15.67s
좌측 회전 각속도: 45.2 °/s
우측 회전 각속도: 38.7 °/s
회전 균형 (낮은 방향): 우측
좌우 차이: 6.5 °/s
```

#### 해석
- **좌회전 양호**: 45.2°/s
- **우회전 약간 낮음**: 38.7°/s
- **균형 우수**: 차이 6.5°/s (<10.0)
- **개선 방향**: 우측 회전 연습 권장

---

### 휠리 결과 해석

#### 예시 출력
```
분석 구간: 20.45s - 23.12s
앞바퀴 들기 피크: 125.3 °/s
앞바퀴 내리기 피크: -98.7 °/s
피크 간 시간: 1.85 s
유지 구간 CV: 15.2 %
```

#### 해석
- **안정성 양호**: 1.85초 유지
- **변동성 중간**: CV 15.2%
- **개선 방향**: 유지 시간 늘리기 (목표 2.0s+)

---

## 🔧 기술 세부사항

### Butterworth 필터 구현
```javascript
// 2차 저역통과 필터
cutoffFreq = 5 Hz
sampleRate = 100 Hz
ω_c = 2π × 5 / 100

// 이산화 (Bilinear Transform)
k = tan(ω_c / 2)
norm = 1 / (1 + √2·k + k²)

// 계수 계산
b0 = k² × norm
b1 = 2 × b0
b2 = b0
a1 = 2(k² - 1) × norm
a2 = (1 - √2·k + k²) × norm

// 재귀 필터링
y[n] = b0·x[n] + b1·x[n-1] + b2·x[n-2] - a1·y[n-1] - a2·y[n-2]
```

### 좌표계 캘리브레이션
```javascript
// 각 세그먼트 시작 시 초기 오리엔테이션을 0으로 설정
initialQuaternion = Q(qw, qx, qy, qz) at frame[0]
calibrationQuat = initialQuaternion.inverse()

// 이후 프레임
currentQuat = Q(qw, qx, qy, qz) at frame[i]
calibratedQuat = calibrationQuat × currentQuat
```

---

## 📝 FAQ

### Q1. 측정 중 이벤트를 잘못 눌렀어요
**A**: 측정을 다시 시작하세요. 정확한 구간 설정이 중요합니다.

### Q2. 그래프가 너무 노이즈가 많아요
**A**: 정상입니다. Butterworth 필터(5Hz)가 자동으로 적용되어 분석됩니다.

### Q3. 3D 휠체어 위치가 이상해요
**A**: 위치는 **시각화 참고용**입니다. 가속도 적분 드리프트로 정확하지 않을 수 있습니다.

### Q4. 직진 푸시를 여러 번 했는데 분석이 안돼요
**A**: 직진 푸시는 **1회만** 수행해야 합니다. 최대 힘의 단일 푸시를 측정하세요.

### Q5. 휠리 분석에서 "유지 구간 부족" 에러가 나와요
**A**: 앞바퀴를 들고 **1-2초 유지** 후 내려야 합니다. 너무 빨리 내리면 안됩니다.

---

## 📚 참고 문헌

1. **Butterworth Filter**: Butterworth, S. (1930). "On the Theory of Filter Amplifiers"
2. **Wheelchair Biomechanics**: van der Woude, L.H.V. et al. (2001). "Manual wheelchair propulsion"
3. **IMU Sensor Fusion**: Madgwick, S.O.H. (2010). "An efficient orientation filter for IMU"
4. **Mobility Assessment**: Kirby, R.L. et al. (2004). "Wheelchair Skills Test"

---

## 📞 문의

**개발**: Wheelchair Mobility Analysis Team  
**버전**: 1.0.0  
**최종 업데이트**: 2025-12-24

---

## 📄 라이선스

이 시스템은 연구 및 임상 목적으로 사용할 수 있습니다.

---

## 🎓 사용 예시

### 임상 평가 워크플로우
1. **사전 평가** (Baseline)
   - 3가지 테스트 수행
   - 성능 지표 기록
   
2. **훈련 프로그램** (4-8주)
   - 약점 지표 집중 훈련
   - 주 2-3회 측정
   
3. **사후 평가** (Post-training)
   - 동일 테스트 재수행
   - 개선도 비교 분석

### 데이터 기록 템플릿
```
환자 ID: _______
측정 날짜: _______

[ 직진 푸시 ]
- 추진능력: _____ m/s²
- 직진성: _____ °/s (방향: _____)

[ 회전 ]
- 좌회전: _____ °/s
- 우회전: _____ °/s
- 균형도: _____ °/s

[ 휠리 ]
- 안정성: _____ s
- CV: _____ %

종합 소견:
_________________________
```

---

**⚠️ 중요**: 이 시스템은 보조 도구입니다. 임상적 판단은 전문가의 평가가 우선입니다.
