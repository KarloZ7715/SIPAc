# Evidencia de Desarrollo — Validacion visual responsive transversal

| Campo                   | Valor                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                                                       |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                                                                   |
| **Componente**          | Validacion visual responsive UI/UX                                                                           |
| **Autor**               | Carlos A. Canabal Cordero                                                                                    |
| **Fecha**               | 2026-04-23                                                                                                   |
| **Version**             | 1.4                                                                                                          |
| **Estado**              | Ejecutado con evidencia completa                                                                             |
| **Objetivo del avance** | Verificar comportamiento responsive en rutas clave y consolidar evidencia reproducible para auditoria visual |

---

## 1. Proposito de la evidencia

Esta evidencia documenta la validacion responsive aplicada sobre la interfaz de SIPAc en tres tamanos de viewport, con trazabilidad de pruebas automatizadas y artefactos visuales versionados. El alcance incluye rutas publicas, rutas autenticadas y estado del shell movil en uso real.

## 2. Alcance implementado

Se evaluaron las rutas siguientes:

- publicas: `login`, `register`;
- autenticadas: `home`, `dashboard`, `workspace-documents`, `chat`, `repository`, `profile`, `help/assistant`.

Se evaluaron los viewports siguientes:

- `desktop` (`1440x900`),
- `mobile` (`375x812`),
- `mobile-small` (`320x568`).

Cobertura adicional aplicada:

- captura de sidebar movil abierto en `dashboard` para `375x812` y `320x568`.

## 3. Trazabilidad con criterios de validacion

| CV     | Criterio                        | Implementacion aplicada                                   | Estado     |
| ------ | ------------------------------- | --------------------------------------------------------- | ---------- |
| CV-001 | Cobertura multi-viewport        | Matriz `desktop/mobile/mobile-small` en spec de evidencia | Completado |
| CV-002 | Cobertura de rutas criticas     | 9 rutas incluidas en captura automatizada                 | Completado |
| CV-003 | Ausencia de overflow horizontal | Verificacion automatizada en spec de breakpoints          | Completado |
| CV-004 | Cobertura de shell movil        | Captura de sidebar abierto en mobile y mobile-small       | Completado |
| CV-005 | Reproducibilidad                | Ejecucion por comandos Playwright documentados            | Completado |
| CV-006 | Versionado de evidencia         | Artefactos guardados en `docs/evidencias/capturas/...`    | Completado |

## 4. Decisiones tecnicas relevantes

### 4.1 Validacion separada por objetivo

Se uso un spec para criterios de layout (`responsive-breakpoints`) y otro para generacion de evidencia visual (`evidence-screenshots`). Esta separacion evita mezclar checks estructurales con captura de artefactos.

### 4.2 Autenticacion automatizada para rutas privadas

Las rutas autenticadas se validaron con sesion por cookie firmada (`sipac_session`) y usuario temporal E2E, evitando dependencia de pasos manuales de login durante la corrida.

### 4.3 Cobertura explicita de 320px

Se incorporo `320x568` como viewport obligatorio para representar un escenario movil restrictivo y validar comportamiento en densidad reducida.

## 5. Artefactos implementados

### 5.1 Especificaciones de prueba

| Archivo                                               | Responsabilidad                                                |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `tests/e2e/responsive/responsive-breakpoints.spec.ts` | Validar visibilidad base y ausencia de overflow horizontal     |
| `tests/e2e/responsive/evidence-screenshots.spec.ts`   | Generar capturas por matriz de rutas/viewports y sidebar movil |

### 5.2 Carpeta de evidencias

| Ruta                                                               | Contenido   |
| ------------------------------------------------------------------ | ----------- |
| `docs/evidencias/capturas/2026-04-23_responsive-uiux/desktop`      | 9 capturas  |
| `docs/evidencias/capturas/2026-04-23_responsive-uiux/mobile`       | 10 capturas |
| `docs/evidencias/capturas/2026-04-23_responsive-uiux/mobile-small` | 10 capturas |

