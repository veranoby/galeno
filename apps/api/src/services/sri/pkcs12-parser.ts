/**
 * Servicio de procesamiento de certificados PKCS#12
 *
 * Utiliza pkijs para parsear archivos .p12/.pfx y extraer:
 * - Certificado X.509 en formato PEM
 * - Informacion del certificado (subject,  issuer,  serialNumber,  etc.)
 * - Llave privada en formato PEM (para firma)
 *
 * @see https://github.com/PeculiarVentures/PKI.js
 */

import { Buffer } from 'node:buffer';
import * as crypto from 'node:crypto';

// ============= TYPES ============

/**
 * Informacion extraida del certificado X.509
 */
export interface CertificadoInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  cn: string; // Common Name - nombre del firmante
  email?: string;
  cedula?: string; // Cedula ecuatoriana
  organization?: string;
  organizationalUnit?: string;
  country?: string;
}

/**
 * Resultado del parsing PKCS#12
 */
export interface PKCS12Resultado {
  certificadoPem: string;
  llavePrivadaPem: string;
  info: CertificadoInfo;
  certificadoDer: Buffer;
}

/**
 * Opciones para el parsing PKCS#12
 */
export interface PKCS12Options {
  password?: string;
  extractPrivateKey?: boolean;
}

// ============= ERROR ============

export class PKCS12Error extends Error {
  constructor(message: string,  public cause?: Error) {
    super(message);
    this.name = 'PKCS12Error';
  }
}

// ============= FUNCION PRINCIPAL ============

/**
 * Parsea un archivo PKCS#12 (.p12/.pfx) y extrae certificado y llave privada
 *
 * @param p12Buffer - Buffer del archivo PKCS#12
 * @param password - Contrasena del certificado (opcional si no esta encriptado)
 * @returns Certificado PEM, llave privada PEM e informacion del certificado
 *
 * NOTA: Esta es una implementacion simplificada. Para PKCS#12 completo,
 * usar una biblioteca especializada como node-forge
 */
export async function parsearPKCS12(
  p12Buffer: Buffer, 
  password: string = ''
): Promise<PKCS12Resultado> {
  try {
    // Importar pkijs dinamicamente para evitar problemas de tipos
    const pkijs = await import('pkijs');
    await (pkijs as any).setEngine(
      'nodeCrypto', 
      new (pkijs as any).CryptoEngine({
        name: '', 
        crypto: crypto as any, 
        subtle: (crypto.subtle as any)
      })
    );

    // Convertir buffer a Uint8Array para pkijs
    const p12Data = new Uint8Array(p12Buffer);

    // Parsear estructura PKCS#12 (PFX) - usar 'any' para evitar problemas de tipos
    const pfxAsn1 = await (pkijs as any).org.pkijs.fromBER(p12Data);
    const pfx = new (pkijs as any).PFX();
    await pfx.fromSchema(pfxAsn1.result);

    // Verificar integridad del PFX (usando MAC si existe)
    if (pfx.mac) {
      try {
        const integrityVerified = await pfx.verifyMac({
          password: password
        });
        if (!integrityVerified) {
          throw new PKCS12Error('Contrasena incorrecta o archivo corrupto');
        }
      } catch (e: any) {
        throw new PKCS12Error(
          'No se pudo verificar la integridad del archivo PKCS#12', 
          e
        );
      }
    }

    // Parsear contenido autenticado
    let authenticatedSafe: any;
    try {
      authenticatedSafe = await pfx.parse({
        password: password
      });

      if (!authenticatedSafe || authenticatedSafe.length === 0) {
        throw new PKCS12Error('No se encontraron contents en el archivo PKCS#12');
      }
    } catch (e: any) {
      throw new PKCS12Error(
        'No se pudo parsear el contenido. Verifique la contrasena.', 
        e
      );
    }

    // Buscar contenedor de llave privada y certificado
    let privateKeyBuffer: Buffer | null = null;
    let certificadoBuffer: Buffer | null = null;
    let certificadoObj: any = null;

    // Iterar sobre SafeBags para extraer llave y certificado
    for (const safeContent of authenticatedSafe) {
      for (const safeBag of (safeContent.safeBags || [])) {
        const bagType = (safeBag as any).bagType;

        // Extraer llave privada (PKCS#8 Shrouded Key Bag o Key Bag)
        if (bagType === 1 || bagType === 2) {
          try {
            // Tipo 1: PKCS#8 Shrouded Key Bag
            // Tipo 2: PKCS#8 Key Bag (no encriptada)
            const bagValue = (safeBag as any).bagValue;
            if (bagValue) {
              privateKeyBuffer = Buffer.from(new Uint8Array(bagValue));
            }
          } catch (e: any) {
            console.warn('No se pudo extraer llave privada:',  e);
          }
        }

        // Extraer certificado (CertBag)
        if (bagType === 3) {
          try {
            const certAsn1 = await (pkijs as any).org.pkijs.fromBER((safeBag as any).bagValue);
            certificadoObj = new (pkijs as any).Certificate();
            await certificadoObj.fromSchema(certAsn1.result);
            certificadoBuffer = Buffer.from(new Uint8Array((safeBag as any).bagValue));
          } catch (e: any) {
            console.warn('No se pudo extraer certificado:',  e);
          }
        }
      }
    }

    if (!certificadoObj || !certificadoBuffer) {
      throw new PKCS12Error('No se encontro certificado X.509 en el archivo PKCS#12');
    }

    if (!privateKeyBuffer) {
      throw new PKCS12Error('No se encontro llave privada en el archivo PKCS#12');
    }

    // Extraer informacion del certificado
    const info = extraerInfoCertificado(certificadoObj);

    // Convertir certificado a PEM
    const certificadoPem = bufferToPEM(certificadoBuffer,  'CERTIFICATE');

    // Convertir llave privada a PEM
    const llavePrivadaPem = bufferToPEM(privateKeyBuffer,  'PRIVATE KEY');

    return {
      certificadoPem,
      llavePrivadaPem,
      info,
      certificadoDer: certificadoBuffer
    };
  } catch (e: any) {
    if (e instanceof PKCS12Error) {
      throw e;
    }
    throw new PKCS12Error('Error al parsear archivo PKCS#12',  e);
  }
}

