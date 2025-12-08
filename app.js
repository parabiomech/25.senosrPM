// ========================================
// Global State Management
// ========================================
const AppState = {
    sensorData: {
        accelerometer: [],
        gyroscope: [],
        orientation: [],
        totalAcceleration: [],
        annotation: [],
        metadata: []
    },
    currentMode: 'straight',
    currentSegment: null,
    segmentStartFrame: 0,
    segmentEndFrame: 0,
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 0,
    playbackSpeed: 1.0,
    animationId: null,
    charts: {},
    analysisResults: null
};

// ========================================
// File Upload & Parsing
// ========================================
class FileHandler {
    constructor() {
        this.fileInput = document.getElementById('csvFileInput');
        this.uploadLabel = document.querySelector('.upload-label');
        this.fileInfo = document.getElementById('fileInfo');

        this.initEventListeners();
    }

    initEventListeners() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop support
        this.uploadLabel.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadLabel.style.borderColor = 'var(--primary-light)';
        });

        this.uploadLabel.addEventListener('dragleave', () => {
            this.uploadLabel.style.borderColor = 'var(--primary-color)';
        });

        this.uploadLabel.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadLabel.style.borderColor = 'var(--primary-color)';
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processFiles(files);
            }
        });
    }

    async handleFileSelect(event) {
        const files = event.target.files;
        if (files.length > 0) {
            await this.processFiles(files);
        }
    }

    async processFiles(files) {
        showLoading('Processing files...');

        try {
            // Process all files
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                if (file.name.endsWith('.zip')) {
                    await this.handleZipFile(file);
                } else if (file.name.endsWith('.csv')) {
                    await this.handleCsvFile(file);
                } else {
                    console.warn(`Skipping unsupported file: ${file.name}`);
                }
            }

            this.updateFileInfo(files);
            this.enableControls();
            hideLoading();

        } catch (error) {
            console.error('Error processing files:', error);
            alert('Error processing files: ' + error.message);
            hideLoading();
        }
    }

    async handleZipFile(file) {
        // For ZIP files, we'll need JSZip library
        // For now, show an error message
        throw new Error('ZIP file support requires JSZip library. Please upload individual CSV files or extract the ZIP first.');
    }

    async handleCsvFile(file) {
        const text = await file.text();
        const fileName = file.name.toLowerCase();

        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (fileName.includes('accelerometer') && !fileName.includes('uncalibrated')) {
                        AppState.sensorData.accelerometer = results.data;
                    } else if (fileName.includes('gyroscope') && !fileName.includes('uncalibrated')) {
                        AppState.sensorData.gyroscope = results.data;
                    } else if (fileName.includes('orientation')) {
                        AppState.sensorData.orientation = results.data;
                    } else if (fileName.includes('totalacceleration')) {
                        AppState.sensorData.totalAcceleration = results.data;
                    } else if (fileName.includes('annotation')) {
                        AppState.sensorData.annotation = results.data;
                    } else if (fileName.includes('metadata')) {
                        AppState.sensorData.metadata = results.data;
                    }

                    // Update total frames based on the longest dataset
                    AppState.totalFrames = Math.max(
                        AppState.sensorData.accelerometer.length,
                        AppState.sensorData.gyroscope.length,
                        AppState.sensorData.orientation.length
                    );

                    resolve();
                },
                error: (error) => reject(error)
            });
        });
    }

    updateFileInfo(files) {
        const fileCount = files.length || 0;
        const fileNames = Array.from(files).map(f => f.name).join(', ');

        const counts = {
            accelerometer: AppState.sensorData.accelerometer.length,
            gyroscope: AppState.sensorData.gyroscope.length,
            orientation: AppState.sensorData.orientation.length,
            annotation: AppState.sensorData.annotation.length,
            metadata: AppState.sensorData.metadata.length
        };

        this.fileInfo.innerHTML = `
            <strong>Loaded ${fileCount} file(s)</strong><br>
            <div style="margin-top: 8px; font-size: 0.8rem;">
                ${counts.accelerometer > 0 ? `✓ Accelerometer: ${counts.accelerometer}<br>` : ''}
                ${counts.gyroscope > 0 ? `✓ Gyroscope: ${counts.gyroscope}<br>` : ''}
                ${counts.orientation > 0 ? `✓ Orientation: ${counts.orientation}<br>` : ''}
                ${counts.annotation > 0 ? `✓ Annotation: ${counts.annotation}<br>` : ''}
                ${counts.metadata > 0 ? `✓ Metadata: ${counts.metadata}` : ''}
            </div>
        `;
    }

    enableControls() {
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = false;
        document.getElementById('resetBtn').disabled = false;

        // Initialize charts with loaded data
        chartManager.initializeCharts();

        // Initialize 3D visualization
        visualizer.initialize();

        // Run analysis and set initial segment
        analyzer.analyze(AppState.currentMode);
        modeSelector.updateSegment(AppState.currentMode);

        // Initialize performance radar chart
        performanceChartManager.createRadarChart();
    }
}

