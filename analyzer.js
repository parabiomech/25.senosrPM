// ========================================
// Wheelchair Mobility Analyzer
// Implements analysis algorithms for different test modes
// ========================================

class Analyzer {
    constructor() {
        this.resultsContainer = document.getElementById('analysisResults');
        this.annotations = [];
        this.metadata = null;
    }

    // ========================================
    // Butterworth Low-Pass Filter
    // ========================================
    butterworthFilter(data, cutoffFreq = 5, sampleRate = 100) {
        // Simple 2nd order Butterworth low-pass filter
        const omega = 2 * Math.PI * cutoffFreq / sampleRate;
        const k = Math.tan(omega / 2);
        const k2 = k * k;
        const norm = 1 / (1 + Math.sqrt(2) * k + k2);

        const b0 = k2 * norm;
        const b1 = 2 * b0;
        const b2 = b0;
        const a1 = 2 * (k2 - 1) * norm;
        const a2 = (1 - Math.sqrt(2) * k + k2) * norm;

        const filtered = [];
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

        for (let i = 0; i < data.length; i++) {
            const x0 = data[i];
            const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;

            filtered.push(y0);

            x2 = x1;
            x1 = x0;
            y2 = y1;
            y1 = y0;
        }

        return filtered;
    }

    // ========================================
    // Extract Event Segments from Annotations
    // ========================================
    extractEventSegments() {
        const annotations = AppState.sensorData.annotation || [];

        if (annotations.length < 6) {
            console.warn('Expected 6 annotation events, found:', annotations.length);
        }

        // Sort annotations by time
        const sortedAnnotations = [...annotations].sort((a, b) =>
            a.seconds_elapsed - b.seconds_elapsed
        );

        // Group into pairs (1-2, 3-4, 5-6)
        const segments = {
            straight: sortedAnnotations.length >= 2 ? {
                start: sortedAnnotations[0].seconds_elapsed,
                end: sortedAnnotations[1].seconds_elapsed
            } : null,
            turn: sortedAnnotations.length >= 4 ? {
                start: sortedAnnotations[2].seconds_elapsed,
                end: sortedAnnotations[3].seconds_elapsed
            } : null,
            wheelie: sortedAnnotations.length >= 6 ? {
                start: sortedAnnotations[4].seconds_elapsed,
                end: sortedAnnotations[5].seconds_elapsed
            } : null
        };

        return segments;
    }

    // ========================================
    // Filter data by time segment
    // ========================================
    filterDataBySegment(data, segment) {
        if (!segment || !data) return [];

        return data.filter(d =>
            d.seconds_elapsed >= segment.start &&
            d.seconds_elapsed <= segment.end
        );
    }

    // ========================================
    // Main Analysis Entry Point
    // ========================================
    analyze(mode) {
        const segments = this.extractEventSegments();
        let results = {};

        switch (mode) {
            case 'straight':
                results = this.analyzeStraightPush(segments.straight);
                break;
            case 'turn':
                results = this.analyzeTurn(segments.turn);
                break;
            case 'wheelie':
                results = this.analyzeWheelie(segments.wheelie);
                break;
        }

        // Add metadata info
        results.metadata = this.getMetadataInfo();

        AppState.analysisResults = results;
        this.displayResults(results);
    }

    // ========================================
    // Straight-Line Push Analysis (Event 1-2)
    // Uses: Accelerometer Y, Gyroscope Z
    // ========================================
    analyzeStraightPush(segment) {
        if (!segment) {
            return { error: 'Annotation 이벤트 1-2를 찾을 수 없습니다' };
        }

        const accelData = this.filterDataBySegment(AppState.sensorData.accelerometer, segment);
        const gyroData = this.filterDataBySegment(AppState.sensorData.gyroscope, segment);

        if (accelData.length === 0) {
            return { error: 'No accelerometer data in segment' };
        }

        // Extract Y values (forward/backward direction)
        const accelY = accelData.map(d => d.y || 0);

        // Apply Butterworth low-pass filter to remove noise
        const filteredY = this.butterworthFilter(accelY);

        // Calculate metrics
        const maxY = Math.max(...filteredY);
        const minY = Math.min(...filteredY);

        // Gyroscope Z for direction bias (left: +, right: -)
        const gyroZ = gyroData.map(d => d.z || 0);
        const avgGyroZ = gyroZ.reduce((sum, val) => sum + val, 0) / gyroZ.length;

        // Determine direction bias
        let directionBias = '중앙';
        let biasValue = Math.abs(avgGyroZ) * (180 / Math.PI); // Convert to degrees/s

        if (avgGyroZ > 0.05) {
            directionBias = '좌측 편향';
        } else if (avgGyroZ < -0.05) {
            directionBias = '우측 편향';
        }

        return {
            mode: '원스트로크 푸시 분석',
            segment: `${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`,
            metrics: [
                {
                    label: '최대 가속도 (앞)',
                    value: maxY.toFixed(3),
                    unit: 'm/s²'
                },
                {
                    label: '최소 가속도 (뒤)',
                    value: minY.toFixed(3),
                    unit: 'm/s²'
                },
                {
                    label: '방향 편향',
                    value: directionBias,
                    unit: ''
                },
                {
                    label: '편향 크기',
                    value: biasValue.toFixed(2),
                    unit: '°/s'
                },
                {
                    label: '데이터 포인트',
                    value: accelData.length,
                    unit: 'samples'
                }
            ]
        };
    }

