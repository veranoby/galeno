/**
 * Utilidad para renderizar plantillas de email
 */
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = path.join(__dirname, 'templates');

/**
 * Cache de plantillas cargadas
 */
const templateCache = new Map<string, string>();

/**
 * Carga una plantilla desde el sistema de archivos
 */
function loadTemplate(templateName: string): string {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const templatePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
  
  try {
    const content = fs.readFileSync(templatePath, 'utf-8');
    templateCache.set(templateName, content);
    return content;
  } catch (error) {
    throw new Error(
      `Plantilla "${templateName}" no encontrada en ${templatePath}`
    );
  }
}

/**
 * Reemplaza variables en una plantilla
 */
function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  // Manejo de condicionales simples {{#if variable}}...{{/if}}
  const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
  result = result.replace(ifRegex, (_match, varName, content) => {
    const varValue = variables[varName];
    return varValue ? content : '';
  });

  return result;
}

/**
 * Renderiza una plantilla con variables
 */
export function renderTemplate(
  templateName: string,
  variables: Record<string, string>
): string {
  const template = loadTemplate(templateName);
  return replaceVariables(template, variables);
}

/**
 * Limpia el cache de plantillas (útil para desarrollo)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}

/**
 * Precarga todas las plantillas disponibles
 */
export function preloadTemplates(): string[] {
  try {
    const files = fs.readdirSync(TEMPLATES_DIR);
    const templates = files
      .filter(file => file.endsWith('.html'))
      .map(file => file.replace('.html', ''));
    
    templates.forEach(name => loadTemplate(name));
    
    return templates;
  } catch (error) {
    console.error('Error al precargar plantillas:', error);
    return [];
  }
}
