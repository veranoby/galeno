# Security Architecture - Galeno v1.1 (LOPDP Compliance)

## Overview

This document outlines the security architecture implemented for Galeno v1.1 to ensure compliance with the Ley Orgánica de Protección de Datos Personales (LOPDP) of Ecuador. The architecture focuses on protecting patient health data while enabling secure sharing between healthcare providers with explicit patient consent.

## Security Domains

### 1. Data Protection & Encryption

#### Field-Level Encryption (AES-256-GCM)
- **Algorithm**: AES-256-GCM for authenticated encryption
- **Sensitive Fields Encrypted**:
  - Patient phone numbers
  - Patient email addresses
  - Medical consultation details (motivoConsulta, evolucion)
  - Diagnostic codes (diagnosticoCie10)
  - Prescription data (recetaJson)
  - Examination data (examenesJson)
  - Antecedent details (detalle)
  - Document content (contenido)
  - Connection permissions (permisos)

#### Encryption Middleware
- Applied automatically to sensitive fields in requests/responses
- Ensures data is encrypted at rest and in transit
- Maintains audit trail of data access

### 2. Access Control & Authorization

#### Row Level Security (RLS)
- Implemented at the PostgreSQL level
- Ensures users only access data they're authorized to see
- Granular control per table and row

**RLS Policies:**
- **Cuentas**: Users see only their own account
- **Pacientes**: Doctors see only their patients; assistants see assigned patients
- **Consultas**: Doctors see only their consultations; assistants see triage consultations
- **Documentos**: Access tied to consultation ownership
- **Conexiones**: Patients see their connections; doctors see their requests
- **Health Wallets**: Patients see only their wallets

#### LOPDP-Compliant Authorization Flow
- **Explicit Consent**: All data access requires patient consent
- **Push Notifications**: Consent requests sent via push notifications
- **Granular Permissions**: Different access levels (COMPLETO, LIMITADO, EMERGENCIA)
- **Time-Limited Access**: Optional expiration dates for connections
- **Revocation Capability**: Patients can revoke access anytime

### 3. Health Wallet System

#### Core Components
- **Health Wallet Model**: Unique identifier for patient data access
- **QR-Based Access**: Secure QR codes for wallet validation
- **Connection Management**: Track authorized healthcare providers
- **Permission Scoping**: Define access level for each connection

#### QR Security
- **Signed QR Codes**: HMAC-SHA256 signatures for integrity
- **Time-Limited**: QR codes expire after 24 hours
- **Purpose-Specific**: Different QR types for different access levels
- **Pharmacy Validation**: Temporary access tokens for medication verification

### 4. Audit & Compliance

#### Comprehensive Logging
- **Access Logs**: Track all data access attempts
- **Consent Logs**: Record consent granting/revocation
- **Security Events**: Monitor for suspicious activity
- **LOPDP Compliance**: Maintain records for regulatory requirements

#### Audit Trail Categories
- **Resource Access**: Who accessed what data when
- **Consent Management**: Authorization and revocation events
- **Security Incidents**: Failed access attempts and anomalies
- **Data Modifications**: Changes to patient records

### 5. Network & Application Security

#### API Security
- **Rate Limiting**: Prevent abuse and DDoS attacks
- **CORS Configuration**: Secure cross-origin requests
- **Helmet Headers**: Security HTTP headers
- **Input Sanitization**: Prevent injection attacks

#### Authentication & Session Management
- **JWT Tokens**: Secure session management
- **Token Rotation**: Refresh token mechanism
- **Session Isolation**: Separate sessions for different user types
- **Secure Storage**: Client-side token handling

### 6. Privacy Controls

#### Patient Rights Implementation
- **Right of Access**: Patients can view their data access logs
- **Right to Rectification**: Patients can correct their information
- **Right to Erasure**: Data deletion capabilities (with medical exceptions)
- **Right to Restrict Processing**: Ability to limit data access

#### Data Minimization
- **Least Privilege**: Access only necessary data
- **Purpose Limitation**: Data used only for intended purposes
- **Retention Policy**: Automatic deletion of expired data
- **Anonymization**: Where possible for analytics

## Technical Implementation

### Backend Services
- **HealthWalletService**: Manages patient health wallets
- **AuthorizationService**: Handles consent flows
- **QRService**: Generates and validates secure QR codes
- **AuditService**: Maintains compliance logs
- **NotificationService**: Sends consent requests

### Security Middleware
- **Encryption Middleware**: Automatic field encryption/decryption
- **Authentication Middleware**: JWT validation and user context
- **Authorization Middleware**: Role-based access control
- **Rate Limiting**: Per-endpoint request limits

### Database Security
- **PostgreSQL RLS**: Row-level security policies
- **Encrypted Connections**: SSL/TLS for all database connections
- **Parameterized Queries**: Prevent SQL injection
- **Regular Audits**: Automated security checks

## Compliance Framework

### LOPDP Article Coverage
- **Article 14 (Security Measures)**: Implemented technical safeguards
- **Article 15 (Consent)**: Explicit consent mechanism
- **Article 16 (Data Subject Rights)**: Rights implementation
- **Article 23 (Retention)**: Data retention policies
- **Article 25 (Security Breach)**: Incident response procedures

### Audit Requirements
- **Access Logs**: Maintain for minimum required period
- **Consent Records**: Keep consent evidence
- **Security Events**: Log and report security incidents
- **Compliance Reports**: Regular compliance assessments

## Emergency Procedures

### Security Incident Response
1. **Detection**: Automated monitoring and alerting
2. **Containment**: Immediate access restriction
3. **Investigation**: Audit log analysis
4. **Remediation**: Fix vulnerabilities
5. **Reporting**: Notify authorities as required

### Data Breach Protocol
- **Immediate Isolation**: Secure affected systems
- **Impact Assessment**: Determine scope of breach
- **Regulatory Notification**: Report to authorities within required timeframe
- **Affected Individual Notification**: Inform impacted patients
- **Remediation**: Implement fixes and prevent recurrence

## Testing & Validation

### Security Testing
- **Penetration Testing**: Regular third-party security audits
- **Vulnerability Scanning**: Automated security scanning
- **Compliance Auditing**: Regular LOPDP compliance checks
- **Access Control Testing**: Verify authorization boundaries

### Privacy Testing
- **Data Flow Analysis**: Track personal data movement
- **Consent Validation**: Verify consent mechanisms
- **Right Exercise**: Test data subject rights
- **Anonymization Testing**: Validate anonymization techniques

## Maintenance & Updates

### Security Updates
- **Regular Patching**: Keep all dependencies updated
- **Vulnerability Monitoring**: Subscribe to security advisories
- **Configuration Reviews**: Regular security configuration audits
- **Access Reviews**: Periodic access control validation

### Compliance Updates
- **Regulation Changes**: Monitor LOPDP updates
- **Policy Updates**: Adjust policies for regulatory changes
- **Training Updates**: Keep staff informed of changes
- **Documentation Updates**: Maintain current security documentation

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Next Review**: May 15, 2026  
**Owner**: Security Team