const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    antialias:true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(renderer.domElement);

camera.position.z = 180;

// ======================
// HEART FIREWORKS (trái tim pháo hoa)
// ======================
//
// Cách hoạt động:
//  1. Một quả pháo bay vút lên (có vệt lửa phía sau).
//  2. Nổ ra thành hàng nghìn hạt sáng xếp thành hình trái tim,
//     bung ra nhanh rồi chậm dần, lấp lánh, rơi nhẹ và mờ đi.
//  3. Trái tim lớn ở giữa nổ đều đặn, các trái tim nhỏ nổ hai bên.

function heart(t){

    return {

        x:16*Math.pow(Math.sin(t),3),

        y:
            13*Math.cos(t)
            -5*Math.cos(2*t)
            -2*Math.cos(3*t)
            -Math.cos(4*t)
    };
}

// ---------- CẤU HÌNH (chỉnh tùy ý) ----------

const MAX_PARTICLES   = 24000;   // tổng số hạt tối đa cùng lúc
const MAIN_INTERVAL   = 4.8;     // giây giữa 2 lần nổ trái tim lớn
const MINI_MIN        = 0.9;     // khoảng cách ngắn nhất giữa 2 trái tim nhỏ (giây)
const MINI_MAX        = 2.0;     // khoảng cách dài nhất (giây)
const MAIN_PARTICLES  = 7000;    // số hạt của trái tim lớn
const LAUNCH_Y        = -170;    // độ cao pháo bắt đầu bay

// mỗi cặp: [màu viền ngoài, màu ruột bên trong]
const FIREWORK_PALETTES = [
    ["#ff4f93", "#ffd6e8"],   // hồng
    ["#8a7dff", "#e0dbff"],   // tím (màu gốc của trái tim cũ)
    ["#ff5468", "#ffe36e"],   // đỏ - vàng
    ["#6ef2a6", "#eafff2"],   // xanh mint
    ["#ffe36e", "#ff9ec7"]    // vàng - hồng
];

// ---------- BỘ NHỚ HẠT (dùng chung, không tạo mới liên tục) ----------

const pOrigin = new Float32Array(MAX_PARTICLES * 3);
const pTarget = new Float32Array(MAX_PARTICLES * 3);
const pBase   = new Float32Array(MAX_PARTICLES * 3);
const pAge    = new Float32Array(MAX_PARTICLES).fill(1);
const pLife   = new Float32Array(MAX_PARTICLES);       // 0 = hạt chưa dùng
const pK      = new Float32Array(MAX_PARTICLES);
const pGrav   = new Float32Array(MAX_PARTICLES);
const pSize   = new Float32Array(MAX_PARTICLES);
const pPhase  = new Float32Array(MAX_PARTICLES);

const aPos   = new Float32Array(MAX_PARTICLES * 3);
const aCol   = new Float32Array(MAX_PARTICLES * 3);
const aSize  = new Float32Array(MAX_PARTICLES);
const aAlpha = new Float32Array(MAX_PARTICLES);

const fwGeometry = new THREE.BufferGeometry();

const posAttr   = new THREE.BufferAttribute(aPos, 3);
const colAttr   = new THREE.BufferAttribute(aCol, 3);
const sizeAttr  = new THREE.BufferAttribute(aSize, 1);
const alphaAttr = new THREE.BufferAttribute(aAlpha, 1);

[posAttr, colAttr, sizeAttr, alphaAttr].forEach(a => a.setUsage(THREE.DynamicDrawUsage));

fwGeometry.setAttribute('position', posAttr);
fwGeometry.setAttribute('aColor',   colAttr);
fwGeometry.setAttribute('aSize',    sizeAttr);
fwGeometry.setAttribute('aAlpha',   alphaAttr);

