export async function invokeCommand<T>(command: string, input: unknown): Promise<T> {
  const tauri = await import('@tauri-apps/api/tauri')
  return tauri.invoke<T>(command, { input })
}
