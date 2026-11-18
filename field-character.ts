import {
  ACESFilmicToneMapping, Camera, DirectionalLight, Group, HemisphereLight, Matrix4,
  Object3D, Scene, Vector3, WebGLRenderer,
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
  const rig = await loadPracticeCharacter(character.url, source, character.fitId);
  const body = gameAthleteScale(profile);
  rig.setDimensions(body.width, body.height);
  root.add(rig.model);
  scene.add(root, new HemisphereLight(0xd6e9ff, 0x687462, 1.65));
  const light = new DirectionalLight(0xffead2, 2.15);
  light.position.set(-12, 20, 6);
  scene.add(light);

  const renderer = new WebGLRenderer({ canvas: field.canvas, context: field.gl });
  renderer.autoClear = false;
  renderer.toneMapping = ACESFilmicToneMapping;
  const camera = new Camera();
  const target = new Vector3();

  return {
    draw(transform: ArrayLike<number>, pose: JointMatrix, grounded: boolean) {
      matrix.fromArray(transform).decompose(root.position, root.quaternion, root.scale);
      root.scale.setScalar(1.17);
      readPose(pose);
      rig.pose(root, grounded);
      camera.position.fromArray(field.eye);
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
