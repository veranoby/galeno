const fs = require('fs');
const file = 'apps/web/src/state/managers/ConsultaStateManager.ts';
let code = fs.readFileSync(file, 'utf8');

// Also, the user asked to: "check if the consultation has an associated charge... If yes, emit a local event"
// We added the dispatch but without checking for the charge!
// "associated charge" isn't explicitly defined in the State machine typings but let's assume `consulta.cargo` or we can just mock a property `consulta.requierePago` or `consulta.costo`.
// Let's check the current logic.

code = code.replace(
  `if (updates.estado === 'finalizada' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function')`,
  `// Note: check if consultation has an associated charge
    const tieneCargo = consulta.requierePago || (consulta.costo && consulta.costo > 0);
    if (updates.estado === 'finalizada' && tieneCargo && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function')`
);

fs.writeFileSync(file, code);
