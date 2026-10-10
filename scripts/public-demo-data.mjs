import vm from 'node:vm';
import { publicGalleryEntry } from '../src/lib/galleryPublicModel.js';
export { publicGalleryEntry };

// Keep the original local import intact, but never ship imported customer records.
// This runs at build time, not as client-side redaction of an already leaked bundle.
export function publicDemoDataPlugin() {
  return {
    name: 'public-demo-data', apply: 'build', enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/lib/api/mockData.js')) return null;
      const names = [...code.matchAll(/export const (\w+)\s*=/g)].map(match => match[1]);
      const data = vm.runInNewContext(code.replace(/export const /g, 'const ') + `\n({${names.join(',')}})`, {}, { timeout: 1000 });
      data.initialOrders = [];
      data.initialGallery = data.initialGallery.filter(entry => entry.tampil_di_home === true).map(publicGalleryEntry);
      return { code: names.map(name => `export const ${name} = ${JSON.stringify(data[name])};`).join('\n'), map: null };
    },
  };
}
