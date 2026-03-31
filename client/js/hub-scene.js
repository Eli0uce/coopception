/**
 * hub-scene.js — Scène Three.js du Hub Spatial
 * Three.js r165 (ES module)
 */
import * as THREE from 'three';

const canvas = document.getElementById('hub-canvas');

// ── Renderer ──
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// ── Scène & Caméra ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050f);
scene.fog = new THREE.FogExp2(0x02050f, 0.0022);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 0.8, 5.5);
camera.lookAt(0, 0, 0);

// ── Étoiles ──
const starVerts = new Float32Array(5000 * 3);
for (let i = 0; i < starVerts.length; i++) {
  starVerts[i] = (Math.random() - 0.5) * 320;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));

// Deux couches : étoiles proches (brillantes) + lointaines (tenues)
const starsNear = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0xaad4ff, size: 0.55, sizeAttenuation: true })
);
const starsFar = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: 0x445566, size: 0.25, sizeAttenuation: true })
);
starsFar.rotation.y = Math.PI * 0.3;
scene.add(starsNear, starsFar);

// ── Planète (corps principal) ──
const planetGeo = new THREE.SphereGeometry(1.8, 64, 64);
const planetMat = new THREE.MeshPhongMaterial({
  color:     0x0d2e52,
  emissive:  0x030d1c,
  specular:  0x4fc3f7,
  shininess: 80
});
const planet = new THREE.Mesh(planetGeo, planetMat);
scene.add(planet);

// Grille wireframe sur la planète (latitude/longitude)
const wireGeo = new THREE.SphereGeometry(1.815, 20, 20);
const wireMat = new THREE.MeshBasicMaterial({
  color:       0x4fc3f7,
  wireframe:   true,
  transparent: true,
  opacity:     0.055
});
scene.add(new THREE.Mesh(wireGeo, wireMat));

// ── Atmosphère (halo de bord) ──
// On utilise BackSide pour n'avoir que la silhouette lumineuse
const atmosGeo = new THREE.SphereGeometry(2.0, 64, 64);
const atmosMat = new THREE.MeshPhongMaterial({
  color:       0x1a7fbf,
  transparent: true,
  opacity:     0.14,
  side:        THREE.BackSide,
  depthWrite:  false
});
scene.add(new THREE.Mesh(atmosGeo, atmosMat));

// Couche externe plus diffuse
const outerAtmosGeo = new THREE.SphereGeometry(2.15, 64, 64);
const outerAtmosMat = new THREE.MeshPhongMaterial({
  color:       0x4fc3f7,
  transparent: true,
  opacity:     0.05,
  side:        THREE.BackSide,
  depthWrite:  false
});
scene.add(new THREE.Mesh(outerAtmosGeo, outerAtmosMat));

// ── Anneau orbital ──
const ringGeo = new THREE.TorusGeometry(3.1, 0.025, 8, 140);
const ringMat = new THREE.MeshBasicMaterial({
  color:       0x4fc3f7,
  transparent: true,
  opacity:     0.35
});
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI * 0.28;
ring.rotation.y = Math.PI * 0.08;
scene.add(ring);

// Anneau secondaire (inclinaison différente, plus ténu)
const ring2Geo = new THREE.TorusGeometry(3.8, 0.012, 8, 140);
const ring2Mat = new THREE.MeshBasicMaterial({
  color:       0x4fc3f7,
  transparent: true,
  opacity:     0.14
});
const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
ring2.rotation.x = Math.PI * 0.45;
ring2.rotation.z = Math.PI * 0.15;
scene.add(ring2);

// ── Lumières ──

// Ambiante (sombre bleutée — nuit spatiale)
const ambient = new THREE.AmbientLight(0x0a1835, 4);
scene.add(ambient);

// Lumière directionnelle principale (soleil) — chaud, de droite/haut
const sunLight = new THREE.DirectionalLight(0xffeedd, 3.5);
sunLight.position.set(7, 3, 4);
scene.add(sunLight);

// Contre-lumière (reflet de nébuleuse, teal, opposé au soleil)
const rimLight = new THREE.DirectionalLight(0x4fc3f7, 1.4);
rimLight.position.set(-6, -1, -4);
scene.add(rimLight);

// ── Animation ──
let t = 0;

function animate() {
  requestAnimationFrame(animate);
  t += 0.005;

  // Rotation de la planète (axe Y)
  planet.rotation.y  += 0.0018;

  // Rotation des anneaux
  ring.rotation.z    += 0.0005;
  ring2.rotation.z   -= 0.0003;

  // Dérive lente des étoiles (parallaxe)
  starsNear.rotation.y += 0.00008;

  // Légère oscillation de la caméra (respiration)
  camera.position.x = Math.sin(t * 0.07) * 0.5;
  camera.position.y = 0.8 + Math.cos(t * 0.05) * 0.25;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();

// ── Redimensionnement ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

