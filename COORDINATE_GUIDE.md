# 좌표계 확인 가이드

## 현재 설정

### 커스텀 축 (Custom Axes)
- **빨간색 선 = Z축**: 센서 X 데이터 매핑
- **녹색 선 = Y축**: 센서 Y 데이터 매핑 (휠체어가 이 방향을 향함)
- **파란색 선 = X축**: 센서 Z 데이터 매핑

### 휠체어 방향
- 녹색 Y축 방향을 향하도록 90도 회전됨
- `wheelchairGroup.rotation.z = -Math.PI / 2`

### 데이터 매핑
```javascript
// X axis (Blue): sensor Z
this.wheelchair.position.x += (accelData[frame].z || 0) * scale * dt;

// Y axis (Green): sensor Y
this.wheelchair.position.y += (accelData[frame].y || 0) * scale * dt;

// Z axis (Red): sensor X
this.wheelchair.position.z += (accelData[frame].x || 0) * scale * dt;
```

## 확인 방법

1. **브라우저 새로고침**: Ctrl+F5
2. **파일 업로드**: 5개 CSV 파일 선택
3. **3D 뷰 확인**:
   - 중앙에서 3개의 선이 보여야 함
   - 빨간색 선 (Z축)
   - 녹색 선 (Y축) - 휠체어가 이 방향을 향함
   - 파란색 선 (X축)

4. **휠체어 방향 확인**:
   - 휠체어가 녹색 선 방향을 향하는지 확인
   - 휠체어의 앞부분이 녹색 Y축을 따라 정렬되어야 함

5. **재생 테스트**:
   - 직진 푸시 모드 선택
   - 재생 버튼 클릭
   - 휠체어가 녹색 Y축 방향으로 이동하는지 확인

## 문제 해결

### 축이 보이지 않는 경우
- Ctrl+F5로 강력 새로고침
- 브라우저 콘솔(F12)에서 에러 확인

### 휠체어 방향이 이상한 경우
- visualizer.js 파일의 rotation.z 값 확인
- 현재: `wheelchairGroup.rotation.z = -Math.PI / 2`

### 움직임 방향이 이상한 경우
- position 매핑 확인:
  - X (Blue) ← sensor Z
  - Y (Green) ← sensor Y
  - Z (Red) ← sensor X
