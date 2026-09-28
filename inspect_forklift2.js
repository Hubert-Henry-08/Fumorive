const fs = require('fs');
const data = fs.readFileSync('D:/PROJECT/Fumorive/frontend/public/assets/Forklift_Model/forkliftbaru.glb');
const text = new TextDecoder().decode(data);

let braceCount = 0, jsonStart = -1, jsonEnd = -1;
for (let i = 0; i < text.length; i++) {
  if (text[i] === '{') { if (braceCount === 0) jsonStart = i; braceCount++; }
  else if (text[i] === '}') { braceCount--; if (braceCount === 0 && jsonStart !== -1) { jsonEnd = i + 1; break; } }
}

const json = JSON.parse(text.substring(jsonStart, jsonEnd));

console.log('=== SCENES ===');
json.scenes?.forEach((scene, i) => {
  console.log(`  Scene ${i}: name="${scene.name}" nodes=${scene.nodes?.join(',')}`);
});

console.log('\n=== ROOT NODES (nodes in scene 0) ===');
if (json.scenes && json.scenes[0] && json.scenes[0].nodes) {
  json.scenes[0].nodes.forEach(nodeIndex => {
    const node = json.nodes[nodeIndex];
    console.log(`  Node ${nodeIndex}: name="${node.name}" mesh=${node.mesh !== undefined ? node.mesh : 'none (TransformNode)'} trans=${JSON.stringify(node.translation || 'none')} rot=${JSON.stringify(node.rotation || 'none')} scale=${JSON.stringify(node.scale || 'none')}`);
  });
}

console.log('\n=== ALL NODES ===');
json.nodes?.forEach((node, i) => {
  const children = node.children ? node.children.join(',') : 'none';
  console.log(`  ${i}: name="${node.name}" mesh=${node.mesh !== undefined ? node.mesh : 'none'} children=[${children}]`);
});