/**
 * Extrae informacion relevante de un certificado X.509
 */
function extraerInfoCertificado(certificado: any): CertificadoInfo {
  const info: CertificadoInfo = {
    subject: (certificado.subject as any)?.toString() || '',
    issuer: (certificado.issuer as any)?.toString() || '',
    serialNumber: Array.from(new Uint8Array((certificado as any).serialNumber))
      .map((b: number) => b.toString(16).padStart(2,  '0'))
      .join(':')
      .toUpperCase(),
    validFrom: (certificado as any).notBefore || new Date(),
    validTo: (certificado as any).notAfter || new Date(),
    cn: '',
  };

  // Extraer atributos del subject
  const subject = (certificado.subject as any);
  if (subject && subject.typesAndValues) {
    for (const rdn of (subject.typesAndValues || [])) {
      const oid = (rdn as any).type;
      const value = (rdn as any).value?.valueBlock?.value;

      if (oid === '2.5.4.3') {
        // Common Name
        info.cn = value as string;
      } else if (oid === '2.5.4.6') {
        // Country
        info.country = value as string;
      } else if (oid === '2.5.4.10') {
        // Organization
        info.organization = value as string;
      } else if (oid === '2.5.4.11') {
        // Organizational Unit
        info.organizationalUnit = value as string;
      } else if (oid === '2.5.4.45') {
        // Unique ID - en Ecuador puede ser la cedula
        info.cedula = value as string;
      } else if (oid === '0.9.2342.19200300.100.1.1') {
        // UserID (Unix)
        info.email = value as string;
      } else if (oid === '1.2.840.113549.1.9.1') {
        // Email (PKCS #9)
        info.email = value as string;
      }
    }
  }

  // Intentar extraer email de SubjectAlternativeName si no esta en el subject
  if (!info.email && (certificado as any).extensions) {
    for (const ext of (certificado as any).extensions) {
      if ((ext as any).extnID === '2.5.29.17') {
        // Subject Alternative Name
        try {
          const san = (ext as any).parsedValue;
          if (san && (san as any).altNames) {
            for (const altName of (san as any).altNames) {
              if ((altName as any).type === 1) {
                // RFC 822 name (email)
                info.email = (altName as any).value;
                break;
              }
            }
          }
        } catch (e: any) {
          // Ignorar error
        }
      }
    }
  }

  return info;
}

/**
 * Convierte un buffer DER a formato PEM
 */
function bufferToPEM(buffer: Buffer,  label: string): string {
  const b64 = buffer.toString('base64');
  const lines = b64.match(/.{1, 64}/g) || [];
  const pem = [
    `-----BEGIN ${label}-----`,
    ...lines,
    `-----END ${label}-----`
  ].join('\n');
  return pem;
}

/**
 * Valida si un buffer es un archivo PKCS#12 valido
 */
export function validarPKCS12(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // PKCS#12 PFX starts with SEQUENCE tag (0x30)
  if (buffer[0] !== 0x30) return false;

  return true;
}

/**
 * Extrae informacion de un certificado PEM sin llave privada
 */
export async function parsearCertificadoPEM(
  certPem: string
): Promise<CertificadoInfo> {
  try {
    const pkijs = await import('pkijs');
    await (pkijs as any).setEngine(
      'nodeCrypto', 
      new (pkijs as any).CryptoEngine({
        name: '', 
        crypto: crypto as any, 
        subtle: (crypto.subtle as any)
      })
    );

    const certDer = pemToBuffer(certPem);
    const certAsn1 = await (pkijs as any).org.pkijs.fromBER(new Uint8Array(certDer));
    const certificado = new (pkijs as any).Certificate();
    await certificado.fromSchema(certAsn1.result);

    return extraerInfoCertificado(certificado);
  } catch (e: any) {
    throw new PKCS12Error('Error al parsear certificado PEM',  e);
  }
}

/**
 * Convierte PEM a buffer DER
 */
export function pemToBuffer(pem: string): Buffer {
  const lines = pem
    .split('\n')
    .filter(line => !line.includes('-----BEGIN') && !line.includes('-----END'));
  const b64 = lines.join('');
  return Buffer.from(b64,  'base64');
}