Total de artefactos: **29** capturas.

## 6. Flujo de ejecucion aplicado

1. preparacion de entorno Playwright;
2. inicializacion de servidor de pruebas;
3. creacion de usuario temporal E2E;
4. ejecucion de matriz ruta x viewport;
5. validacion de overflow horizontal en rutas criticas;
6. captura full-page de cada combinacion;
7. captura adicional de sidebar movil abierto;
8. limpieza de datos temporales y cierre de corrida.

## 7. Evidencia visual verificable

Directorio base:

- `docs/evidencias/capturas/2026-04-23_responsive-uiux`

### 7.1 Matriz por pagina

| Pagina              | Desktop                                                                               | Mobile                                                                              | Mobile-small                                                                              |
| ------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Login               | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/login-1440x900.png)               | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/login-375x812.png)               | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/login-320x568.png)               |
| Register            | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/register-1440x900.png)            | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/register-375x812.png)            | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/register-320x568.png)            |
| Home                | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/home-1440x900.png)                | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/home-375x812.png)                | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/home-320x568.png)                |
| Dashboard           | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/dashboard-1440x900.png)           | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/dashboard-375x812.png)           | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/dashboard-320x568.png)           |
| Workspace Documents | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/workspace-documents-1440x900.png) | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/workspace-documents-375x812.png) | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/workspace-documents-320x568.png) |
| Chat                | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/chat-1440x900.png)                | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/chat-375x812.png)                | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/chat-320x568.png)                |
| Repository          | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/repository-1440x900.png)          | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/repository-375x812.png)          | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/repository-320x568.png)          |
| Profile             | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/profile-1440x900.png)             | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/profile-375x812.png)             | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/profile-320x568.png)             |
| Help Assistant      | [Ver](./capturas/2026-04-23_responsive-uiux/desktop/help-assistant-1440x900.png)      | [Ver](./capturas/2026-04-23_responsive-uiux/mobile/help-assistant-375x812.png)      | [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/help-assistant-320x568.png)      |

### 7.2 Sidebar movil abierto

- `mobile 375x812`: [Ver](./capturas/2026-04-23_responsive-uiux/mobile/dashboard-sidebar-open-375x812.png)
- `mobile-small 320x568`: [Ver](./capturas/2026-04-23_responsive-uiux/mobile-small/dashboard-sidebar-open-320x568.png)

## 8. Resultados obtenidos

| Resultado                                            | Estado    |
| ---------------------------------------------------- | --------- |
| Matriz de capturas completa (3 viewports x 9 rutas)  | Operativo |
| Validacion automatizada de overflow horizontal       | Operativo |
| Cobertura de shell movil en estado abierto           | Operativo |
| Evidencia versionada para auditoria/regresion visual | Operativo |

## 9. Validacion realizada

Comandos ejecutados:

```bash
pnpm exec playwright install chromium firefox webkit
PLAYWRIGHT_PORT=3001 pnpm exec playwright test tests/e2e/responsive/responsive-breakpoints.spec.ts --project=chromium --workers=1
PLAYWRIGHT_PORT=3001 pnpm exec playwright test tests/e2e/responsive/evidence-screenshots.spec.ts --project=chromium --workers=1
```

Resultados registrados:

- `responsive-breakpoints.spec.ts`: `7 passed (41.7s)`
- `evidence-screenshots.spec.ts`: `1 passed (1.3m)`

## 10. Limitaciones y trabajo pendiente

- Validacion visual concentrada en motor Chromium.
- Validacion complementaria en motores nativos adicionales puede incorporarse en corte posterior.
- Este documento no cubre metricas de rendimiento (LCP, INP, CLS).

## 11. Conclusion tecnica

La validacion responsive transversal queda documentada con cobertura de rutas criticas, control automatizado de overflow horizontal, evidencia visual multi-viewport y trazabilidad reproducible para seguimiento de calidad UI/UX.
