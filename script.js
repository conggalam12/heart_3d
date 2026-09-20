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
// HEART POINTS
// ======================

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

const positions = [];

for(let i=0;i<15000;i++){

    const t = Math.random()*Math.PI*2;

    const p = heart(t);

    const scale = 5 + Math.random()*2;

    positions.push(
        p.x*scale,
        p.y*scale,
        (Math.random()-0.5)*60
    );
}

const geometry =
    new THREE.BufferGeometry();

geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
        positions,
        3
    )
);

const material =
    new THREE.PointsMaterial({

        color:"#8a7dff",

        size:1.3
    });

const heartPoints =
    new THREE.Points(
        geometry,
        material
    );

scene.add(heartPoints);

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
    { text: "Yêu em 💛",              color: "#ffe36e" },
    { text: "Trung Thu vui vẻ 🌕",     color: "#8ef5a3" },
    { text: "Ngựa Hồng 🩷",           color: "#ff9ec7" },
    { text: "Nhớ em nhiều 💌",         color: "#ffd0a1" }
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

function animate(){
    ringGroup.children.forEach(r => r.rotation.y += r.userData.speed);
    updateFlyingPhotos();
    updateFloatingTexts();
    requestAnimationFrame(animate);

    time += 0.005;

    heartPoints.rotation.y += 0.003;

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
    }
);