    // ========================================
    // Turn Analysis (Event 3-4)
    // Uses: Gyroscope Z
    // ========================================
    analyzeTurn(segment) {
        if (!segment) {
            return { error: 'Annotation 이벤트 3-4를 찾을 수 없습니다' };
        }

        const gyroData = this.filterDataBySegment(AppState.sensorData.gyroscope, segment);

        if (gyroData.length === 0) {
            return { error: 'No gyroscope data in segment' };
        }

        // Gyroscope Z: + = left turn, - = right turn
        const gyroZ = gyroData.map(d => d.z || 0);

        // Separate left and right turns
        const leftTurnValues = gyroZ.filter(z => z > 0);
        const rightTurnValues = gyroZ.filter(z => z < 0).map(z => Math.abs(z));

        // Calculate average angular velocities
        const leftAngVel = leftTurnValues.length > 0
            ? leftTurnValues.reduce((sum, val) => sum + val, 0) / leftTurnValues.length
            : 0;
        const rightAngVel = rightTurnValues.length > 0
            ? rightTurnValues.reduce((sum, val) => sum + val, 0) / rightTurnValues.length
            : 0;

        // Convert to degrees/s
        const leftAngVelDeg = leftAngVel * (180 / Math.PI);
        const rightAngVelDeg = rightAngVel * (180 / Math.PI);

        // Calculate balance (difference between left and right)
        const balanceDiff = Math.abs(leftAngVelDeg - rightAngVelDeg);
        const lowerSide = leftAngVelDeg < rightAngVelDeg ? '좌측' : '우측';

        return {
            mode: '회전 분석',
            segment: `${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`,
            metrics: [
                {
                    label: '좌측 회전 각속도',
                    value: leftAngVelDeg.toFixed(2),
                    unit: '°/s'
                },
                {
                    label: '우측 회전 각속도',
                    value: rightAngVelDeg.toFixed(2),
                    unit: '°/s'
                },
                {
                    label: '회전 균형 (낮은 방향)',
                    value: lowerSide,
                    unit: ''
                },
                {
                    label: '좌우 차이',
                    value: balanceDiff.toFixed(2),
                    unit: '°/s'
                },
                {
                    label: '데이터 포인트',
                    value: gyroData.length,
                    unit: 'samples'
                }
            ]
        };
    }

    // ========================================
    // Wheelie Stability Analysis (Event 5-6)
    // Uses: Gyroscope X
    // ========================================
    analyzeWheelie(segment) {
        if (!segment) {
            return { error: 'Annotation 이벤트 5-6을 찾을 수 없습니다' };
        }

        const gyroData = this.filterDataBySegment(AppState.sensorData.gyroscope, segment);

        if (gyroData.length === 0) {
            return { error: 'No gyroscope data in segment' };
        }

        // Gyroscope X: + = front wheel up, - = front wheel down
        const gyroX = gyroData.map(d => d.x || 0);
        const timestamps = gyroData.map(d => d.seconds_elapsed);

        // Find peaks (front wheel up: positive peak, down: negative peak)
        let maxPeakIdx = 0;
        let minPeakIdx = 0;
        let maxPeakValue = gyroX[0];
        let minPeakValue = gyroX[0];

        for (let i = 0; i < gyroX.length; i++) {
            if (gyroX[i] > maxPeakValue) {
                maxPeakValue = gyroX[i];
                maxPeakIdx = i;
            }
            if (gyroX[i] < minPeakValue) {
                minPeakValue = gyroX[i];
                minPeakIdx = i;
            }
        }

        // Time between peaks
        const timeBetweenPeaks = Math.abs(timestamps[maxPeakIdx] - timestamps[minPeakIdx]);

        // Calculate CV (Coefficient of Variation) for the hold phase
        // Hold phase is between the two peaks
        const startIdx = Math.min(maxPeakIdx, minPeakIdx);
        const endIdx = Math.max(maxPeakIdx, minPeakIdx);

        const holdPhaseData = gyroX.slice(startIdx, endIdx + 1);

        if (holdPhaseData.length > 1) {
            const mean = holdPhaseData.reduce((sum, val) => sum + val, 0) / holdPhaseData.length;
            const variance = holdPhaseData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / holdPhaseData.length;
            const stdDev = Math.sqrt(variance);
            const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

            return {
                mode: '휠리 안정성 분석',
                segment: `${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`,
                metrics: [
                    {
                        label: '앞바퀴 들기 피크',
                        value: (maxPeakValue * 180 / Math.PI).toFixed(2),
                        unit: '°/s'
                    },
                    {
                        label: '앞바퀴 내리기 피크',
                        value: (minPeakValue * 180 / Math.PI).toFixed(2),
                        unit: '°/s'
                    },
                    {
                        label: '피크 간 시간',
                        value: timeBetweenPeaks.toFixed(3),
                        unit: 's'
                    },
                    {
                        label: '유지 구간 CV',
                        value: cv.toFixed(2),
                        unit: '%'
                    },
                    {
                        label: '유지 구간 포인트',
                        value: holdPhaseData.length,
                        unit: 'samples'
                    }
                ]
            };
        } else {
            return {
                mode: '휠리 안정성 분석',
                segment: `${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s`,
                metrics: [
                    {
                        label: '오류',
                        value: '유지 구간 데이터 부족',
                        unit: ''
                    }
                ]
            };
        }
    }

