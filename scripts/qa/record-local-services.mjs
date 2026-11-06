import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const output = process.env.BK_QA_OUTPUT || 'artifacts/launch-real-services';
const names = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim().split('\n').filter(name => name.endsWith('_bk-launch-real-services'));
const services = names.map(name => {
  const metadata = execFileSync('docker', ['inspect', '--format', '{{json .Config.Image}}\n{{json .Image}}\n{{json .State.Status}}', name], { encoding: 'utf8' }).trim().split('\n').map(line => JSON.parse(line));
  return { name, image: metadata[0], imageId: metadata[1], status: metadata[2] };
});
for (const component of ['supabase_db_', 'supabase_auth_', 'supabase_rest_', 'supabase_realtime_']) if (!services.some(service => service.name.startsWith(component) && service.status === 'running')) throw new Error('required_real_service_missing');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'service-images.json'), JSON.stringify({ cli: '2.122.1', observedAt: new Date().toISOString(), services, copiedContainerEnvironment: false }, null, 2));
console.log(JSON.stringify({ runningRealServices: services.length, requiredComponentsPresent: true }));
