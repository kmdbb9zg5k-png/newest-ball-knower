export interface NativeAuthSessionPlugin {
  authenticate(options: { url: string }): Promise<{ url: string }>;
  authorizeAppleForDeletion(options: { nonce: string }): Promise<{ authorizationCode: string; user: string }>;
  notifyGmEvent(): Promise<void>;
}
export const NativeAuthSession: NativeAuthSessionPlugin;