    // ========================================
    // Get Metadata Information
    // ========================================
    getMetadataInfo() {
        const metadata = AppState.sensorData.metadata;

        if (!metadata || metadata.length === 0) {
            return null;
        }

        const info = metadata[0];

        return {
            device: info['device name'] || 'Unknown',
            platform: info.platform || 'Unknown',
            appVersion: info.appVersion || 'Unknown',
            recordingTime: info['recording time'] || 'Unknown',
            sensors: info.sensors ? info.sensors.split('|').join(', ') : 'Unknown'
        };
    }

    // ========================================
    // Display Results
    // ========================================
    displayResults(results) {
        if (results.error) {
            this.resultsContainer.innerHTML = `
                <div class="placeholder">${results.error}</div>
            `;
            return;
        }

        let html = '';

        // Display segment info
        if (results.segment) {
            html += `
                <div class="result-item segment-info">
                    <div class="label">분석 구간</div>
                    <div class="value">${results.segment}</div>
                </div>
            `;
        }

        // Display metrics
        if (results.metrics) {
            results.metrics.forEach(metric => {
                html += `
                    <div class="result-item">
                        <div class="label">${metric.label}</div>
                        <div class="value">
                            ${metric.value}
                            ${metric.unit ? `<span class="unit">${metric.unit}</span>` : ''}
                        </div>
                    </div>
                `;
            });
        }

        this.resultsContainer.innerHTML = html;

        // Display metadata in left panel
        if (results.metadata) {
            this.displayMetadata(results.metadata);
        }
    }

    // ========================================
    // Display Metadata in Left Panel
    // ========================================
    displayMetadata(metadata) {
        const container = document.getElementById('metadataInfo');
        if (!container) return;

        container.innerHTML = `
            <div class="result-item">
                <div class="label">기기</div>
                <div class="value">${metadata.device}</div>
            </div>
            <div class="result-item">
                <div class="label">플랫폼</div>
                <div class="value">${metadata.platform}</div>
            </div>
            <div class="result-item">
                <div class="label">측정 시간</div>
                <div class="value">${metadata.recordingTime}</div>
            </div>
        `;
    }

    // ========================================
    // Helper: Filter data by time range
    // ========================================
    filterDataByTime(data, startTime, endTime) {
        if (!data || !Array.isArray(data)) return [];
        return data.filter(d =>
            d.seconds_elapsed >= startTime &&
            d.seconds_elapsed <= endTime
        );
    }

    // ========================================
    // Raw data analysis for performance metrics
    // ========================================
    analyzeStraightPushData(accelData, gyroData) {
        if (!accelData || accelData.length === 0) return null;

        const accelY = accelData.map(d => d.y || 0);
        const filteredY = this.butterworthFilter(accelY);

        const maxAccelY = Math.max(...filteredY);

        // Gyroscope Z for direction bias
        let biasAvg = 0;
        let biasDirection = '중앙';
        if (gyroData && gyroData.length > 0) {
            const gyroZ = gyroData.map(d => d.z || 0);
            biasAvg = gyroZ.reduce((sum, val) => sum + val, 0) / gyroZ.length;
            biasDirection = biasAvg > 0.05 ? '좌측' : (biasAvg < -0.05 ? '우측' : '중앙');
        }

        return {
            maxAccelY: maxAccelY,
            biasAvg: biasAvg,
            biasDirection: biasDirection
        };
    }

