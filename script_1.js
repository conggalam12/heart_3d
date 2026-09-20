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

        color:"#ff7ddc",

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
// SHOOTING STARS (sao băng)
// ======================

const METEOR_COUNT = 6;
const meteors = [];

function createMeteorLine(){

    // const length = Math.random()*25;
    const length = 3;
    // đuôi sao băng: từ đầu sáng đến đuôi mờ dần
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-length, length*0.45, 0)
    ];

    const geo = new THREE.BufferGeometry().setFromPoints(points);

    const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0
    });

    return new THREE.Line(geo, mat);
}

function resetMeteor(m, withDelay){

    // xuất phát từ góc trên bên phải, bay chéo xuống dưới bên trái
    m.position.set(
        400 + Math.random()*500,
        150 + Math.random()*300,
        (Math.random()-0.5)*500
    );

    m.userData.speed   = 5 + Math.random()*5;
    m.userData.maxLife = 50 + Math.random()*40;
    // withDelay: thời gian chờ ngẫu nhiên trước khi sao băng tiếp theo xuất hiện
    m.userData.life    = withDelay ? -Math.floor(Math.random()*180) : 0;

    m.material.opacity = 0;
}

for(let i=0;i<METEOR_COUNT;i++){

    const m = createMeteorLine();
    resetMeteor(m, true);
    meteors.push(m);
    scene.add(m);
}

function updateMeteors(){

    meteors.forEach(m => {

        m.userData.life++;

        // vẫn đang trong thời gian chờ -> chưa hiện, chưa di chuyển
        if(m.userData.life < 0) return;

        m.position.x -= m.userData.speed;
        m.position.y -= m.userData.speed*0.45;

        const t = m.userData.life / m.userData.maxLife;

        if(t < 0.15){
            m.material.opacity = t/0.15;
        } else if(t > 0.7){
            m.material.opacity = Math.max(0, (1-t)/0.3);
        } else {
            m.material.opacity = 1;
        }

        if(t >= 1){
            resetMeteor(m, true);
        }
    });
}

// ======================
// FLYING PHOTOS (ảnh bay qua)
// ======================

// 👉 Thay các đường dẫn dưới đây bằng ảnh của bạn
const IMAGE_PATHS = [
    './images/demo.png',
    './images/demo2.png',
    './images/demo3.png'
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
    { text: "Mau ăn chóng lớn 💛",                  color: "#ffd0a1" }
];

function makeTextTexture(text, color){

    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    const FS     = 110;

    // đo chữ trước rồi mới set kích thước canvas
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
// ANIMATION
// ======================

let time = 0;

function animate(){
    ringGroup.children.forEach(r => r.rotation.y += r.userData.speed);
    updateMeteors();
    updateFlyingPhotos();
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