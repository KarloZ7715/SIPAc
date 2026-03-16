#### Desarrollado por Cursor - Modelo GPT-5.4

# Evidencias de Pasantía

Esta carpeta consolida la evidencia técnica y académica del desarrollo de SIPAc. Su objetivo no es solo servir como archivo histórico, sino demostrar de manera rigurosa qué se implementó, por qué se implementó de esa forma y cómo se verificó técnicamente cada avance.

## 1. Criterio de calidad esperado para una evidencia

Una evidencia sólida de pasantía no debe limitarse a una lista de archivos o capturas. Debe demostrar:

- comprensión del problema y del objetivo del módulo,
- trazabilidad con requisitos o cronograma,
- justificación de decisiones de diseño,
- correspondencia entre documentación y código,
- validación técnica real,
- identificación explícita de limitaciones y trabajo pendiente.

## 2. Estructura recomendada de cada evidencia

Cada documento de evidencia debería contener, cuando aplique, las siguientes secciones:

1. Identificación del módulo o entregable.
2. Propósito de la evidencia.
3. Alcance implementado.
4. Trazabilidad con requisitos funcionales y no funcionales.
5. Decisiones técnicas y justificación.
6. Artefactos desarrollados: backend, frontend, modelos, documentación, diagramas.
7. Flujo funcional resumido.
8. Evidencia técnica verificable: pruebas, validaciones, comandos, resultados observables.
9. Limitaciones, dependencias y trabajo pendiente.
10. Conclusión técnica del avance.

## 3. Evidencias actualmente generadas

| Archivo                                                         | Cobertura                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `2026-03-05_m1-autenticacion-gestion-usuarios.md`               | Implementación del módulo de autenticación, roles y administración de cuentas              |
| `2026-03-05_m6-perfil-usuario.md`                               | Implementación del módulo de perfil del usuario autenticado                                |
| `2026-03-05_m7-seguridad-auditoria-base.md`                     | Infraestructura base de seguridad, validación de entorno y auditoría                       |
| `2026-03-06_base-interfaz-navegacion-experiencia.md`            | Consolidación de la interfaz base, navegación protegida y experiencia de usuario           |
| `2026-03-06_consolidacion-tecnica-alineacion-arquitectonica.md` | Consolidación técnica del proyecto, tooling de calidad y alineación arquitectónica         |
| `2026-03-14_m2-carga-documentos.md`                             | Implementación de carga documental, validación binaria, GridFS y arranque de pipeline      |
| `2026-03-14_m3-ocr-pipeline.md`                                 | Implementación OCR con extracción PDF nativa, fallback visual y telemetría técnica         |
| `2026-03-14_m4-ner-extraccion-entidades.md`                     | Extracción NER estructurada con fallback de modelos, evidencia por anchors y trazabilidad  |
| `2026-03-14_m5a-repositorio-borrador-revision.md`               | Estado parcial de repositorio: flujo de borrador, edición y confirmación manual            |
| `2026-03-14_m8-notificaciones-dashboard-base.md`                | Notificaciones in-app y correo best-effort integradas al pipeline documental               |
| `2026-03-15_refuerzo-ner-ocr-metadatos.md`                      | Hardening transversal OCR/NER: validación semántica, retry por error, quality gates y eval |

## 4. Evidencias complementarias recomendadas

Además de los documentos Markdown, para una pasantía académica-profesional conviene agregar evidencia complementaria que fortalezca la demostración del trabajo realizado:

### 4.1 Evidencia visual

- capturas de pantallas clave de la UI,
- capturas de respuestas de endpoints en Postman o Hoppscotch,
- capturas de la base de datos en MongoDB Compass o Atlas,
- capturas de los problemas resueltos y su verificación posterior.

### 4.2 Evidencia de proceso

- planes de implementación por módulo,
- bitácoras de decisiones técnicas,
- cronogramas de avance semanales,
- registro de bloqueos encontrados y cómo fueron resueltos.

### 4.3 Evidencia de calidad

- salida de `typecheck` y `eslint`,
- capturas o logs de pruebas manuales,
- casos de prueba de aceptación por requisito,
- evidencia de validación de seguridad y de configuración.

## 5. Puntos que conviene agregar manualmente

Hay elementos que no pueden generarse automáticamente con suficiente fidelidad y que conviene incorporar manualmente a medida que avances:

- capturas de pantalla de la interfaz en funcionamiento,
- capturas de MongoDB Atlas o Compass mostrando colecciones y documentos,
- actas o notas breves de reuniones con tutor académico o supervisor,
- observaciones personales sobre dificultades técnicas reales del proceso,
- tiempos estimados y tiempos reales por módulo,
- evidencia de despliegue cuando exista entorno publicado.

## 6. Organización sugerida a futuro

```text
evidencias/
├── 2026-03-05_m1-autenticacion-gestion-usuarios.md
├── 2026-03-05_m6-perfil-usuario.md
├── 2026-03-05_m7-seguridad-auditoria-base.md
├── 2026-03-06_base-interfaz-navegacion-experiencia.md
├── 2026-03-06_consolidacion-tecnica-alineacion-arquitectonica.md
├── semana-02/
│   ├── capturas-ui/
│   ├── capturas-api/
│   ├── capturas-bd/
│   └── bitacora-avance.md
├── semana-03/
│   └── ...
└── informe-final/
    └── SIPAc-InformeFinal-CarlosCanabal.docx
```

## 7. Observación metodológica

Las evidencias deben mantenerse alineadas con el código real y con la documentación del proyecto. Si durante el desarrollo cambia una decisión importante, por ejemplo el mecanismo de autenticación, el esquema de roles o la estrategia de conexión a MongoDB, la evidencia debe actualizarse para reflejar la decisión final y no únicamente la intención inicial del diseño.
