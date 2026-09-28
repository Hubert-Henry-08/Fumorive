import { readFileSync } from 'fs';

// Read the aircraft GLB
const data = readFileSync('frontend/public/assets/Airplane_Vultee_BT-13_Valiant/classic_trainer_aircraft.glb');

// Find the JSON chunk (it's typically at the beginning of a GLB)
const text = new TextDecoder().decode(data);

// Find the JSON boundary - look for the first complete JSON object
let braceCount = 0;
let jsonStart = -1;
let jsonEnd = -1;

for (let i = 0; i < text.length; i++) {
  if (text[i] === '{') {
    if (braceCount === 0) jsonStart = i;
    braceCount++;
  } else if (text[i] === '}') {
    braceCount--;
    if (braceCount === 0 && jsonStart !== -1) {
      jsonEnd = i + 1;
      break;
    }
  }
}

if (jsonStart !== -1 && jsonEnd !== -1) {
  const jsonText = text.substring(jsonStart, jsonEnd);
  try {
    const json = JSON.parse(jsonText);
    
    console.log('=== GLTF STRUCTURE ===');
    console.log('scenes:', json.scenes?.length);
    console.log('nodes:', json.nodes?.length);
    console.log('meshes:', json.meshes?.length);
    console.log('animations:', json.animations?.length);
    console.log('accessors:', json.accessors?.length);
    console.log('buffers:', json.buffers?.length);
    console.log('bufferViews:', json.bufferViews?.length);
    
    if (json.scenes) {
      console.log('\n=== SCENES ===');
      json.scenes.forEach((scene, i) => {
        console.log(`  Scene ${i}: name="${scene.name}" nodes=${scene.nodes?.join(',')}`);
      });
    }
    
    if (json.nodes) {
      console.log('\n=== NODES (full) ===');
      json.nodes.forEach((node, i) => {
        console.log(`  Node ${i}:`);
        console.log(`    name: "${node.name}"`);
        console.log(`    mesh: ${node.mesh !== undefined ? node.mesh : 'none'}`);
        console.log(`    children: ${node.children ? node.children.join(',') : 'none'}`);
        console.log(`    translation: ${node.translation ? node.translation.join(', ') : 'none'}`);
        console.log(`    rotation: ${node.rotation ? node.rotation.join(', ') : 'none'}`);
        console.log(`    scale: ${node.scale ? node.scale.join(', ') : 'none'}`);
        console.log(`    matrix: ${node.matrix ? node.matrix.join(', ') : 'none'}`);
      });
    }
    
    if (json.meshes) {
      console.log('\n=== MESHES ===');
      json.meshes.forEach((mesh, i) => {
        console.log(`  Mesh ${i}: name="${mesh.name}"`);
        if (mesh.primitives) {
          mesh.primitives.forEach((prim, pi) => {
            console.log(`    Primitive ${pi}:`);
            console.log(`      mode: ${prim.mode !== undefined ? prim.mode : 4}`);
            console.log(`      indices: ${prim.indices !== undefined ? prim.indices : 'none'}`);
            console.log(`      material: ${prim.material !== undefined ? prim.material : 'none'}`);
            console.log(`      attributes: ${Object.keys(prim.attributes).join(', ')}`);
            Object.keys(prim.attributes).forEach(attr => {
              console.log(`        ${attr}: accessor ${prim.attributes[attr]}`);
            });
          });
        }
      });
    }
    
    if (json.animations) {
      console.log('\n=== ANIMATIONS ===');
      json.animations.forEach((anim, i) => {
        console.log(`  Animation ${i}: name="${anim.name}"`);
        if (anim.channels) {
          anim.channels.forEach((ch, ci) => {
            console.log(`    Channel ${ci}: target.node=${ch.target?.node} path=${ch.target?.path} sampler=${ch.sampler}`);
          });
        }
        if (anim.samplers) {
          anim.samplers.forEach((sam, si) => {
            console.log(`    Sampler ${si}: input=${sam.input} output=${sam.output} interpolation=${sam.interpolation}`);
          });
        }
      });
    }
    
    // Find accessors with min/max for bounding box
    if (json.accessors && json.bufferViews && json.buffers) {
      console.log('\n=== BOUNDING BOXES (from accessors with min/max) ===');
      json.accessors.forEach((acc, i) => {
        if (acc.min !== undefined || acc.max !== undefined) {
          console.log(`  Accessor ${i}:`);
          console.log(`    componentType: ${acc.componentType}`);
          console.log(`    type: ${acc.type}`);
          console.log(`    count: ${acc.count}`);
          console.log(`    min: [${acc.min.join(', ')}]`);
          console.log(`    max: [${acc.max.join(', ')}]`);
          console.log(`    bufferView: ${acc.bufferView}`);
        }
      });
    }
    
  } catch (e) {
    console.log('Could not parse JSON:', e.message);
  }
} else {
  console.log('Could not find JSON chunk');
}