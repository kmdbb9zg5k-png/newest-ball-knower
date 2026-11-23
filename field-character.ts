import {
  ACESFilmicToneMapping, Camera, DirectionalLight, Group, HemisphereLight, Matrix4,
  Mesh, Object3D, Scene, Texture, Vector3, WebGLRenderer,
} from 'three';
import { loadPracticeCharacter, sourceJointNames } from './combine/practice-character.js';
import { gameAthleteScale } from './public/play-moment-3d/game-athlete.js';
import { purchasedCharacterAsset } from './characterPurchases';

type Field = { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext; vp: ArrayLike<number>; eye: number[]; target: number[] };
type Profile = Parameters<typeof gameAthleteScale>[0] & { character: string };
type JointMatrix = (name: string) => ArrayLike<number> | undefined;

export async function loadFieldCharacter(field: Field, profile: Profile, bindPose: JointMatrix) {
  const character = await purchasedCharacterAsset(profile.character);
  if (!character) return null;

  const scene = new Scene();
  const root = new Group();
  const source: Record<string, Object3D> = {};
  const matrix = new Matrix4();
  function readPose(joints: JointMatrix) {
    for (const name of sourceJointNames) {
      const values = joints(name);
      if (!values) throw new Error('Missing football joint ' + name);
      const bone = source[name];
      matrix.fromArray(values).decompose(bone.position, bone.quaternion, bone.scale);
    }
    root.updateMatrixWorld(true);
  }
  for (const name of sourceJointNames) {
    source[name] = new Object3D();
    root.add(source[name]);
  }
  readPose(bindPose);
  const touch = matchMedia('(pointer: coarse)').matches;
  const textureLimit = touch ? 1536 : 2048;
  const rig = await loadPracticeCharacter(character.url, source, character.fitId, textureLimit);
  const body = gameAthleteScale(profile);
  rig.setDimensions(body.width, body.height);
  root.add(rig.model);
  scene.add(root, new HemisphereLight(0xd6e9ff, 0x687462, 1.42));
  const stadiumKey = new DirectionalLight(0xffead2, 1.88);
  stadiumKey.position.set(-12, 20, 6);
  const cameraFill = new DirectionalLight(0xd7e8ff, 1.16);
  const rim = new DirectionalLight(0xaccfff, 1.25);
  const lightTarget = new Object3D();
  cameraFill.target = lightTarget;
  rim.target = lightTarget;
  scene.add(stadiumKey, cameraFill, rim, lightTarget);

  const renderer = new WebGLRenderer({ canvas: field.canvas, context: field.gl });
  renderer.autoClear = false;
  renderer.toneMapping = ACESFilmicToneMapping;
  const anisotropy = Math.max(1, Math.min(touch ? 4 : 8, renderer.capabilities.getMaxAnisotropy()));
  const textures = new Set<Texture>();
  rig.model.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value);
      }
    }
  });
  for (const texture of textures) texture.anisotropy = anisotropy;
  const presentation = {
    textureLimit,
    textureCount: textures.size,
    largestTexture: Math.max(0, ...Array.from(textures, texture =>
      Math.max(texture.image?.width ?? 0, texture.image?.height ?? 0))),
    anisotropy,
  };
  const camera = new Camera();
  const target = new Vector3();
  const viewSide = new Vector3();

  return {
    presentation,
    draw(transform: ArrayLike<number>, pose: JointMatrix, grounded: boolean) {
      matrix.fromArray(transform).decompose(root.position, root.quaternion, root.scale);
      root.scale.setScalar(1.17);
      readPose(pose);
      rig.pose(root, grounded);
      camera.position.fromArray(field.eye);
      lightTarget.position.copy(root.position);
      lightTarget.position.y += 1;
      viewSide.subVectors(camera.position, lightTarget.position);
      viewSide.y = 0;
      viewSide.normalize();
      cameraFill.position.copy(lightTarget.position).addScaledVector(viewSide, 7);
      cameraFill.position.y += 7;
      rim.position.copy(lightTarget.position).addScaledVector(viewSide, -6);
      rim.position.x += viewSide.z * 3;
      rim.position.z -= viewSide.x * 3;
      rim.position.y += 5;
      camera.lookAt(target.fromArray(field.target));
      camera.updateMatrixWorld(true);
      camera.projectionMatrix.fromArray(field.vp).multiply(camera.matrixWorld);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      renderer.setViewport(0, 0, field.canvas.width, field.canvas.height);
      renderer.render(scene, camera);
      renderer.resetState();
      field.gl.clearColor(.009, .016, .029, 1);
      field.gl.enable(field.gl.DEPTH_TEST);
      field.gl.disable(field.gl.CULL_FACE);
      return renderer.info.render.calls;
    },
    dispose() { rig.dispose(); renderer.dispose(); },
  };
}