const fwMaterial = new THREE.ShaderMaterial({

    uniforms: {
        uScale: { value: window.innerHeight * 0.5 }
    },

    vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3  aColor;
        uniform   float uScale;
        varying   float vAlpha;
        varying   vec3  vColor;

        void main(){
            vAlpha = aAlpha;
            vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / -mv.z;
            gl_Position  = projectionMatrix * mv;
        }
    `,

    fragmentShader: `
        varying float vAlpha;
        varying vec3  vColor;

        void main(){
            float d = length(gl_PointCoord - vec2(0.5));
            if(d > 0.5) discard;
            float glow = pow(1.0 - d * 2.0, 1.5);
            gl_FragColor = vec4(vColor, glow * vAlpha);
        }
    `,

    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending
});

const fireworks = new THREE.Points(fwGeometry, fwMaterial);
fireworks.frustumCulled = false;   // vị trí hạt thay đổi liên tục
scene.add(fireworks);

// ---------- PHÁT HẠT ----------

let cursor = 0;

function emit(ox, oy, oz, tx, ty, tz, r, g, b, life, k, grav, size){

    const i  = cursor;
    cursor   = (cursor + 1) % MAX_PARTICLES;   // hết chỗ thì ghi đè hạt cũ nhất
    const i3 = i * 3;

    pOrigin[i3] = ox;  pOrigin[i3+1] = oy;  pOrigin[i3+2] = oz;
    pTarget[i3] = tx;  pTarget[i3+1] = ty;  pTarget[i3+2] = tz;
    pBase[i3]   = r;   pBase[i3+1]   = g;   pBase[i3+2]   = b;

    pAge[i]   = 0;
    pLife[i]  = life;
    pK[i]     = k;
    pGrav[i]  = grav;
    pSize[i]  = size;
    pPhase[i] = Math.random() * Math.PI * 2;
}

const colorA = new THREE.Color();
const colorB = new THREE.Color();

// Nổ ra hình trái tim: mỗi hạt bay tới một điểm của trái tim (viền + ruột)
function explodeHeart(x, y, z, scale, hexA, hexB, count){

    colorA.set(hexA);
    colorB.set(hexB);

    // xoay nhẹ trái tim quanh trục Y cho mỗi lần nổ nhìn khác nhau
    const rotY = (Math.random() - 0.5) * 0.9;
    const cs   = Math.cos(rotY);
    const sn   = Math.sin(rotY);

    // tia chớp lúc nổ
    emit(x, y, z, 0, 0, 0, 1, 1, 1, 0.35, 1, 0, scale * 5);

    for(let i = 0; i < count; i++){

        const p = heart(Math.random() * Math.PI * 2);

        // ~55% hạt nằm ở viền, còn lại lấp đầy bên trong
        const s = Math.random() < 0.55
            ? 0.97 + Math.random() * 0.06
            : Math.sqrt(Math.random());

        const hx = p.x * s * scale;
        const hy = (p.y + 2.5) * s * scale;              // +2.5 để tim cân giữa
        const hz = (Math.random() - 0.5) * scale * 5;    // độ dày của trái tim

        const tx =  hx * cs + hz * sn;
        const tz = -hx * sn + hz * cs;

        // viền = màu 1, càng vào trong càng chuyển sang màu 2
        const m = 1 - s;
        const r = colorA.r + (colorB.r - colorA.r) * m;
        const g = colorA.g + (colorB.g - colorA.g) * m;
        const b = colorA.b + (colorB.b - colorA.b) * m;

        emit(
            x, y, z,
            tx, hy, tz,
            r, g, b,
            2.6 + Math.random() * 1.4,        // thời gian sống
            3 + Math.random(),                // độ "phanh" khi bung
            5 + Math.random() * 4,            // trọng lực (rơi nhẹ)
            0.8 + scale * 0.2 + Math.random() * 0.5
        );
    }
}

// ---------- PHÁO BAY LÊN ----------

const rockets = [];

function launchRocket(x, z, y1, dur, onBurst){
    rockets.push({ x, z, y0: LAUNCH_Y, y1, t: 0, dur, onBurst });
}

function updateRockets(dt){

    for(let i = rockets.length - 1; i >= 0; i--){

        const r = rockets[i];

        r.t += dt / r.dur;

        const k = Math.min(r.t, 1);
        const e = 1 - (1 - k) * (1 - k);              // bay nhanh rồi chậm dần
        const y = r.y0 + (r.y1 - r.y0) * e;
        const x = r.x + Math.sin(r.t * 14) * 2;       // lắc nhẹ khi bay

        // đầu pháo sáng
        emit(x, y, r.z, 0, 0, 0, 1, 0.95, 0.8, 0.09, 1, 0, 3.2);

        // vệt lửa phía sau
        for(let j = 0; j < 3; j++){
            emit(
                x, y, r.z,
                (Math.random() - 0.5) * 6,
                -4 - Math.random() * 10,
                (Math.random() - 0.5) * 6,
                1, 0.75 + Math.random() * 0.2, 0.4,
                0.5 + Math.random() * 0.4,
                2, 25, 1.3
            );
        }

        if(r.t >= 1){
            r.onBurst();
            rockets.splice(i, 1);
        }
    }
}

// ---------- LỊCH BẮN ----------

function pickPalette(){
    return FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
}

function launchMain(){

    const pal = pickPalette();
    const x = 0, y = 10, z = -30;

    launchRocket(x, z, y, 1.1, () =>
        explodeHeart(x, y, z, 6.2, pal[0], pal[1], MAIN_PARTICLES)
    );
}

let side = 1;

function launchMini(){

    side = -side;   // luân phiên trái / phải

    const pal   = pickPalette();
    const x     = side * (110 + Math.random() * 120);
    const z     = -20 - Math.random() * 160;
    const y     = -10 + Math.random() * 120;
    const scale = 1.8 + Math.random() * 1.6;
    const count = Math.floor(1400 + scale * 450);

    launchRocket(x, z, y, 0.8 + Math.random() * 0.4, () =>
        explodeHeart(x, y, z, scale, pal[0], pal[1], count)
    );
}

let mainTimer = 0.3;   // trái tim lớn nổ gần như ngay khi mở trang
let miniTimer = 1.6;

function updateFireworks(dt){

    mainTimer -= dt;
    if(mainTimer <= 0){
        launchMain();
        mainTimer = MAIN_INTERVAL;
    }

    miniTimer -= dt;
    if(miniTimer <= 0){
        launchMini();
        miniTimer = MINI_MIN + Math.random() * (MINI_MAX - MINI_MIN);
    }

    updateRockets(dt);

    for(let i = 0; i < MAX_PARTICLES; i++){

        if(pAge[i] >= pLife[i]){
            aAlpha[i] = 0;
            continue;
        }

        pAge[i] += dt;

        const age  = pAge[i];
        const life = pLife[i];

        if(age >= life){
            aAlpha[i] = 0;
            continue;
        }

        const i3 = i * 3;
        const e  = 1 - Math.exp(-pK[i] * age);          // bung nhanh, chậm dần
        const g  = 0.5 * pGrav[i] * age * age;          // rơi xuống

        aPos[i3]   = pOrigin[i3]   + pTarget[i3]   * e;
        aPos[i3+1] = pOrigin[i3+1] + pTarget[i3+1] * e - g;
        aPos[i3+2] = pOrigin[i3+2] + pTarget[i3+2] * e;

        const u    = age / life;
        const heat = Math.max(0, 1 - age / 0.4);        // lúc mới nổ: trắng nóng

        aCol[i3]   = pBase[i3]   + (1 - pBase[i3])   * heat * 0.9;
        aCol[i3+1] = pBase[i3+1] + (1 - pBase[i3+1]) * heat * 0.9;
        aCol[i3+2] = pBase[i3+2] + (1 - pBase[i3+2]) * heat * 0.9;

        let a = u < 0.55 ? 1 : (1 - u) / 0.45;          // mờ dần về cuối
        a *= 0.72 + 0.28 * Math.sin(age * 24 + pPhase[i]);   // lấp lánh

        aAlpha[i] = a * 0.9;
        aSize[i]  = pSize[i] * (1 - 0.5 * u) * (1 + heat * 0.6);
    }

    posAttr.needsUpdate   = true;
    colAttr.needsUpdate   = true;
    sizeAttr.needsUpdate  = true;
    alphaAttr.needsUpdate = true;
}

// ======================
// STAR BACKGROUND
// ======================

const stars = [];

for(let i=0;i<3000;i++){

    stars.push(
        (Math.random()-0.5)*1500,
        (Math.random()-0.5)*1500,
        (Math.random()-0.5)*1500
    );
}

const starGeo =
    new THREE.BufferGeometry();

starGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
        stars,
        3
    )
);

const starMat =
    new THREE.PointsMaterial({
        color:"white",
        size:0.8
    });

scene.add(
    new THREE.Points(
        starGeo,
        starMat
    )
);

// ======================
// FLYING PHOTOS (ảnh bay qua)
// ======================

// 👉 Thay các đường dẫn dưới đây bằng ảnh của bạn
const IMAGE_PATHS = [
    './images/hong_1.png',
    './images/hong_2.png',
    './images/hong_3.png',
    './images/hong_4.png',
];

const textureLoader = new THREE.TextureLoader();
const PHOTO_COUNT   = 2; // số ảnh bay cùng lúc tối đa
const flyingPhotos  = [];

function createPhotoSprite(){

    const mat = new THREE.SpriteMaterial({
        map: null,
        transparent: true,
        opacity: 0
    });

    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    return sprite;
}

function loadRandomPhoto(sprite){

    const path = IMAGE_PATHS[
        Math.floor(Math.random()*IMAGE_PATHS.length)
    ];

    textureLoader.load(path, (tex) => {

        sprite.material.map = tex;
        sprite.material.needsUpdate = true;

        // giữ đúng tỉ lệ khung ảnh gốc
        const baseSize = 70 + Math.random()*30;
        const aspect   = tex.image.width / tex.image.height;
        sprite.scale.set(baseSize*aspect, baseSize, 1);

        sprite.visible = true;
    });
}

function resetPhoto(sprite, withDelay){

    sprite.visible = false;
    sprite.material.opacity = 0;

    sprite.position.set(
        450 + Math.random()*400,
        -50 + Math.random()*250,
        (Math.random()-0.5)*400
    );

    sprite.userData.speed   = 1.5 + Math.random()*1.5;
    sprite.userData.maxLife = 260 + Math.random()*160;
    // withDelay: chờ ngẫu nhiên trước khi ảnh tiếp theo xuất hiện
    sprite.userData.life    = withDelay ? -Math.floor(Math.random()*400) : 0;

    loadRandomPhoto(sprite);
}

for(let i=0;i<PHOTO_COUNT;i++){
    const sprite = createPhotoSprite();
    resetPhoto(sprite, true);
    flyingPhotos.push(sprite);
    scene.add(sprite);
}

function updateFlyingPhotos(){

    flyingPhotos.forEach(sprite => {

        sprite.userData.life++;

        if(sprite.userData.life < 0) return;

        sprite.position.x -= sprite.userData.speed;
        sprite.position.y -= sprite.userData.speed*0.25;
        sprite.material.rotation += 0.006;

        const t = sprite.userData.life / sprite.userData.maxLife;

        if(t < 0.1){
            sprite.material.opacity = t/0.1;
        } else if(t > 0.85){
            sprite.material.opacity = Math.max(0, (1-t)/0.15);
        } else {
            sprite.material.opacity = 1;
        }

        if(t >= 1){
            resetPhoto(sprite, true);
        }
    });
}

// ======================
// TEXT RINGS
// ======================

const MESSAGES = [
    { text: "Trần Thị Thúy Hồng 💛",              color: "#ffe36e" },
    { text: "Chúc em Trung Thu vui vẻ và ấm áp 💚", color: "#8ef5a3" },
    { text: "Ngựa Hồng 🩷",             color: "#ff9ec7" },
    { text: "Mong ăn chóng lớn 💛",                  color: "#ffd0a1" }
];

function makeTextTexture(text, color){

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const FS     = 110;

    
    ctx.font = `bold ${FS}px Arial, "Segoe UI Emoji", "Noto Color Emoji"`;
    const w = Math.ceil(ctx.measureText(text).width) + FS * 1.6; // + khoảng hở

    canvas.width  = w;
    canvas.height = FS * 2;

    // đổi width sẽ reset context -> phải set lại font
    ctx.font         = `bold ${FS}px Arial, "Segoe UI Emoji", "Noto Color Emoji"`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 22;
    ctx.fillStyle    = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS       = THREE.RepeatWrapping;
    tex.anisotropy  = 8;
    tex.aspect      = canvas.width / canvas.height;   // lưu lại để tính số bản lặp
    return tex;
}

function makeRing(msg, radius, height){

    const tex = makeTextTexture(msg.text, msg.color);

    // một bản chữ rộng bao nhiêu trong không gian 3D
    const copyWidth = height * tex.aspect;
    const copies    = Math.max(1, Math.round(2 * Math.PI * radius / copyWidth));
    tex.repeat.x    = copies;

    const geo = new THREE.CylinderGeometry(
        radius, radius, height,
        128, 1,
        true            // openEnded: chỉ lấy mặt bên
    );

    const mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        side:        THREE.DoubleSide,
        depthWrite:  false
    });

    return new THREE.Mesh(geo, mat);
}

const ringGroup = new THREE.Group();

MESSAGES.forEach((msg, i) => {

    const ring = makeRing(
        msg,
        170 - i * 22,            // bán kính: gần to, xa nhỏ (đã tăng để vòng rộng hơn)
        24                       // chiều cao dải chữ (đã tăng để chữ to hơn)
    );

    ring.position.y = -140 - i * 34;   // hạ dần xuống -> hình phễu
    ring.position.z = -i * 32;         // lùi dần ra sau
    ring.userData.speed = (i % 2 ? -1 : 1) * (0.004 + i * 0.0006);

    ringGroup.add(ring);
});

scene.add(ringGroup);

// ======================
// FLOATING TEXTS (chữ bay lên)
// ======================

// 👉 Danh sách chữ sẽ ngẫu nhiên bay lên, thêm/bớt/sửa tùy ý
const FLOAT_TEXTS = [
    { text: "Hồng cute 💛",              color: "#ffe36e" },
    { text: "Trung Thu vui vẻ 🌕",     color: "#8ef5a3" },
    { text: "Ngựa Hồng 🩷",           color: "#ff9ec7" },
    { text: "Nụ cười tỏa nắng 💌",         color: "#ffd0a1" }
];

const FLOAT_COUNT   = 3; // số chữ bay cùng lúc tối đa
const floatingTexts = [];

function createFloatSprite(){

    const mat = new THREE.SpriteMaterial({
        map: null,
        transparent: true,
        opacity: 0
    });

    return new THREE.Sprite(mat);
}

function resetFloatText(sprite, withDelay){

    const msg = FLOAT_TEXTS[
        Math.floor(Math.random()*FLOAT_TEXTS.length)
    ];

    const tex = makeTextTexture(msg.text, msg.color);

    sprite.material.map = tex;
    sprite.material.needsUpdate = true;

    const baseHeight = 20 + Math.random()*10;
    sprite.scale.set(baseHeight*tex.aspect, baseHeight, 1);

    // xuất phát từ phía dưới, rải rác theo chiều ngang
    sprite.position.set(
        (Math.random()-0.5)*300,
        -200 - Math.random()*60,
        (Math.random()-0.5)*200
    );

    sprite.userData.speed   = 0.4 + Math.random()*0.3;
    sprite.userData.maxLife = 300 + Math.random()*150;
    // withDelay: chờ ngẫu nhiên trước khi chữ tiếp theo xuất hiện
    sprite.userData.life    = withDelay ? -Math.floor(Math.random()*300) : 0;

    sprite.material.opacity = 0;
}

for(let i=0;i<FLOAT_COUNT;i++){
    const sprite = createFloatSprite();
    resetFloatText(sprite, true);
    floatingTexts.push(sprite);
    scene.add(sprite);
}

function updateFloatingTexts(){

    floatingTexts.forEach(sprite => {

        sprite.userData.life++;

        if(sprite.userData.life < 0) return;

        // bay thẳng lên trên
        sprite.position.y += sprite.userData.speed;

        const t = sprite.userData.life / sprite.userData.maxLife;

        if(t < 0.15){
            sprite.material.opacity = t/0.15;
        } else if(t > 0.8){
            sprite.material.opacity = Math.max(0, (1-t)/0.2);
        } else {
            sprite.material.opacity = 1;
        }

        if(t >= 1){
            resetFloatText(sprite, true);
        }
    });
}

// ======================
// ANIMATION
// ======================

let time = 0;
let lastFrame = performance.now();

function animate(){
    ringGroup.children.forEach(r => r.rotation.y += r.userData.speed);
    updateFlyingPhotos();
    updateFloatingTexts();
    requestAnimationFrame(animate);

    time += 0.005;

    const now = performance.now();
    const dt  = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    updateFireworks(dt);

    camera.position.x =
        Math.sin(time) * 50;

    camera.position.z =
        180 +
        Math.cos(time)*20;

    camera.position.z = 260 + Math.cos(time) * 20;
    camera.lookAt(0, -60, 0);

    renderer.render(
        scene,
        camera
    );
}

animate();

window.addEventListener(
    "resize",
    ()=>{

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );

        fwMaterial.uniforms.uScale.value = window.innerHeight * 0.5;
    }
);