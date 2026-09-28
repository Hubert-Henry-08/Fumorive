import { readFileSync } from 'fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Can't use three easily without install. Let's try a different approach.

// Just read the GLB as binary and search for node names
const data = readFileSync('frontend/public/assets/Hino-Dutro/truk_refference_rig.glb');
const text = new TextDecoder().decode(data);

// Search for node names (they appear in the JSON chunk)
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  try {
    const json = JSON.parse(jsonMatch[0]);
    if (json.nodes) {
      console.log('NODES:');
      json.nodes.forEach((node, i) => {
        console.log(`  ${i}: name="${node.name}" mesh=${node.mesh} children=${node.children} translation=${node.translation} rotation=${node.rotation} scale=${node.scale}`);
      });
    }
    if (json.meshes) {
      console.log('\nMESHES:');
      json.meshes.forEach((mesh, i) => {
        console.log(`  ${i}: name="${mesh.name}" primitives=${mesh.primitives.length}`);
      });
    }
  } catch (e) {
    console.log('Could not parse JSON chunk');
  }
}

// Also search for common node names in the raw text
const nodeNames = ['STEERING', 'steering', 'Steering', 'DRIVER', 'driver', 'Driver', 'HEAD', 'head', 'Head', 'SEAT', 'seat', 'Seat', 'CABIN', 'cabin', 'Cabin', 'WINDSHIELD', 'windshield', 'Windshield', 'DASHBOARD', 'dashboard', 'Dashboard', 'CTRL_TRUCK'];
nodeNames.forEach(name => {
  const regex = new RegExp(`"name"\\s*:\\s*"[^"]*${name}[^"]*"`, 'gi');
  const matches = text.match(regex);
  if (matches) {
    console.log(`\nFound "${name}":`, matches.slice(0, 5));
  }
});