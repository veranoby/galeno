<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">Bienvenido a Galeno</h1>
        <p class="text-body-1">Plataforma médica integral para Ecuador</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/consultas" hover>
          <v-card-title>
            <v-icon icon="mdi-stethoscope" size="large" color="primary" class="mr-2" />
            Consultas
          </v-card-title>
          <v-card-text>
            Gestiona consultas médicas con historial completo
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/agenda" hover>
          <v-card-title>
            <v-icon icon="mdi-calendar" size="large" color="primary" class="mr-2" />
            Agenda
          </v-card-title>
          <v-card-text>
            Administra tu agenda y citas médicas
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/pacientes" hover>
          <v-card-title>
            <v-icon icon="mdi-account-multiple" size="large" color="primary" class="mr-2" />
            Pacientes
          </v-card-title>
          <v-card-text>
            Directorio completo de pacientes
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/health-wallet" hover>
          <v-card-title>
            <v-icon icon="mdi-wallet" size="large" color="primary" class="mr-2" />
            Health Wallet
          </v-card-title>
          <v-card-text>
            Historia clínica portable del paciente
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/ia-copilot" hover>
          <v-card-title>
            <v-icon icon="mdi-robot" size="large" color="primary" class="mr-2" />
            IA Copilot
          </v-card-title>
          <v-card-text>
            Asistente de IA con 3 niveles de autonomía
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/documentos" hover>
          <v-card-title>
            <v-icon icon="mdi-file-document" size="large" color="primary" class="mr-2" />
            Documentos
          </v-card-title>
          <v-card-text>
            Gestión documental con firmas digitales
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4" lg="3">
        <v-card to="/facturacion" hover>
          <v-card-title>
            <v-icon icon="mdi-receipt" size="large" color="primary" class="mr-2" />
            Facturación
          </v-card-title>
          <v-card-text>
            Facturación electrónica SRI
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
// Home view - placeholder implementation
</script>
