# Renders de Diagramas UML — SIPAc

Imágenes PNG generadas a partir de los archivos fuente PlantUML ubicados en [`../puml/`](../puml/).

## Diagramas

| Render                                                                     | Tipo         | Descripción                                                      |
| -------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| [`01-clases.png`](01-clases.png)                                           | Clases       | 5 colecciones MongoDB, discriminator pattern, embeds, enums      |
| [`02a-casos-de-uso-gestion.png`](02a-casos-de-uso-gestion.png)             | Casos de Uso | M1 + M6 + M7: Autenticación, perfil, seguridad y auditoría       |
| [`02b-casos-de-uso-documentos.png`](02b-casos-de-uso-documentos.png)       | Casos de Uso | M2 + M3 + M4: Pipeline carga → OCR → NER                         |
| [`02c-casos-de-uso-repositorio.png`](02c-casos-de-uso-repositorio.png)     | Casos de Uso | M5A + M5B + M8: Repositorio, dashboard analítico, notificaciones |
| [`03a-secuencia-autenticacion.png`](03a-secuencia-autenticacion.png)       | Secuencia    | Login con JWT: validación, bloqueo, generación de token          |
| [`03b-secuencia-procesamiento.png`](03b-secuencia-procesamiento.png)       | Secuencia    | Pipeline: Carga → OCR → NER → Almacenamiento → Notificación      |
| [`03c-secuencia-verificacion.png`](03c-secuencia-verificacion.png)         | Secuencia    | Revisión docente + verificación/rechazo del coordinador          |
| [`03d-secuencia-dashboard.png`](03d-secuencia-dashboard.png)               | Secuencia    | Dashboard: aggregations, filtros, exportación PDF                |
| [`04a-actividad-pipeline.png`](04a-actividad-pipeline.png)                 | Actividad    | Pipeline OCR+NER con swimlanes por capa                          |
| [`04b-actividad-gestion-usuarios.png`](04b-actividad-gestion-usuarios.png) | Actividad    | Registro, login, recuperación, gestión admin                     |
| [`05-estados-ciclo-vida.png`](05-estados-ciclo-vida.png)                   | Estados      | Ciclos de vida: archivo → producto → cuenta de usuario           |

## Regenerar renders

Con la extensión **PlantUML** (`jebbs.plantuml`) en VS Code:

1. Abrir cualquier archivo `.puml` de la carpeta [`../puml/`](../puml/)
2. `Ctrl+Shift+P` → **PlantUML: Export Current File Diagrams**
3. Seleccionar formato **png**

Para exportar todos los diagramas de una vez: `Ctrl+Shift+P` → **PlantUML: Export Workspace Diagrams**.
