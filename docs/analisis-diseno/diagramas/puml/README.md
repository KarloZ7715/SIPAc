# Diagramas UML — SIPAc

## Archivos fuente PlantUML

Esta carpeta contiene los archivos `.puml` fuente de todos los diagramas UML del sistema, alineados con la arquitectura de **servicio único Nuxt 4** (stack unificado TypeScript).

## Diagramas incluidos

| Archivo                               | Tipo         | Estado   | Descripción                                                              |
| ------------------------------------- | ------------ | -------- | ------------------------------------------------------------------------ |
| `01-clases.puml`                      | Clases       | Completo | 6 colecciones MongoDB, discriminator pattern, embeds, enums              |
| `02a-casos-de-uso-gestion.puml`       | Casos de Uso | Completo | M1 + M6 + M7: Autenticación, perfil, seguridad y auditoría               |
| `02b-casos-de-uso-documentos.puml`    | Casos de Uso | Completo | M2 + M3 + M4: Pipeline carga → OCR → NER                                 |
| `02c-casos-de-uso-repositorio.puml`   | Casos de Uso | Completo | M5A + M5B + M8 + M9: Repositorio, dashboard, notificaciones, chat        |
| `03a-secuencia-autenticacion.puml`    | Secuencia    | Completo | Login con JWT: validación, bloqueo, generación de token                  |
| `03b-secuencia-procesamiento.puml`    | Secuencia    | Completo | Pipeline: Carga → OCR → NER → Almacenamiento (GridFS) → Notificación     |
| `03c-secuencia-chat.puml`             | Secuencia    | Completo | Chat Inteligente: pregunta → tool calling → query MongoDB → respuesta IA |
| `03d-secuencia-dashboard.puml`        | Secuencia    | Completo | Dashboard: aggregations, filtros, exportación PDF                        |
| `04a-actividad-pipeline.puml`         | Actividad    | Completo | Pipeline OCR+NER con swimlanes por capa (GridFS)                         |
| `04b-actividad-gestion-usuarios.puml` | Actividad    | Completo | Registro, login, recuperación, gestión admin                             |
| `05-estados-ciclo-vida.puml`          | Estados      | Completo | Ciclos de vida: archivo cargado y cuenta de usuario                      |

## Prerrequisitos

- Extensión **PlantUML** instalada en VS Code
- Java Runtime Environment (JRE) — requerido por PlantUML
- Previsualizar: `Alt + D` con el archivo `.puml` abierto
