// ts-node's CommonJS loader doesn't follow the TS "nodenext" convention of
// writing `.js` in relative import specifiers that actually point at `.ts`
// source (the generated Prisma client does this). `nest build`/Jest both
// already paper over it (a real build emits real .js; Jest has a
// moduleNameMapper for it) — this does the same for ts-node-run scripts like
// prisma/seed.ts by falling back to the sibling `.ts` file when the literal
// `.js` path can't be resolved.
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request.endsWith('.js')) {
    try {
      return originalResolveFilename.call(this, request, ...rest);
    } catch {
      return originalResolveFilename.call(
        this,
        request.slice(0, -'.js'.length) + '.ts',
        ...rest,
      );
    }
  }
  return originalResolveFilename.call(this, request, ...rest);
};
