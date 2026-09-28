import { readFileSync } from 'fs';

// Read the aircraft GLB
const data = readFileSync('frontend/public/assets/Airplane_Vultee_BT-13_Valiant/classic_trainer_aircraft.glb');
const text = new TextDecoder().decode(data);

// Search for node names in the JSON chunk
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  try {
    const json = JSON.parse(jsonMatch[0]);
    if (json.nodes) {
      console.log('=== NODES ===');
      json.nodes.forEach((node, i) => {
        console.log(`  ${i}: name="${node.name}" mesh=${node.mesh !== undefined ? node.mesh : 'none'} children=${node.children ? node.children.join(',') : 'none'} translation=${node.translation} rotation=${node.rotation} scale=${node.scale}`);
      });
    }
    if (json.meshes) {
      console.log('\n=== MESHES ===');
      json.meshes.forEach((mesh, i) => {
        console.log(`  ${i}: name="${mesh.name}" primitives=${mesh.primitives.length}`);
        if (mesh.primitives) {
          mesh.primitives.forEach((prim, pi) => {
            console.log(`     Primitive ${pi}: attributes=${Object.keys(prim.attributes).join(', ')}`);
          });
        }
      });
    }
    if (json.animations) {
      console.log('\n=== ANIMATIONS ===');
      json.animations.forEach((anim, i) => {
        console.log(`  ${i}: name="${anim.name}" channels=${anim.channels.length} samplers=${anim.samplers.length}`);
        if (anim.channels) {
          anim.channels.forEach((ch, ci) => {
            console.log(`     Channel ${ci}: target=${ch.target?.node} path=${ch.target?.path} sampler=${ch.sampler}`);
          });
        }
      });
    }
    if (json.accessors) {
      console.log('\n=== ACCESSORS (for bounding box info) ===');
      json.accessors.forEach((acc, i) => {
        if (acc.min !== undefined || acc.max !== undefined) {
          console.log(`  ${i}: min=${acc.min} max=${acc.max} count=${acc.count}`);
        }
      });
    }
  } catch (e) {
    console.log('Could not parse JSON chunk:', e.message);
  }
}

// Search for propeller/engine related names in raw text
const searchTerms = ['propeller', 'Propeller', 'PROPELLER', 'prop', 'Prop', 'engine', 'Engine', 'spinner', 'Spinner', 'blade', 'Blade', 'rotor', 'Rotor', 'wheel', 'Wheel', 'gear', 'Gear', 'landing', 'Landing', 'wing', 'Wing', 'tail', 'Tail', 'rudder', 'Rudder', 'elevator', 'Elevator', 'aileron', 'Aileron', 'flap', 'Flap', 'cockpit', 'Cockpit', 'pilot', 'Pilot', 'fuselage', 'Fuselage'];
searchTerms.forEach(term => {
  const regex = new RegExp(`"name"\\s*:\\s*"[^"]*${term}[^"]*"`, 'gi');
  const matches = text.match(regex);
  if (matches) {
    console.log(`\nFound "${term}":`, matches.slice(0, 10));
  }
});

// Also search for node names with common aircraft terms
const nodeNameMatches = text.match(/"name"\s*:\s*"[^"]*"/gi);
if (nodeNameMatches) {
  console.log('\n=== ALL NODE NAMES (from raw text) ===');
  const uniqueNames = [...new Set(nodeNameMatches)];
  uniqueNames.forEach(name => console.log(`  ${name}`));
}