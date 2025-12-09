// ========================================
// 3D Wheelchair Visualizer using Three.js
// ========================================

class Visualizer {
    constructor() {
        this.container = document.getElementById('threejsCanvas');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.wheelchair = null;
        this.controls = null;
        this.gridHelper = null;
        this.axesHelper = null;
        this.pathLine = null;
        this.pathPoints = [];

        // Segment-based playback
        this.currentSegment = null;
        this.segmentStartFrame = 0;
        this.segmentEndFrame = 0;

        // Camera view modes
        this.viewMode = 'perspective';

        // Calibration - initial orientation offset
        this.calibrationQuaternion = null;
        this.isCalibrated = false;
    }

    initialize() {
        if (!this.container) {
            console.error('Canvas container not found');
            return;
        }

        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupWheelchair();
        this.setupHelpers();
        this.setupControls();
        this.setupViewControls();

        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);
        this.scene.fog = new THREE.Fog(0x0f172a, 10, 50);
    }

    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        // Z축이 위를 향하는 좌표계에 맞춘 초기 시점
        this.camera.position.set(3, -3, 3);
        this.camera.up.set(0, 0, 1); // Z축을 위쪽으로 설정
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Hemisphere light for better ambient lighting
        const hemiLight = new THREE.HemisphereLight(0x6366f1, 0x1e293b, 0.4);
        this.scene.add(hemiLight);

        // Point light for accent
        const pointLight = new THREE.PointLight(0x10b981, 0.5, 10);
        pointLight.position.set(0, 2, 0);
        this.scene.add(pointLight);
    }

    setupWheelchair() {
        // Create wheelchair model aligned with sensor axes
        // Y axis (Green) = front/back - wheelchair faces +Y direction (FRONT)
        // X axis (Red) = left/right
        // Z axis (Blue) = up/down - wheels below
        const wheelchairGroup = new THREE.Group();

        // Main body (seat) - horizontal on XY plane, phone sits here
        // Seat is elongated along Y axis (front-back direction)
        const seatGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.1); // width(X), depth(Y), height(Z)
        const seatMaterial = new THREE.MeshStandardMaterial({
            color: 0x6366f1,
            metalness: 0.3,
            roughness: 0.7
        });
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.z = 0.4; // Seat height
        seat.castShadow = true;
        seat.receiveShadow = true;
        wheelchairGroup.add(seat);

        // Backrest - at -Y side (back of wheelchair, since +Y is front)
        const backrestGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.5); // width(X), thickness(Y), height(Z)
        const backrestMaterial = new THREE.MeshStandardMaterial({
            color: 0x818cf8,
            metalness: 0.2,
            roughness: 0.8
        });
        const backrest = new THREE.Mesh(backrestGeometry, backrestMaterial);
        backrest.position.set(0, -0.225, 0.65); // Back side (-Y), higher
        backrest.castShadow = true;
        wheelchairGroup.add(backrest);

        // Wheels (large rear wheels) - aligned along X axis, at back (-Y side)
        const wheelGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.8,
            roughness: 0.2
        });

        // Left wheel (at -X, back)
        const leftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        leftWheel.rotation.z = Math.PI / 2; // Rotate to align with X axis
        leftWheel.position.set(-0.3, -0.1, 0.25);
        leftWheel.castShadow = true;
        wheelchairGroup.add(leftWheel);

        // Right wheel (at +X, back)
        const rightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        rightWheel.rotation.z = Math.PI / 2;
        rightWheel.position.set(0.3, -0.1, 0.25);
        rightWheel.castShadow = true;
        wheelchairGroup.add(rightWheel);

        // Front casters (small wheels) - at +Y side (front)
        const casterGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 16);
        const casterMaterial = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.6,
            roughness: 0.4
        });

        const leftCaster = new THREE.Mesh(casterGeometry, casterMaterial);
        leftCaster.rotation.z = Math.PI / 2;
        leftCaster.position.set(-0.15, 0.3, 0.08); // Front side (+Y)
        leftCaster.castShadow = true;
        wheelchairGroup.add(leftCaster);

        const rightCaster = new THREE.Mesh(casterGeometry, casterMaterial);
        rightCaster.rotation.z = Math.PI / 2;
        rightCaster.position.set(0.15, 0.3, 0.08); // Front side (+Y)
        rightCaster.castShadow = true;
        wheelchairGroup.add(rightCaster);

        // Frame - connecting front and back along Y axis
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            metalness: 0.9,
            roughness: 0.1
        });

        // Side frames (along Y axis, connecting front and back)
        const frameGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial);
        leftFrame.rotation.x = Math.PI / 2; // Rotate to align with Y axis
        leftFrame.position.set(-0.25, 0.1, 0.25);
        leftFrame.castShadow = true;
        wheelchairGroup.add(leftFrame);

        const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial);
        rightFrame.rotation.x = Math.PI / 2;
        rightFrame.position.set(0.25, 0.1, 0.25);
        rightFrame.castShadow = true;
        wheelchairGroup.add(rightFrame);

        // Add glow effect on seat
        const glowGeometry = new THREE.BoxGeometry(0.52, 0.52, 0.12);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = 0.4;
        wheelchairGroup.add(glow);

        // Wheelchair now faces +Y direction (green axis = front)
        // Model is built with +Y as front, -Y as back, X as left/right, Z as up/down

        this.wheelchair = wheelchairGroup;
        this.scene.add(this.wheelchair);
    }

    setupHelpers() {
        // Grid helper on XY plane (horizontal)
        this.gridHelper = new THREE.GridHelper(20, 40, 0x334155, 0x1e293b);
        this.gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
        this.gridHelper.position.z = 0;
        this.scene.add(this.gridHelper);

        // Custom axes helper - sensor axes = space axes
        // X axis (Red) = left/right
        // Y axis (Green) = front/back
        // Z axis (Blue) = up/down
        const axisLength = 2;
        const axisGroup = new THREE.Group();

        // X axis (Red) - left/right
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(axisLength, 0, 0)
        ]);
        const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
        const xAxis = new THREE.Line(xGeometry, xMaterial);
        axisGroup.add(xAxis);

        // Y axis (Green) - front/back
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, axisLength, 0)
        ]);
        const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        const yAxis = new THREE.Line(yGeometry, yMaterial);
        axisGroup.add(yAxis);

        // Z axis (Blue) - up/down
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, axisLength)
        ]);
        const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });
        const zAxis = new THREE.Line(zGeometry, zMaterial);
        axisGroup.add(zAxis);

        this.axesHelper = axisGroup;
        this.scene.add(this.axesHelper);

        // Ground plane for shadows - on XY plane
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.y = 0; // XY plane
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    setupControls() {
        // Using OrbitControls for camera manipulation (zoom, pan, rotate)
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;

            // 자유로운 3D 회전 허용 (제한 없음)
            this.controls.minPolarAngle = 0;
            this.controls.maxPolarAngle = Math.PI;

            // Enable zoom and pan
            this.controls.enableZoom = true;
            this.controls.enablePan = true;
            this.controls.zoomSpeed = 1.0;
            this.controls.panSpeed = 0.8;
            this.controls.rotateSpeed = 0.8;

            // Mouse button controls: LEFT = pan (drag), SCROLL = zoom, RIGHT = rotate
            this.controls.mouseButtons = {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE
            };
        }
    }

    setupViewControls() {
        // View control buttons
        const viewButtons = document.querySelectorAll('.view-controls .icon-btn');

        viewButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                switch (index) {
                    case 0: // Top view
                        this.setTopView();
                        break;
                    case 1: // Side view
                        this.setSideView();
                        break;
                    case 2: // Front view
                        this.setFrontView();
                        break;
                    case 3: // Reset view
                        this.resetView();
                        break;
                }
            });
        });
    }

    // 위에서 보기 (수평면/Top View) - Z축 위에서 XY 평면을 내려다봄
    setTopView() {
        this.camera.position.set(0, 0, 5);
        this.camera.up.set(0, 1, 0); // Y축이 화면 위쪽
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }

    // 옆에서 보기 (측면/Side View) - X축 옆에서 YZ 평면을 봄
    setSideView() {
        this.camera.position.set(5, 0, 0.5);
        this.camera.up.set(0, 0, 1); // Z축이 화면 위쪽
        this.camera.lookAt(0, 0, 0.5);
        if (this.controls) {
            this.controls.target.set(0, 0, 0.5);
            this.controls.update();
        }
    }

    // 앞에서 보기 (정면/Front View) - Y축 앞에서 XZ 평면을 봄
    setFrontView() {
        this.camera.position.set(0, -5, 0.5);
        this.camera.up.set(0, 0, 1); // Z축이 화면 위쪽
        this.camera.lookAt(0, 0, 0.5);
        if (this.controls) {
            this.controls.target.set(0, 0, 0.5);
            this.controls.update();
        }
    }

    // 리셋 (기본 3D 시점)
    resetView() {
        this.camera.position.set(3, -3, 3);
        this.camera.up.set(0, 0, 1); // Z축이 화면 위쪽
        this.camera.lookAt(0, 0, 0);
        if (this.controls) {
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }

    // 확대
    zoomIn() {
        if (!this.controls) return;

        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        // 카메라를 타겟 방향으로 이동
        const zoomAmount = 0.5;
        this.camera.position.addScaledVector(direction, zoomAmount);

        if (this.controls) {
            this.controls.update();
        }
    }

    // 축소
    zoomOut() {
        if (!this.controls) return;

        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        // 카메라를 타겟 반대 방향으로 이동
        const zoomAmount = -0.5;
        this.camera.position.addScaledVector(direction, zoomAmount);

        if (this.controls) {
            this.controls.update();
        }
    }

    // Set segment for mode-specific playback
    setSegment(segment) {
        this.currentSegment = segment;

        if (!segment) {
            this.segmentStartFrame = 0;
            this.segmentEndFrame = AppState.totalFrames - 1;
            return;
        }

        // Find frame indices for segment start and end times
        const orientData = AppState.sensorData.orientation;

        this.segmentStartFrame = orientData.findIndex(d => d.seconds_elapsed >= segment.start);
        this.segmentEndFrame = orientData.findIndex(d => d.seconds_elapsed >= segment.end);

        if (this.segmentStartFrame === -1) this.segmentStartFrame = 0;
        if (this.segmentEndFrame === -1) this.segmentEndFrame = orientData.length - 1;

        // Reset to start of segment
        this.reset();
    }

    updateFrame(frame) {
        if (!this.wheelchair) return;

        const orientData = AppState.sensorData.orientation;
        const accelData = AppState.sensorData.accelerometer;
        const gyroData = AppState.sensorData.gyroscope;

        if (frame >= orientData.length) return;

        const data = orientData[frame];

        // Calculate relative frame within segment
        const relativeFrame = frame - this.segmentStartFrame;

        // Calibrate on first frame of segment
        if (!this.isCalibrated && data.qw !== undefined) {
            this.calibrate(data);
        }

        // Update wheelchair orientation using quaternion with calibration
        if (data.qw !== undefined && data.qx !== undefined &&
            data.qy !== undefined && data.qz !== undefined) {

            let quaternion = new THREE.Quaternion(
                data.qx,
                data.qy,
                data.qz,
                data.qw
            );

            // Apply calibration offset
            if (this.calibrationQuaternion) {
                quaternion = this.calibrationQuaternion.clone().multiply(quaternion);
            }

            this.wheelchair.setRotationFromQuaternion(quaternion);
        } else if (data.roll !== undefined && data.pitch !== undefined && data.yaw !== undefined) {
            // Fallback to Euler angles if quaternion not available
            // Apply calibration offset
            const calibOffset = this.calibrationEuler || { roll: 0, pitch: 0, yaw: 0 };
            this.wheelchair.rotation.set(
                (data.roll - calibOffset.roll) * Math.PI / 180,
                (data.yaw - calibOffset.yaw) * Math.PI / 180,
                (data.pitch - calibOffset.pitch) * Math.PI / 180,
                'YXZ'
            );
        }

        // Update position based on integrated acceleration
        // Sensor axes = Space axes: X=X, Y=Y, Z=Z
        if (accelData.length > frame && gyroData.length > frame) {
            const dt = 0.01; // Time step
            const scale = 0.5; // Scale factor for visualization

            // X axis (Red): sensor X - left/right
            this.wheelchair.position.x += (accelData[frame].x || 0) * scale * dt;

            // Y axis (Green): sensor Y - front/back
            this.wheelchair.position.y += (accelData[frame].y || 0) * scale * dt;

            // Z axis (Blue): sensor Z - up/down
            this.wheelchair.position.z += (accelData[frame].z || 0) * scale * dt;
        }

        // Add to path
        this.addPathPoint(this.wheelchair.position.clone());

        // Update info display
        this.updateInfoDisplay(data, frame);
    }

    addPathPoint(position) {
        this.pathPoints.push(position);

        // Limit path length
        if (this.pathPoints.length > 500) {
            this.pathPoints.shift();
        }

        // Update path line
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
        }

        if (this.pathPoints.length > 1) {
            const pathGeometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
            const pathMaterial = new THREE.LineBasicMaterial({
                color: 0x10b981,
                linewidth: 2,
                transparent: true,
                opacity: 0.6
            });
            this.pathLine = new THREE.Line(pathGeometry, pathMaterial);
            this.scene.add(this.pathLine);
        }
    }

    updateInfoDisplay(data, frame) {
        const infoDisplay = document.querySelector('.info-display');
        if (!infoDisplay) return;

        infoDisplay.innerHTML = `
            <div><strong>Frame:</strong> ${frame}</div>
            <div><strong>Time:</strong> ${(data.seconds_elapsed || 0).toFixed(2)}s</div>
            <div><strong>Roll:</strong> ${(data.roll || 0).toFixed(1)}°</div>
            <div><strong>Pitch:</strong> ${(data.pitch || 0).toFixed(1)}°</div>
            <div><strong>Yaw:</strong> ${(data.yaw || 0).toFixed(1)}°</div>
            <div><strong>Pos:</strong> X:${this.wheelchair.position.x.toFixed(2)} Y:${this.wheelchair.position.y.toFixed(2)} Z:${this.wheelchair.position.z.toFixed(2)}</div>
        `;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    reset() {
        // Reset wheelchair position and rotation to center
        if (this.wheelchair) {
            this.wheelchair.position.set(0, 0, 0);
            this.wheelchair.rotation.set(0, 0, 0);
        }

        // Clear path
        this.pathPoints = [];
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
            this.pathLine = null;
        }

        // Reset calibration for new segment
        this.isCalibrated = false;
        this.calibrationQuaternion = null;
        this.calibrationEuler = null;
    }

    // Calibrate initial orientation to zero
    calibrate(initialData) {
        if (initialData.qw !== undefined) {
            // Store inverse of initial quaternion
            const initialQuat = new THREE.Quaternion(
                initialData.qx,
                initialData.qy,
                initialData.qz,
                initialData.qw
            );
            this.calibrationQuaternion = initialQuat.clone().invert();
        }
        
        if (initialData.roll !== undefined) {
            // Store initial Euler angles for offset
            this.calibrationEuler = {
                roll: initialData.roll,
                pitch: initialData.pitch,
                yaw: initialData.yaw
            };
        }

        this.isCalibrated = true;
        console.log('Calibration applied - Initial orientation set to zero');
    }
}
