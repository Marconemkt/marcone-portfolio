// Logo 3D da seção de marcas: o ícone da coneMaker (SVG) vira um sólido com chanfro,
// iluminado por um ambiente de estúdio. Gira sozinho, inclina com a rolagem, pode ser
// arrastado e troca de acabamento nas bolinhas. Sem WebGL ou com "reduzir movimento",
// fica a imagem estática que já está no HTML.
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const secao = document.querySelector('.marcas');
const tela = secao?.querySelector('.tela3d');
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
const temWebGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

if (secao && tela && !reduz && temWebGL) {
  // só carrega quando a seção estiver chegando perto da tela
  const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { ob.disconnect(); iniciar(); } }, { rootMargin: '100% 0px' });
  ob.observe(secao);
}

async function iniciar() {
  const svg = await (await fetch('logos/conemaker-icone.svg')).text();

  const render = new THREE.WebGLRenderer({ canvas: tela, alpha: true, antialias: true });
  render.setPixelRatio(Math.min(devicePixelRatio, 2));
  render.toneMapping = THREE.ACESFilmicToneMapping;
  render.toneMappingExposure = 1.3;

  const cena = new THREE.Scene();
  cena.environment = new THREE.PMREMGenerator(render).fromScene(new RoomEnvironment(), 0.03).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const luz = (cor, i, x, y, z) => { const l = new THREE.DirectionalLight(cor, i); l.position.set(x, y, z); cena.add(l); };
  luz(0xffe3c4, 2.0, 4, 3, 5);   // principal, quente
  luz(0x9fd8ff, 1.6, -5, -2, -4); // contraluz azul bebê
  luz(0xffffff, 1.0, 0, 1, 8);    // preenchimento de frente

  // SVG -> formas -> sólido com chanfro arredondado
  const formas = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
  let geo = new THREE.ExtrudeGeometry(formas, {
    depth: 150, bevelEnabled: true, bevelThickness: 26, bevelSize: 22, bevelOffset: -10,
    bevelSegments: 8, curveSegments: 10,
  });
  geo.center();
  geo.rotateX(Math.PI); // o SVG cresce para baixo; girar 180° desvira sem inverter as faces
  geo = toCreasedNormals(geo, (50 * Math.PI) / 180);
  geo.computeBoundingBox();
  const tam = new THREE.Vector3();
  geo.boundingBox.getSize(tam);
  const k = 1 / Math.max(tam.x, tam.y);
  geo.scale(k, k, k);
  const larg = tam.x * k, alt = tam.y * k;

  const lado = THREE.DoubleSide;
  const acabamentos = {
    furtacor: new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 1, roughness: 0.14, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 820], clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2, side: lado }),
    laranja: new THREE.MeshPhysicalMaterial({ color: 0xe8571f, metalness: 0.2, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, side: lado }),
    prata: new THREE.MeshPhysicalMaterial({ color: 0xeef0f3, metalness: 1, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.08, envMapIntensity: 2.4, side: lado }),
    grafite: new THREE.MeshPhysicalMaterial({ color: 0x8a9099, metalness: 1, roughness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.05, envMapIntensity: 1.6, side: lado }),
  };
  const logo = new THREE.Mesh(geo, acabamentos.furtacor);
  cena.add(logo);
  secao.classList.add('em-3d');

  const botoes = [...secao.querySelectorAll('.materiais button')];
  for (const b of botoes) b.addEventListener('click', () => {
    logo.material = acabamentos[b.dataset.material];
    for (const x of botoes) x.setAttribute('aria-checked', String(x === b));
  });

  // arrastar a logo com o mouse ou o dedo, com inércia ao soltar
  const pino = secao.querySelector('.pino');
  const raio = new THREE.Raycaster(), ponto = new THREE.Vector2();
  const acertou = (x, y) => {
    const r = tela.getBoundingClientRect();
    ponto.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponto, camera);
    return raio.intersectObject(logo, false).length > 0;
  };
  let pegando = false, ux = 0, uy = 0, giroY = 0, giroX = 0, velY = 0, velX = 0;
  pino.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button') || !acertou(e.clientX, e.clientY)) return;
    e.preventDefault();
    pegando = true; ux = e.clientX; uy = e.clientY;
    pino.setPointerCapture(e.pointerId); pino.classList.add('agarrando');
  });
  pino.addEventListener('pointermove', e => {
    if (!pegando) { if (e.pointerType === 'mouse') pino.classList.toggle('sobre-logo', acertou(e.clientX, e.clientY)); return; }
    velY = (e.clientX - ux) * 0.01; velX = (e.clientY - uy) * 0.01;
    giroY += velY; giroX += velX; ux = e.clientX; uy = e.clientY;
  });
  const soltar = () => { pegando = false; pino.classList.remove('agarrando'); };
  pino.addEventListener('pointerup', soltar);
  pino.addEventListener('pointercancel', soltar);

  // a logo ocupa ~42% da altura no computador e ~62% da largura no celular
  let escala = 1;
  const ajustar = () => {
    const r = tela.getBoundingClientRect();
    render.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    const vAlt = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const vLarg = vAlt * camera.aspect;
    escala = Math.min((vAlt * 0.42) / alt, (vLarg * 0.62) / larg);
    logo.scale.setScalar(escala);
  };
  addEventListener('resize', ajustar);
  ajustar();

  let visivel = false;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; }).observe(tela);
  const relogio = new THREE.Clock();
  const quadro = () => {
    requestAnimationFrame(quadro);
    if (!visivel) return;
    const t = relogio.getElapsedTime();
    const p = parseFloat(secao.style.getPropertyValue('--p')) || 0;
    if (!pegando) { giroY += velY; giroX += velX; velY *= 0.94; velX *= 0.94; giroX *= 0.985; }
    logo.rotation.y = t * 0.25 + giroY;
    logo.rotation.x = -0.1 + (p - 0.5) * 0.2 + giroX;
    const sobe = Math.max(0, (p - 0.84) / 0.16); // no fim da seção a logo sobe e sai
    logo.position.y = Math.sin(t * 1.1) * 0.06 + sobe * sobe * 7;
    render.render(cena, camera);
  };
  quadro();
}
