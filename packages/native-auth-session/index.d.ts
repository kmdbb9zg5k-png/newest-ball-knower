export interface NativeAuthSessionPlugin {
  authenticate(options: { url: string }): Promise<{ url: string }>;
  authorizeAppleForDeletion(options: { nonce: string }): Promise<{ authorizationCode: string; user: string }>;
}
export const NativeAuthSession: NativeAuthSessionPlugin;