// ========================================
// Playback Controls
// ========================================
class PlaybackController {
    constructor() {
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.progressBar = document.getElementById('progressBar');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');

        this.initEventListeners();
    }

    initEventListeners() {
        this.playBtn.addEventListener('click', () => this.play());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        this.speedSlider.addEventListener('input', (e) => {
            AppState.playbackSpeed = parseFloat(e.target.value);
            this.speedValue.textContent = `${AppState.playbackSpeed.toFixed(1)}x`;
        });

        this.progressBar.addEventListener('input', (e) => {
            AppState.currentFrame = parseInt(e.target.value);
            this.updateFrame();
        });
    }

    play() {
        if (AppState.totalFrames === 0) return;

        AppState.isPlaying = true;
        this.playBtn.disabled = true;
        this.pauseBtn.disabled = false;

        this.animate();
    }

    pause() {
        AppState.isPlaying = false;
        this.playBtn.disabled = false;
        this.pauseBtn.disabled = true;

        if (AppState.animationId) {
            cancelAnimationFrame(AppState.animationId);
        }
    }

    reset() {
        this.pause();
        AppState.currentFrame = AppState.segmentStartFrame;
        visualizer.reset();
        this.updateFrame();
    }

    animate() {
        if (!AppState.isPlaying) return;

        AppState.currentFrame += AppState.playbackSpeed;

        // Check segment bounds
        const maxFrame = AppState.segmentEndFrame > 0 ? AppState.segmentEndFrame : AppState.totalFrames - 1;

        if (AppState.currentFrame >= maxFrame) {
            AppState.currentFrame = maxFrame;
            this.pause();
            return;
        }

        this.updateFrame();

        AppState.animationId = requestAnimationFrame(() => this.animate());
    }

    updateFrame() {
        const frame = Math.floor(AppState.currentFrame);

        // Update progress bar with segment bounds
        const minFrame = AppState.segmentStartFrame;
        const maxFrame = AppState.segmentEndFrame > 0 ? AppState.segmentEndFrame : AppState.totalFrames - 1;

        this.progressBar.min = minFrame;
        this.progressBar.max = maxFrame;
        this.progressBar.value = frame;

        // Update time display
        const currentSeconds = this.getTimeAtFrame(frame);
        const totalSeconds = this.getTimeAtFrame(maxFrame);

        this.currentTime.textContent = this.formatTime(currentSeconds);
        this.totalTime.textContent = this.formatTime(totalSeconds);

        // Update 3D visualization
        visualizer.updateFrame(frame);

        // Update chart highlight
        chartManager.updateChartHighlight(frame);
    }

