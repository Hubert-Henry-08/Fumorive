import { readFileSync } from 'fs';

const data = readFileSync('frontend/public/assets/Hino-Dutro/truk_refference_rig.glb');

const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
const magic = new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, 4));
console.log('Magic:', JSON.stringify(magic));

const version = view.getUint32(4, true);
const length = view.getUint32(8, true);
console.log('Version:', version, 'Total length:', length);

let offset = 12;
while (offset < length) {
  const chunkLength = view.getUint32(offset, true);
  const chunkTypeArr = new Uint8Array(data.buffer, data.byteOffset + offset + 4, 4);
  const chunkType = new TextDecoder().decode(chunkTypeArr);
  
  const chunkData = new Uint8Array(data.buffer, data.byteOffset + offset + 8, chunkLength);
  
  if (chunkType === 'JSON') {
    const jsonText = new TextDecoder().decode(chunkData);
    try {
      const json = JSON.parse(jsonText);
      if (json.nodes) {
        console.log('\n=== NODES (with hierarchy) ===');
        json.nodes.forEach((node, i) => {
          const hasChildren = node.children && node.children.length > 0;
          const childrenStr = hasChildren ? ` children=${JSON.stringify(node.children)}` : '';
          const trans = node.translation ? ` pos=[${node.translation.join(', ')}]` : '';
          const rot = node.rotation ? ` rot=[${node.rotation.join(', ')}]` : '';
          const scale = node.scale ? ` scale=[${node.scale.join(', ')}]` : '';
          const mesh = node.mesh !== undefined ? ` mesh=${node.mesh}` : '';
          console.log(`  ${i}: name="${node.name}"${mesh}${trans}${rot}${scale}${childrenStr}`);
        });
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }
  
  offset += 8 + chunkLength;
  offset = (offset + 3) & ~3;
}