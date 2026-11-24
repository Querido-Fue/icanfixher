import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';

const source = fileURLToPath(new URL('../../project/', import.meta.url));
const output = fileURLToPath(new URL('../.wrangler/game-assets/', import.meta.url));
const game = join(output, 'icanfixher');

// Only the browser distribution is published. Rebuild it so obsolete assets disappear.
await rm(output, { recursive: true, force: true });
await mkdir(game, { recursive: true });
for (const entry of ['index.html', 'engine', 'asset', 'license']) {
    await cp(join(source, entry), join(game, entry), {
        recursive: true,
        filter: path => basename(path) !== 'api_key.txt'
    });
}
