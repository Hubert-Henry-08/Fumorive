const fs = require('fs');

const data = fs.readFileSync('D:/PROJECT/Fumorive/frontend/public/assets/Forklift_Model/forkliftbaru.glb');
const text = new TextDecoder().decode(data);

let braceCount = 0, jsonStart = -1, jsonEnd = -1;
for (let i = 0; i < text.length; i++) {
  if (text[i] === '{') { if (braceCount === 0) jsonStart = i; braceCount++; }
  else if (text[i] === '}') { braceCount--; if (braceCount === 0 && jsonStart !== -1) { jsonEnd = i + 1; break; } }
}

const json = JSON.parse(text.substring(jsonStart, jsonEnd));

console.log('=== FORKLIFT MODEL NODES ===');
json.nodes?.forEach((node, i) => {
  console.log(`  ${i}: name="${node.name}" mesh=${node.mesh !== undefined ? node.mesh : 'none'} rot=${JSON.stringify(node.rotation || 'none')} trans=${JSON.stringify(node.translation || 'none')} scale=${JSON.stringify(node.scale || 'none')}`);
});

if (json.meshes) {
  console.log('\n=== MESHES ===');
  json.meshes?.forEach((mesh, i) => {
    console.log(`  ${i}: name="${mesh.name}" primitives=${mesh.primitives.length}`);
    if (mesh.primitives) {
      mesh.primitives.forEach((prim, pi) => {
        console.log(`     Primitive ${pi}: attributes=${Object.keys(prim.attributes).join(', ')}`);
      });
    }
  });
}

if (json.accessors) {
  console.log('\n=== ACCESSORS (bounding box) ===');
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  json.accessors.forEach((acc, i) => {
    if (acc.min !== undefined && acc.max !== undefined && acc.min.length >= 3) {
      for (let d = 0; d < 3; d++) {
        if (acc.min[d] < min[d]) min[d] = acc.min[d];
        if (acc.max[d] > max[d]) max[d] = acc.max[d];
      }
    }
  });
  console.log('  Overall min:', min.map(v => v.toFixed(3)).join(', '));
  console.log('  Overall max:', max.map(v => v.toFixed(3)).join(', '));
  console.log('  Overall size:', min.map((v, i) => (max[i] - v).toFixed(3)).join(', '));
  
  console.log('\n  Per-accessor min/max:');
  json.accessors.forEach((acc, i) => {
    if (acc.min !== undefined && acc.max !== undefined && acc.min.length >= 3) {
      console.log(`  Accessor ${i}: min=[${acc.min.map(v=>v.toFixed(3)).join(',')}] max=[${acc.max.map(v=>v.toFixed(3)).join(',')}] count=${acc.count}`);
    }
  });
}

const searchTerms = ['fork', 'Fork', 'FORK', 'carriage', 'Carriage', 'mast', 'Mast', 'wheel', 'Wheel', 'tire', 'Tire', 'mast', 'Mast', 'carriage', 'Carriage', 'ForkTip', 'forktip', 'ForkHeel', 'forkheel', 'Fork_', 'Fork_', 'ForkHeel_', 'ForkTip_'];
searchTerms.forEach(term => {
  const regex = new RegExp(`"name"\\s*:\\s*"[^"]*${term}[^"]*"`, 'gi');
  const matches = text.match(regex);
  if (matches) {
    console.log(`\nFound "${term}":`, matches.slice(0, 10));
  }
});

const nodeNameMatches = text.match(/"name"\s*:\s*"[^"]*"/gi);
if (nodeNameMatches) {
  console.log('\n=== ALL NODE NAMES ===');
  const uniqueNames = [...new Set(nodeNameMatches)];
  uniqueNames.forEach(name => console.log(`  ${name}`));
}