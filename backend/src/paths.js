import { fileURLToPath } from 'node:url';
export const rootPath = fileURLToPath(new URL('../../', import.meta.url));
export const localPath = fileURLToPath(new URL('../../.local/', import.meta.url));
export const configPath = fileURLToPath(new URL('../../.local/database.json', import.meta.url));
export const publicPath = fileURLToPath(new URL('../public/', import.meta.url));