    getTimeAtFrame(frame) {
        if (AppState.sensorData.orientation.length > frame) {
            return AppState.sensorData.orientation[frame].seconds_elapsed || 0;
        }
        return 0;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// ========================================
// Chart Management
// ========================================
class ChartManager {
    constructor() {
        this.activeTab = 'acceleration';
        this.chartCanvas = document.getElementById('dataChart');
        this.ctx = this.chartCanvas.getContext('2d');

        this.initTabs();
    }

    initTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeTab = tab.dataset.chart;
                this.updateChart();
            });
        });
    }

    initializeCharts() {
        this.createChart();
    }

    createChart() {
        // Destroy existing chart if any
        if (AppState.charts.main) {
            AppState.charts.main.destroy();
        }

        const data = this.getChartData();

        AppState.charts.main = new Chart(this.ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#cbd5e1',
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1
                    },
                    annotation: {
                        annotations: {
                            playbackLine: {
                                type: 'line',
                                xMin: 0,
                                xMax: 0,
                                borderColor: '#f59e0b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: '재생 위치',
                                    position: 'start',
                                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                                    color: '#0f172a',
                                    font: {
                                        size: 10
                                    }
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (seconds)',
                            color: '#cbd5e1'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.getYAxisLabel(),
                            color: '#cbd5e1'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    }
                },
                animation: {
                    duration: 300
                }
            }
        });
    }

    getChartData() {
        let datasets = [];

        // Get segment bounds
        const segment = AppState.currentSegment;
        const filterData = (data) => {
            if (!segment) return data;
            return data.filter(d =>
                d.seconds_elapsed >= segment.start &&
                d.seconds_elapsed <= segment.end
            );
        };

        switch (this.activeTab) {
            case 'acceleration':
                if (AppState.sensorData.accelerometer.length > 0) {
                    const filteredData = filterData(AppState.sensorData.accelerometer);
                    datasets = [
                        {
                            label: 'X-axis',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.x
                            })),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        },
                        {
                            label: 'Y-axis',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.y
                            })),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        },
                        {
                            label: 'Z-axis',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.z
                            })),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        }
                    ];
                }
                break;

            case 'gyroscope':
                if (AppState.sensorData.gyroscope.length > 0) {
                    const filteredData = filterData(AppState.sensorData.gyroscope);
                    datasets = [
                        {
                            label: 'X-axis',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.x
                            })),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        },
                        {
                            label: 'Y-axis',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.y
                            })),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        },
                        {
                            label: 'Z-axis',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.z
                            })),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        }
                    ];
                }
                break;

            case 'orientation':
                if (AppState.sensorData.orientation.length > 0) {
                    const filteredData = filterData(AppState.sensorData.orientation);
                    datasets = [
                        {
                            label: 'Roll',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.roll
                            })),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        },
                        {
                            label: 'Pitch',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.pitch
                            })),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        },
                        {
                            label: 'Yaw',
                            data: filteredData.map(d => ({
                                x: d.seconds_elapsed,
                                y: d.yaw
                            })),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            borderWidth: 2,
                            pointRadius: 0
                        }
                    ];
                }
                break;
        }

        return { datasets };
    }

    getYAxisLabel() {
        switch (this.activeTab) {
            case 'acceleration':
                return 'Acceleration (m/s²)';
            case 'gyroscope':
                return 'Angular Velocity (rad/s)';
            case 'orientation':
                return 'Angle (degrees)';
            default:
                return 'Value';
        }
    }

    updateChart() {
        if (AppState.charts.main) {
            AppState.charts.main.data = this.getChartData();
            AppState.charts.main.options.scales.y.title.text = this.getYAxisLabel();
            AppState.charts.main.update();
        }
    }

    updateChartHighlight(frame) {
        if (!AppState.charts.main) return;

        // Get current time from frame
        const orientData = AppState.sensorData.orientation;
        if (frame >= orientData.length) return;

        const currentTime = orientData[frame].seconds_elapsed || 0;

        // Update annotation line position
        const annotation = AppState.charts.main.options.plugins.annotation.annotations.playbackLine;
        if (annotation) {
            annotation.xMin = currentTime;
            annotation.xMax = currentTime;
            AppState.charts.main.update('none'); // Update without animation
        }
    }
}

// ========================================
// Test Mode Selector
// ========================================
class ModeSelector {
    constructor() {
        this.modeButtons = document.querySelectorAll('.mode-btn');
        this.initEventListeners();
    }

    initEventListeners() {
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                AppState.currentMode = btn.dataset.mode;

                // Re-run analysis for new mode
                if (AppState.totalFrames > 0) {
                    analyzer.analyze(AppState.currentMode);
                    this.updateSegment(AppState.currentMode);
                }
            });
        });
    }

    updateSegment(mode) {
        // Extract event segments from annotations
        const segments = this.extractEventSegments();

        let segment = null;
        switch (mode) {
            case 'straight':
                segment = segments.straight;
                break;
            case 'turn':
                segment = segments.turn;
                break;
            case 'wheelie':
                segment = segments.wheelie;
                break;
        }

        AppState.currentSegment = segment;

        if (segment) {
            // Find frame indices for segment
            const orientData = AppState.sensorData.orientation;

            AppState.segmentStartFrame = orientData.findIndex(d => d.seconds_elapsed >= segment.start);
            AppState.segmentEndFrame = orientData.findIndex(d => d.seconds_elapsed >= segment.end);

            if (AppState.segmentStartFrame === -1) AppState.segmentStartFrame = 0;
            if (AppState.segmentEndFrame === -1) AppState.segmentEndFrame = orientData.length - 1;
        } else {
            AppState.segmentStartFrame = 0;
            AppState.segmentEndFrame = AppState.totalFrames - 1;
        }

        // Update visualizer segment
        visualizer.setSegment(segment);

        // Reset to start of segment
        AppState.currentFrame = AppState.segmentStartFrame;
        playbackController.updateFrame();

        // Update chart to show only segment data
        chartManager.updateChart();
    }

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
}