    analyzeTurnData(gyroData) {
        if (!gyroData || gyroData.length === 0) return null;

        const gyroZ = gyroData.map(d => d.z || 0);

        // Find MAX values for left (+) and right (-) turns
        const leftTurnValues = gyroZ.filter(z => z > 0);
        const rightTurnValues = gyroZ.filter(z => z < 0);

        const leftMaxAngVel = leftTurnValues.length > 0 ? Math.max(...leftTurnValues) : 0;
        const rightMaxAngVel = rightTurnValues.length > 0 ? Math.abs(Math.min(...rightTurnValues)) : 0;

        // Balance: difference and direction
        const balanceDiff = leftMaxAngVel - rightMaxAngVel;
        const weakerSide = balanceDiff > 0 ? '우측' : (balanceDiff < 0 ? '좌측' : '균등');

        return {
            leftMaxAngVel: leftMaxAngVel,
            rightMaxAngVel: rightMaxAngVel,
            balanceDiff: balanceDiff,
            weakerSide: weakerSide
        };
    }

    analyzeWheelieData(gyroData) {
        if (!gyroData || gyroData.length === 0) return null;

        const gyroX = gyroData.map(d => d.x || 0);
        const timestamps = gyroData.map(d => d.seconds_elapsed);

        // Find peaks
        let maxPeakIdx = 0, minPeakIdx = 0;
        let maxPeakValue = gyroX[0], minPeakValue = gyroX[0];

        for (let i = 0; i < gyroX.length; i++) {
            if (gyroX[i] > maxPeakValue) {
                maxPeakValue = gyroX[i];
                maxPeakIdx = i;
            }
            if (gyroX[i] < minPeakValue) {
                minPeakValue = gyroX[i];
                minPeakIdx = i;
            }
        }

        const timeBetweenPeaks = Math.abs(timestamps[maxPeakIdx] - timestamps[minPeakIdx]);

        return {
            maxPeak: maxPeakValue,
            minPeak: minPeakValue,
            peakToPeakTime: timeBetweenPeaks
        };
    }

    // ========================================
    // Calculate overall performance metrics (raw values, not normalized)
    // ========================================
    calculatePerformanceMetrics() {
        const segments = this.extractEventSegments();
        const results = {
            straight: null,
            turn: null,
            wheelie: null
        };

        // Analyze all modes
        if (segments.straight) {
            const accelData = this.filterDataByTime(
                AppState.sensorData.accelerometer,
                segments.straight.start,
                segments.straight.end
            );
            const gyroData = this.filterDataByTime(
                AppState.sensorData.gyroscope,
                segments.straight.start,
                segments.straight.end
            );
            results.straight = this.analyzeStraightPushData(accelData, gyroData);
        }

        if (segments.turn) {
            const gyroData = this.filterDataByTime(
                AppState.sensorData.gyroscope,
                segments.turn.start,
                segments.turn.end
            );
            results.turn = this.analyzeTurnData(gyroData);
        }

        if (segments.wheelie) {
            const gyroData = this.filterDataByTime(
                AppState.sensorData.gyroscope,
                segments.wheelie.start,
                segments.wheelie.end
            );
            results.wheelie = this.analyzeWheelieData(gyroData);
        }

        // Return raw metrics for display
        const metrics = {
            추진능력: {
                label: '추진능력',
                value: results.straight ? results.straight.maxAccelY.toFixed(2) : '-',
                unit: 'm/s²',
                description: '최대 가속도'
            },
            직진성: {
                label: '직진성',
                value: results.straight ? (Math.abs(results.straight.biasAvg) * (180 / Math.PI)).toFixed(2) : '-',
                unit: '°/s',
                direction: results.straight ? results.straight.biasDirection : '중앙',
                description: 'Gyro Z 평균'
            },
            좌측회전능력: {
                label: '좌측회전능력',
                value: results.turn ? (results.turn.leftMaxAngVel * (180 / Math.PI)).toFixed(1) : '-',
                unit: '°/s',
                description: 'Gyro Z+ 최대'
            },
            우측회전능력: {
                label: '우측회전능력',
                value: results.turn ? (results.turn.rightMaxAngVel * (180 / Math.PI)).toFixed(1) : '-',
                unit: '°/s',
                description: 'Gyro Z- 최대'
            },
            회전균형: {
                label: '회전균형',
                value: results.turn ? (Math.abs(results.turn.balanceDiff) * (180 / Math.PI)).toFixed(1) : '-',
                unit: '°/s',
                direction: results.turn ? results.turn.weakerSide : '-',
                description: '좌우 차이'
            },
            안정성: {
                label: '안정성',
                value: results.wheelie ? results.wheelie.peakToPeakTime.toFixed(2) : '-',
                unit: 's',
                description: '피크-피크 시간'
            }
        };

        return metrics;
    }
}
