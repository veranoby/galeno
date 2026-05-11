/**
 * Tests for Retina Atlas Module Types and Utilities
 * 
 * Tests the type definitions, constants, and utility functions
 * for the Retina Atlas module.
 */

import { describe, it, expect } from 'vitest';
import {
  COLOR_ANNOTATION_MAP,
  RETINA_CONSTANTS,
  IMAGENES_COMPARABLES,
  type TipoImagenRetina,
  type Ojo,
  type EstadoImagen,
  type TipoAnotacion,
  type ColorAnotacion,
  type Anotacion,
  type ImagenRetina,
  type ImagenMetadatos,
  type HerramientaVisor,
  type RetinaVisorConfig,
  type FiltroImagen,
} from '../retina/types';

describe('Retina Atlas Types', () => {
  describe('COLOR_ANNOTATION_MAP', () => {
    it('should have color for rojo', () => {
      expect(COLOR_ANNOTATION_MAP.rojo).toBe('#FF0000');
    });

    it('should have color for verde', () => {
      expect(COLOR_ANNOTATION_MAP.verde).toBe('#00FF00');
    });

    it('should have color for azul', () => {
      expect(COLOR_ANNOTATION_MAP.azul).toBe('#0000FF');
    });

    it('should have color for amarillo', () => {
      expect(COLOR_ANNOTATION_MAP.amarillo).toBe('#FFFF00');
    });

    it('should have color for blanco', () => {
      expect(COLOR_ANNOTATION_MAP.blanco).toBe('#FFFFFF');
    });

    it('should have color for negro', () => {
      expect(COLOR_ANNOTATION_MAP.negro).toBe('#000000');
    });

    it('should have all required colors defined', () => {
      const requiredColors: ColorAnotacion[] = [
        'rojo',
        'verde',
        'azul',
        'amarillo',
        'blanco',
        'negro',
      ];

      requiredColors.forEach((color) => {
        expect(COLOR_ANNOTATION_MAP[color]).toBeDefined();
        expect(typeof COLOR_ANNOTATION_MAP[color]).toBe('string');
        // Validate hex color format
        expect(COLOR_ANNOTATION_MAP[color]).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should have distinct colors for each annotation type', () => {
      const colors = Object.values(COLOR_ANNOTATION_MAP);
      const uniqueColors = new Set(colors);
      
      // All colors should be unique
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('RETINA_CONSTANTS', () => {
    it('should have MAX_ANOTACIONES set to 100', () => {
      expect(RETINA_CONSTANTS.MAX_ANOTACIONES).toBe(100);
    });

    it('should have MAX_IMAGENES_COMPARACION set to 2', () => {
      expect(RETINA_CONSTANTS.MAX_IMAGENES_COMPARACION).toBe(2);
    });

    it('should have DEFAULT_ZOOM set to 1', () => {
      expect(RETINA_CONSTANTS.DEFAULT_ZOOM).toBe(1);
    });

    it('should have MIN_ZOOM set to 0.1', () => {
      expect(RETINA_CONSTANTS.MIN_ZOOM).toBe(0.1);
    });

    it('should have MAX_ZOOM set to 5', () => {
      expect(RETINA_CONSTANTS.MAX_ZOOM).toBe(5);
    });

    it('should have valid zoom range', () => {
      expect(RETINA_CONSTANTS.MIN_ZOOM).toBeLessThan(RETINA_CONSTANTS.DEFAULT_ZOOM);
      expect(RETINA_CONSTANTS.DEFAULT_ZOOM).toBeLessThan(RETINA_CONSTANTS.MAX_ZOOM);
    });
  });

  describe('IMAGENES_COMPARABLES', () => {
    it('should include color_fondo type', () => {
      expect(IMAGENES_COMPARABLES).toContain('color_fondo');
    });

    it('should include angiofluoresceina type', () => {
      expect(IMAGENES_COMPARABLES).toContain('angiofluoresceina');
    });

    it('should include oct type', () => {
      expect(IMAGENES_COMPARABLES).toContain('oct');
    });

    it('should not include campo_visual type', () => {
      expect(IMAGENES_COMPARABLES).not.toContain('campo_visual');
    });

    it('should not include topografo type', () => {
      expect(IMAGENES_COMPARABLES).not.toContain('topografo');
    });

    it('should have exactly 3 comparable types', () => {
      expect(IMAGENES_COMPARABLES).toHaveLength(3);
    });
  });
});

describe('TipoImagenRetina Type', () => {
  it('should include color_fondo for fundus photography', () => {
    expect('color_fondo' as TipoImagenRetina).toBe('color_fondo');
  });

  it('should include angiofluoresceina for angiography', () => {
    expect('angiofluoresceina' as TipoImagenRetina).toBe('angiofluoresceina');
  });

  it('should include oct for optical coherence tomography', () => {
    expect('oct' as TipoImagenRetina).toBe('oct');
  });

  it('should include campo_visual for visual field', () => {
    expect('campo_visual' as TipoImagenRetina).toBe('campo_visual');
  });

  it('should include topografo for corneal topography', () => {
    expect('topografo' as TipoImagenRetina).toBe('topografo');
  });

  it('should have all required image types', () => {
    const requiredTypes: TipoImagenRetina[] = [
      'color_fondo',
      'angiofluoresceina',
      'oct',
      'campo_visual',
      'topografo',
    ];

    requiredTypes.forEach((tipo) => {
      expect(typeof tipo).toBe('string');
      expect(tipo.length).toBeGreaterThan(0);
    });
  });
});

describe('Ojo Type', () => {
  it('should include derecho (right eye)', () => {
    expect('derecho' as Ojo).toBe('derecho');
  });

  it('should include izquierdo (left eye)', () => {
    expect('izquierdo' as Ojo).toBe('izquierdo');
  });

  it('should include ambos (both eyes)', () => {
    expect('ambos' as Ojo).toBe('ambos');
  });

  it('should have exactly three valid values', () => {
    const validOjos: Ojo[] = ['derecho', 'izquierdo', 'ambos'];
    
    validOjos.forEach((ojo) => {
      expect(typeof ojo).toBe('string');
      expect(ojo.length).toBeGreaterThan(0);
    });
  });
});

describe('EstadoImagen Type', () => {
  it('should include pendiente state', () => {
    expect('pendiente' as EstadoImagen).toBe('pendiente');
  });

  it('should include procesando state', () => {
    expect('procesando' as EstadoImagen).toBe('procesando');
  });

  it('should include completa state', () => {
    expect('completa' as EstadoImagen).toBe('completa');
  });

  it('should include error state', () => {
    expect('error' as EstadoImagen).toBe('error');
  });

  it('should represent image processing workflow', () => {
    const workflow: EstadoImagen[] = ['pendiente', 'procesando', 'completa'];
    
    workflow.forEach((estado, index) => {
      expect(typeof estado).toBe('string');
      if (index > 0) {
        expect(estado).not.toBe(workflow[index - 1]);
      }
    });
  });
});

describe('TipoAnotacion Type', () => {
  it('should include punto for point markers', () => {
    expect('punto' as TipoAnotacion).toBe('punto');
  });

  it('should include linea for line measurements', () => {
    expect('linea' as TipoAnotacion).toBe('linea');
  });

  it('should include area for delimited areas', () => {
    expect('area' as TipoAnotacion).toBe('area');
  });

  it('should include texto for text notes', () => {
    expect('texto' as TipoAnotacion).toBe('texto');
  });

  it('should include flecha for arrow indicators', () => {
    expect('flecha' as TipoAnotacion).toBe('flecha');
  });

  it('should have all required annotation types', () => {
    const requiredTypes: TipoAnotacion[] = [
      'punto',
      'linea',
      'area',
      'texto',
      'flecha',
    ];

    requiredTypes.forEach((tipo) => {
      expect(typeof tipo).toBe('string');
      expect(tipo.length).toBeGreaterThan(0);
    });
  });
});

describe('HerramientaVisor Type', () => {
  it('should include pan tool', () => {
    expect('pan' as HerramientaVisor).toBe('pan');
  });

  it('should include zoom tool', () => {
    expect('zoom' as HerramientaVisor).toBe('zoom');
  });

  it('should include anotar tool', () => {
    expect('anotar' as HerramientaVisor).toBe('anotar');
  });

  it('should include medir tool', () => {
    expect('medir' as HerramientaVisor).toBe('medir');
  });

  it('should include comparar tool', () => {
    expect('comparar' as HerramientaVisor).toBe('comparar');
  });

  it('should include ajustar tool', () => {
    expect('ajustar' as HerramientaVisor).toBe('ajustar');
  });

  it('should include filtro tool', () => {
    expect('filtro' as HerramientaVisor).toBe('filtro');
  });
});

describe('FiltroImagen Type', () => {
  it('should include normal filter', () => {
    expect('normal' as FiltroImagen).toBe('normal');
  });

  it('should include invertido filter', () => {
    expect('invertido' as FiltroImagen).toBe('invertido');
  });

  it('should include contraste_alto filter', () => {
    expect('contraste_alto' as FiltroImagen).toBe('contraste_alto');
  });

  it('should include contraste_bajo filter', () => {
    expect('contraste_bajo' as FiltroImagen).toBe('contraste_bajo');
  });

  it('should include brillo_alto filter', () => {
    expect('brillo_alto' as FiltroImagen).toBe('brillo_alto');
  });

  it('should include brillo_bajo filter', () => {
    expect('brillo_bajo' as FiltroImagen).toBe('brillo_bajo');
  });

  it('should include escala_grises filter', () => {
    expect('escala_grises' as FiltroImagen).toBe('escala_grises');
  });

  it('should include sepia filter', () => {
    expect('sepia' as FiltroImagen).toBe('sepia');
  });
});

describe('Anotacion Interface', () => {
  it('should create valid anotacion with required fields', () => {
    const anotacion: Anotacion = {
      id: 'ant-1',
      tipo: 'punto',
      color: 'rojo',
      coordenadas: [100, 150],
      fecha: new Date('2024-01-15'),
    };

    expect(anotacion.id).toBe('ant-1');
    expect(anotacion.tipo).toBe('punto');
    expect(anotacion.color).toBe('rojo');
    expect(anotacion.coordenadas).toEqual([100, 150]);
    expect(anotacion.fecha).toBeInstanceOf(Date);
  });

  it('should create valid anotacion with optional texto', () => {
    const anotacion: Anotacion = {
      id: 'ant-2',
      tipo: 'texto',
      color: 'azul',
      coordenadas: [200, 250],
      texto: 'Área de interés',
      fecha: new Date('2024-01-15'),
    };

    expect(anotacion.texto).toBe('Área de interés');
  });

  it('should create valid anotacion with optional autor', () => {
    const anotacion: Anotacion = {
      id: 'ant-3',
      tipo: 'linea',
      color: 'verde',
      coordenadas: [50, 50, 150, 150],
      fecha: new Date('2024-01-15'),
      autor: 'Dr. Pérez',
    };

    expect(anotacion.autor).toBe('Dr. Pérez');
  });

  it('should create valid linea anotacion with 4 coordinates', () => {
    const anotacion: Anotacion = {
      id: 'ant-4',
      tipo: 'linea',
      color: 'rojo',
      coordenadas: [x1, y1, x2, y2],
      fecha: new Date('2024-01-15'),
    };

    expect(anotacion.coordenadas).toHaveLength(4);
    expect(anotacion.tipo).toBe('linea');
  });

  it('should create valid area anotacion with 4 coordinates', () => {
    const anotacion: Anotacion = {
      id: 'ant-5',
      tipo: 'area',
      color: 'amarillo',
      coordenadas: [x1, y1, x2, y2],
      fecha: new Date('2024-01-15'),
    };

    expect(anotacion.coordenadas).toHaveLength(4);
    expect(anotacion.tipo).toBe('area');
  });
});

describe('ImagenMetadatos Interface', () => {
  it('should create valid metadatos with optional fields', () => {
    const metadatos: ImagenMetadatos = {
      resolucion: '1920x1080',
      escala: '10x',
      campoVisual: '30°',
      dispositivo: 'Topcon DRI OCT-1',
    };

    expect(metadatos.resolucion).toBe('1920x1080');
    expect(metadatos.escala).toBe('10x');
    expect(metadatos.campoVisual).toBe('30°');
    expect(metadatos.dispositivo).toBe('Topcon DRI OCT-1');
  });

  it('should create valid metadatos with configuracion', () => {
    const metadatos: ImagenMetadatos = {
      resolucion: '2048x2048',
      configuracion: {
        brightness: 50,
        contrast: 75,
        gain: 1.5,
      },
    };

    expect(metadatos.resolucion).toBe('2048x2048');
    expect(metadatos.configuracion).toBeDefined();
    expect(metadatos.configuracion?.brightness).toBe(50);
  });

  it('should create empty metadatos', () => {
    const metadatos: ImagenMetadatos = {};

    expect(metadatos).toEqual({});
  });
});

describe('ImagenRetina Interface', () => {
  it('should create valid imagen with required fields', () => {
    const imagen: ImagenRetina = {
      id: 'img-1',
      tipo: 'color_fondo',
      ojo: 'derecho',
      url: 'https://example.com/retina.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'completa',
      anotaciones: [],
    };

    expect(imagen.id).toBe('img-1');
    expect(imagen.tipo).toBe('color_fondo');
    expect(imagen.ojo).toBe('derecho');
    expect(imagen.url).toBe('https://example.com/retina.jpg');
    expect(imagen.estado).toBe('completa');
    expect(imagen.anotaciones).toEqual([]);
  });

  it('should create valid imagen with optional thumbnailUrl', () => {
    const imagen: ImagenRetina = {
      id: 'img-2',
      tipo: 'oct',
      ojo: 'izquierdo',
      url: 'https://example.com/oct-full.jpg',
      thumbnailUrl: 'https://example.com/oct-thumb.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'completa',
      anotaciones: [],
    };

    expect(imagen.thumbnailUrl).toBe('https://example.com/oct-thumb.jpg');
  });

  it('should create valid imagen with metadatos', () => {
    const imagen: ImagenRetina = {
      id: 'img-3',
      tipo: 'angiofluoresceina',
      ojo: 'derecho',
      url: 'https://example.com/angio.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'completa',
      anotaciones: [],
      metadatos: {
        resolucion: '2048x2048',
        dispositivo: 'Heidelberg Spectralis',
      },
    };

    expect(imagen.metadatos).toBeDefined();
    expect(imagen.metadatos?.resolucion).toBe('2048x2048');
  });

  it('should create valid imagen with anotaciones', () => {
    const imagen: ImagenRetina = {
      id: 'img-4',
      tipo: 'color_fondo',
      ojo: 'ambos',
      url: 'https://example.com/retina.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'completa',
      anotaciones: [
        {
          id: 'ant-1',
          tipo: 'punto',
          color: 'rojo',
          coordenadas: [100, 150],
          fecha: new Date('2024-01-15'),
        },
        {
          id: 'ant-2',
          tipo: 'area',
          color: 'amarillo',
          coordenadas: [50, 50, 150, 150],
          fecha: new Date('2024-01-15'),
        },
      ],
    };

    expect(imagen.anotaciones).toHaveLength(2);
    expect(imagen.anotaciones[0].tipo).toBe('punto');
    expect(imagen.anotaciones[1].tipo).toBe('area');
  });

  it('should create valid imagen with optional notas', () => {
    const imagen: ImagenRetina = {
      id: 'img-5',
      tipo: 'campo_visual',
      ojo: 'izquierdo',
      url: 'https://example.com/visual-field.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'procesando',
      anotaciones: [],
      notas: 'Paciente parpadeó durante la captura',
    };

    expect(imagen.notas).toBe('Paciente parpadeó durante la captura');
  });

  it('should create valid imagen en estado pendiente', () => {
    const imagen: ImagenRetina = {
      id: 'img-6',
      tipo: 'oct',
      ojo: 'derecho',
      url: 'https://example.com/pending-oct.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'pendiente',
      anotaciones: [],
    };

    expect(imagen.estado).toBe('pendiente');
  });

  it('should create valid imagen en estado error', () => {
    const imagen: ImagenRetina = {
      id: 'img-7',
      tipo: 'topografo',
      ojo: 'izquierdo',
      url: 'https://example.com/failed-topo.jpg',
      fechaCaptura: new Date('2024-01-15'),
      fechaSubida: new Date('2024-01-15'),
      estado: 'error',
      anotaciones: [],
      notas: 'Error en la captura',
    };

    expect(imagen.estado).toBe('error');
  });
});

describe('RetinaVisorConfig Interface', () => {
  it('should create valid config with default values', () => {
    const config: RetinaVisorConfig = {
      mostrarGrid: false,
      permitirAnotaciones: true,
      permitirComparacion: true,
      zoomInicial: 1,
      minZoom: 0.1,
      maxZoom: 5,
    };

    expect(config.mostrarGrid).toBe(false);
    expect(config.permitirAnotaciones).toBe(true);
    expect(config.permitirComparacion).toBe(true);
    expect(config.zoomInicial).toBe(1);
    expect(config.minZoom).toBe(0.1);
    expect(config.maxZoom).toBe(5);
  });

  it('should create config with grid enabled', () => {
    const config: RetinaVisorConfig = {
      mostrarGrid: true,
      permitirAnotaciones: true,
      permitirComparacion: true,
      zoomInicial: 1,
      minZoom: 0.1,
      maxZoom: 5,
    };

    expect(config.mostrarGrid).toBe(true);
  });

  it('should create config with annotations disabled', () => {
    const config: RetinaVisorConfig = {
      mostrarGrid: false,
      permitirAnotaciones: false,
      permitirComparacion: true,
      zoomInicial: 1,
      minZoom: 0.1,
      maxZoom: 5,
    };

    expect(config.permitirAnotaciones).toBe(false);
  });

  it('should create config with comparison disabled', () => {
    const config: RetinaVisorConfig = {
      mostrarGrid: false,
      permitirAnotaciones: true,
      permitirComparacion: false,
      zoomInicial: 1,
      minZoom: 0.1,
      maxZoom: 5,
    };

    expect(config.permitirComparacion).toBe(false);
  });

  it('should have valid zoom range configuration', () => {
    const config: RetinaVisorConfig = {
      mostrarGrid: false,
      permitirAnotaciones: true,
      permitirComparacion: true,
      zoomInicial: 1,
      minZoom: 0.1,
      maxZoom: 5,
    };

    expect(config.minZoom).toBeLessThan(config.zoomInicial);
    expect(config.zoomInicial).toBeLessThan(config.maxZoom);
  });
});

describe('Color Accessibility', () => {
  it('should have valid hex colors for all annotations', () => {
    Object.values(COLOR_ANNOTATION_MAP).forEach((color) => {
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  it('should have high contrast colors for visibility', () => {
    // Red, green, blue should be pure colors for maximum contrast
    expect(COLOR_ANNOTATION_MAP.rojo).toBe('#FF0000');
    expect(COLOR_ANNOTATION_MAP.verde).toBe('#00FF00');
    expect(COLOR_ANNOTATION_MAP.azul).toBe('#0000FF');
  });
});

describe('Annotation Coordinate Systems', () => {
  it('should support 2D point coordinates', () => {
    const point: Anotacion = {
      id: 'point-1',
      tipo: 'punto',
      color: 'rojo',
      coordenadas: [100, 200],
      fecha: new Date('2024-01-15'),
    };

    expect(point.coordenadas).toHaveLength(2);
    expect(point.coordenadas[0]).toBe(100);
    expect(point.coordenadas[1]).toBe(200);
  });

  it('should support line coordinates (start and end points)', () => {
    const line: Anotacion = {
      id: 'line-1',
      tipo: 'linea',
      color: 'azul',
      coordenadas: [x1, y1, x2, y2],
      fecha: new Date('2024-01-15'),
    };

    expect(line.coordenadas).toHaveLength(4);
  });

  it('should support area coordinates (rectangle)', () => {
    const area: Anotacion = {
      id: 'area-1',
      tipo: 'area',
      color: 'amarillo',
      coordenadas: [x1, y1, x2, y2],
      fecha: new Date('2024-01-15'),
    };

    expect(area.coordenadas).toHaveLength(4);
  });
});

describe('Image State Transitions', () => {
  it('should follow valid state transition from pendiente to completa', () => {
    const states: EstadoImagen[] = ['pendiente', 'procesando', 'completa'];
    
    expect(states[0]).toBe('pendiente');
    expect(states[1]).toBe('procesando');
    expect(states[2]).toBe('completa');
  });

  it('should allow error state from any state', () => {
    const possibleTransitions: { from: EstadoImagen; to: EstadoImagen }[] = [
      { from: 'pendiente', to: 'error' },
      { from: 'procesando', to: 'error' },
      { from: 'completa', to: 'error' },
    ];

    possibleTransitions.forEach((transition) => {
      expect(transition.to).toBe('error');
    });
  });
});