// ========================================
// Loading Overlay
// ========================================
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    text.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
}

// ========================================
// Performance Chart Manager (No radar, just detail list)
// ========================================
class PerformanceChartManager {
    constructor() {
        this.detailContainer = document.querySelector('.performance-details');
    }

    createRadarChart() {
        // Get performance metrics from analyzer
        const metrics = analyzer.calculatePerformanceMetrics();

        // Update detail panel with raw values
        this.updateDetailPanel(metrics);
    }

    updateDetailPanel(metrics) {
        const container = document.querySelector('.performance-details');
        if (!container) return;

        let html = '';
        
        // 1. 추진능력
        const thrust = metrics.추진능력;
        html += `
            <div class="performance-item positive">
                <div class="perf-label">🚀 ${thrust.label}</div>
                <div class="perf-info">
                    <span class="perf-value">${thrust.value}<span class="perf-unit">${thrust.unit}</span></span>
                </div>
            </div>
        `;

        // 2. 직진성 (방향 + 크기)
        const straight = metrics.직진성;
        const straightDirClass = straight.direction === '좌측' ? 'left' : (straight.direction === '우측' ? 'right' : 'center');
        html += `
            <div class="performance-item ${straightDirClass === 'center' ? 'positive' : 'neutral'}">
                <div class="perf-label">📏 ${straight.label}</div>
                <div class="perf-info">
                    <span class="perf-direction ${straightDirClass}">${straight.direction}</span>
                    <span class="perf-value">${straight.value}<span class="perf-unit">${straight.unit}</span></span>
                </div>
            </div>
        `;

        // 3. 좌측 회전능력
        const leftTurn = metrics.좌측회전능력;
        html += `
            <div class="performance-item">
                <div class="perf-label">↩️ ${leftTurn.label}</div>
                <div class="perf-info">
                    <span class="perf-value">${leftTurn.value}<span class="perf-unit">${leftTurn.unit}</span></span>
                </div>
            </div>
        `;

        // 4. 우측 회전능력
        const rightTurn = metrics.우측회전능력;
        html += `
            <div class="performance-item">
                <div class="perf-label">↪️ ${rightTurn.label}</div>
                <div class="perf-info">
                    <span class="perf-value">${rightTurn.value}<span class="perf-unit">${rightTurn.unit}</span></span>
                </div>
            </div>
        `;

        // 5. 회전균형 (방향 + 차이)
        const balance = metrics.회전균형;
        const balanceDirClass = balance.direction === '좌측' ? 'left' : (balance.direction === '우측' ? 'right' : 'center');
        html += `
            <div class="performance-item ${balanceDirClass === 'center' ? 'positive' : 'negative'}">
                <div class="perf-label">⚖️ ${balance.label}</div>
                <div class="perf-info">
                    <span class="perf-direction ${balanceDirClass}">${balance.direction} 약함</span>
                    <span class="perf-value">${balance.value}<span class="perf-unit">${balance.unit}</span></span>
                </div>
            </div>
        `;

        // 6. 안정성
        const stability = metrics.안정성;
        html += `
            <div class="performance-item positive">
                <div class="perf-label">⏱️ ${stability.label}</div>
                <div class="perf-info">
                    <span class="perf-value">${stability.value}<span class="perf-unit">${stability.unit}</span></span>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    updateChart() {
        this.createRadarChart();
    }
}

// ========================================
// Initialize Application
// ========================================
let fileHandler, playbackController, chartManager, modeSelector, visualizer, analyzer, performanceChartManager;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    fileHandler = new FileHandler();
    playbackController = new PlaybackController();
    chartManager = new ChartManager();
    modeSelector = new ModeSelector();
    performanceChartManager = new PerformanceChartManager();

    // These will be defined in separate files
    visualizer = new Visualizer();
    analyzer = new Analyzer();

    // Hide loading overlay
    hideLoading();

    console.log('Wheelchair Mobility Analyzer initialized');
});
