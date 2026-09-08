/**
 * UET-GPT medallion: a struck gold coin whose two faces carry the
 * university seal as a texture. The mark itself is the supplied PNG,
 * unaltered: nothing is redrawn, recoloured or cropped.
 *
 *   import { buildMedallion } from './medallion.js';
 *   const coin = await buildMedallion(THREE, './logo.png');
 *   scene.add(coin);          // coin.rotation.y = t  → spin
 *
 * Units: metres. Ø 100 mm, 11 mm thick. Faces +Z, resting on y = 0.
 * Named meshes/materials so OBJ/GLB exports land cleanly in Blender.
 * Looks best with scene.environment set (metal needs something to reflect).
 */
export async function buildMedallion(THREE, textureUrl = './logo.png') {
  const R = 0.05;                 // outer radius
  const T = 0.011;                // overall thickness
  const FACE = R * 0.9;           // seal field radius
  const FIELD_Z = T / 2 - 0.0009; // recessed field, below the bezel crest

  const seal = await new THREE.TextureLoader().loadAsync(textureUrl);
  seal.colorSpace = THREE.SRGBColorSpace;
  seal.anisotropy = 8;
  // Show the full artwork with a hairline of its own white margin, so the
  // mark's outer ring is never clipped by the bezel.
  seal.repeat.set(1.07, 1.07);
  seal.offset.set(-0.035, -0.035);

  const gold = new THREE.MeshStandardMaterial({
    name: 'gold', color: 0xe6c266, roughness: 0.26, metalness: 0.92,
    envMapIntensity: 1.5
  });
  const goldDark = new THREE.MeshStandardMaterial({
    name: 'gold_patina', color: 0xb0872f, roughness: 0.38, metalness: 0.9,
    envMapIntensity: 1.2
  });
  const enamelFront = new THREE.MeshPhysicalMaterial({
    name: 'seal_front', map: seal, roughness: 0.5, metalness: 0.0,
    envMapIntensity: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.18
  });
  const enamelBack = new THREE.MeshPhysicalMaterial({
    name: 'seal_back', map: seal, roughness: 0.5, metalness: 0.0,
    envMapIntensity: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.18
  });

  const coin = new THREE.Group();
  coin.name = 'uetgpt_medallion';

  // Struck blank: one lathed solid carrying the chamfered edge, the raised
  // bezel collar and the recessed field, so light breaks across real steps.
  const V = (r, y) => new THREE.Vector2(r, y);
  const half = [
    V(0, FIELD_Z),
    V(FACE + 0.0012, FIELD_Z),
    V(FACE + 0.0030, T / 2),
    V(R - 0.0022, T / 2),
    V(R - 0.0004, T / 2 - 0.0018),
    V(R, T / 2 - 0.0030),
  ];
  const profile = [
    ...half.map(p => V(p.x, -p.y)).reverse(),
    ...half,
  ];
  const blank = new THREE.Mesh(new THREE.LatheGeometry(profile, 160), gold);
  blank.name = 'blank';
  blank.rotation.x = Math.PI / 2;
  coin.add(blank);

  // Milled (knurled) edge: 108 flutes around the rim.
  const TICKS = 144;
  const flutes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.0013, T * 0.72, 0.0015), goldDark, TICKS
  );
  flutes.name = 'milled_edge';
  flutes.frustumCulled = false;
  const m = new THREE.Matrix4();
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * Math.PI * 2;
    m.makeRotationFromEuler(new THREE.Euler(0, a, 0));
    m.setPosition(Math.sin(a) * (R - 0.0006), 0, Math.cos(a) * (R - 0.0006));
    flutes.setMatrixAt(i, m);
  }
  flutes.rotation.x = Math.PI / 2;
  coin.add(flutes);

  // Seal on each side, sitting in the recessed field.
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'front' : 'back';

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(FACE, 160), side > 0 ? enamelFront : enamelBack
    );
    disc.name = `seal_${tag}`;
    disc.position.z = side * (FIELD_Z + 0.0004);
    if (side < 0) disc.rotation.y = Math.PI;
    coin.add(disc);

    // thin bright ring closing the gap between field and bezel wall
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(FACE + 0.0008, 0.0007, 16, 160), gold
    );
    ring.name = `field_ring_${tag}`;
    ring.position.z = side * (FIELD_Z + 0.0002);
    coin.add(ring);
  }

  coin.position.y = R;
  return coin;
}
