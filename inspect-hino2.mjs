import { readFileSync } from 'fs';

const data = readFileSync('frontend/public/assets/Hino-Dutro/truk_refference_rig.glb');

// GLB format: first 12 bytes = magic + version + length
// Then chunks: each chunk has length (4 bytes), type (4 bytes), data
// First chunk is JSON, second is binary (optional)

const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
const magic = new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, 4));
console.log('Magic:', magic);

if (magic !== 'gltf') {
  console.log('Not a valid GLB file');
  process.exit(1);
}

const version = view.getUint32(4, true);
const length = view.getUint32(8, true);
console.log('Version:', version, 'Total length:', length);

let offset = 12;
while (offset < length) {
  const chunkLength = view.getUint32(offset, true);
  const chunkType = new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset + offset + 4, 4));
  console.log(`\nChunk at offset ${offset}: type=${chunkType}, length=${chunkLength}`);
  
  const chunkData = new Uint8Array(data.buffer, data.byteOffset + offset + 8, chunkLength);
  
  if (chunkType === 'JSON') {
    const jsonText = new TextDecoder().decode(chunkData);
    console.log('\n--- JSON CHUNK ---');
    console.log(jsonText.substring(0, 5000));
    
    try {
      const json = JSON.parse(jsonText);
      if (json.nodes) {
        console.log('\n\nNODES:');
        json.nodes.forEach((node, i) => {
          console.log(`  ${i}: name="${node.name}" mesh=${node.mesh} children=${JSON.stringify(node.children)} translation=${JSON.stringify(node.translation)} rotation=${JSON.stringify(node.rotation)} scale=${JSON.stringify(node.scale)}`);
        });
      }
      if (json.meshes) {
        console.log('\nMESHES:');
        json.meshes.forEach((mesh, i) => {
          console.log(`  ${i}: name="${mesh.name}" primitives=${mesh.primitives.length}`);
        });
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  }
  
  offset += 8 + chunkLength;
  // Align to 4 bytes
  offset = (offset + 3) & ~3;
}