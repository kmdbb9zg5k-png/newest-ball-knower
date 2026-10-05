export interface NativeAuthSessionPlugin {
  authenticate(options: { url: string }): Promise<{ url: string }>;
}
export const NativeAuthSession: NativeAuthSessionPlugin;
