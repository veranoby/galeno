import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Galeno API',
      version: '1.0.0',
      description: `
        Ecuador-Health 360 Medical Platform API

        ## Features
        - **Row Level Security (RLS)**: Automatic data filtering based on user roles
        - **JWT Authentication**: Secure token-based authentication with refresh tokens
        - **State Machine**: Controlled workflow for medical consultations
        - **Digital Signature**: XAdES-BES compliant electronic signature validation
        - **API Versioning**: Versioned endpoints for backward compatibility

        ## Security
        - All endpoints (except auth) require JWT authentication
        - Refresh tokens are rotated for enhanced security
        - Passwords are hashed using bcrypt
        - RLS policies ensure data isolation
      `,
      contact: {
        name: 'Galeno API Support',
        email: 'support@galeno.ec'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1 - Current Version'
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from /api/v1/auth/login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type (e.g., "Bad Request", "Unauthorized")'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Field that caused the error'
                  },
                  message: {
                    type: 'string',
                    description: 'Validation error message'
                  }
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            nombre: {
              type: 'string',
              description: 'User full name'
            },
            rol: {
              type: 'string',
              enum: ['DOCTOR', 'ADMIN', 'ASISTENTE', 'ENFERMERA'],
              description: 'User role in the system'
            }
          }
        },
        Tokens: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token (expires in 15 minutes)'
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token (expires in 7 days)'
            }
          },
          required: ['accessToken', 'refreshToken']
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'doctor@galeno.ec'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              description: 'User password',
              example: 'Password123!'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'nombre'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'doctor@galeno.ec'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              description: 'Password (min 8 chars, 1 uppercase, 1 number, 1 special char)',
              example: 'Password123!'
            },
            nombre: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'User full name',
              example: 'Dr. Juan Pérez'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User'
            },
            tokens: {
              $ref: '#/components/schemas/Tokens'
            }
          }
        },
        Paciente: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            nombre: {
              type: 'string'
            },
            cedula: {
              type: 'string'
            },
            healthWalletId: {
              type: 'string'
            },
            fechaNacimiento: {
              type: 'string',
              format: 'date'
            },
            telefono: {
              type: 'string'
            },
            email: {
              type: 'string',
              format: 'email'
            }
          }
        },
        Consulta: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            estado: {
              type: 'string',
              enum: ['borrador', 'triaje', 'pendiente', 'en_atencion', 'finalizada', 'interconsulta'],
              description: 'Consulta state following state machine rules'
            },
            motivoConsulta: {
              type: 'string'
            },
            evolucion: {
              type: 'string'
            },
            diagnosticoCie10: {
              type: 'string'
            },
            firmado: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            paciente: {
              $ref: '#/components/schemas/Paciente'
            },
            doctor: {
              $ref: '#/components/schemas/User'
            },
            asistente: {
              $ref: '#/components/schemas/User'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100
            },
            total: {
              type: 'integer'
            },
            totalPages: {
              type: 'integer'
            },
            hasMore: {
              type: 'boolean'
            }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Unauthorized',
                message: 'Authentication required'
              }
            }
          }
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Forbidden',
                message: 'You do not have access to this resource'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Not found',
                message: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Bad Request',
                message: 'Validation failed',
                details: [
                  {
                    field: 'email',
                    message: 'Invalid email format'
                  }
                ]
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Consultas',
        description: 'Medical consultation management with state machine'
      },
      {
        name: 'Firma Digital',
        description: 'Digital signature validation using XAdES-BES standard'
      },
      {
        name: 'Onboarding',
        description: 'New user registration and onboarding flow'
      },
      {
        name: 'Pacientes',
        description: 'Patient management (filtered by RLS)'
      },
      {
        name: 'Health',
        description: 'System health check endpoints'
      }
    ]
  },
  apis: [
    './src/routes/v1/**/*.ts',
    './src/routes/v1/*.ts'
  ]
};

export const swaggerSpec = swaggerJSDoc(options);
