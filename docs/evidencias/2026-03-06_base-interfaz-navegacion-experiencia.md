# Evidencia de Desarrollo — Base de Interfaz, Navegación y Experiencia de Usuario

| Campo                   | Valor                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                                                           |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                                                                       |
| **Componente**          | Capa transversal de interfaz, navegación autenticada y experiencia de usuario                                                    |
| **Autor**               | Carlos A. Canabal Cordero                                                                                                        |
| **Fecha**               | 2026-03-06                                                                                                                       |
| **Versión**             | 1.0                                                                                                                              |
| **Estado**              | Implementado como base de presentación del sistema                                                                               |
| **Objetivo del avance** | Consolidar una interfaz institucional coherente para usuarios autenticados, con navegación protegida y componentes reutilizables |

---

## 1. Propósito de la evidencia

Esta evidencia documenta un avance transversal que no corresponde a un módulo funcional aislado del SRS, sino a la consolidación de la capa de presentación del sistema. Su propósito es dejar constancia de que SIPAc ya no se encuentra únicamente en una fase de endpoints y modelos, sino que cuenta con una base de interfaz consistente, navegable y alineada con el contexto institucional del proyecto.

El valor académico de este avance radica en que convierte capacidades previamente implementadas en backend, especialmente M1 y M6, en una experiencia operable desde la interfaz. Además, deja preparada la estructura visual y de navegación para la incorporación posterior de los módulos de documentos, OCR, repositorio y chat inteligente.

## 2. Alcance implementado

Se consolidaron los siguientes elementos de la capa de interfaz:

- shell principal de aplicación con `sidebar`, encabezado contextual y área de contenido,
- navegación diferenciada según rol (`admin` y `docente`),
- middleware global de protección de rutas autenticadas,
- middleware específico para vistas administrativas,
- stores Pinia para autenticación y administración de usuarios,
- composable reutilizable `useAuth()` como fachada del estado de sesión,
- sistema visual institucional con tokens, paleta, tipografía y componentes SIPAc,
- integración visual de las pantallas de login, registro, inicio, perfil y administración de usuarios,
- estructura base para el futuro workspace de IA y la futura carga documental.

Este avance no implica que los módulos M2, M3, M4, M5, M8 o M9 estén implementados funcionalmente. Lo que sí quedó implementado es la base visual y de navegación para recibirlos sin rehacer la estructura general de la aplicación.

## 3. Trazabilidad con funcionalidades ya implementadas

Aunque esta evidencia no inaugura un módulo nuevo del SRS, sí consolida y expone visualmente requisitos ya cubiertos o parcialmente preparados:

| RF / Área       | Relación con este avance                                                       | Estado                                |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| RF-006          | Restricción de rutas y vistas según rol mediante `auth.global.ts` y `admin.ts` | Consolidado en UI                     |
| RF-007 a RF-010 | Exposición operativa del panel administrativo de usuarios en `/admin/users`    | Consolidado en UI                     |
| RF-073 a RF-075 | Integración visual del módulo de perfil y cambio de contraseña                 | Consolidado en UI                     |
| M2 / M9         | Preparación de secciones visuales para carga documental y consultas asistidas  | Base preparada, no funcional completa |

## 4. Decisiones de diseño relevantes

### 4.1 Shell unificado para usuarios autenticados

Se adoptó un layout base único para las vistas privadas del sistema. La decisión reduce fragmentación visual, evita repetir lógica de navegación entre páginas y facilita que los módulos futuros se integren en una misma experiencia continua.

El layout implementado contiene:

- enlace de salto al contenido principal,
- `sidebar` colapsable y redimensionable,
- encabezado contextual con información de ruta,
- área central uniforme para renderizar páginas.

### 4.2 Navegación dependiente del rol real del usuario

No se construyó un menú estático. La navegación se deriva del contexto autenticado y del rol disponible en sesión. Esta decisión mantiene coherencia con la autorización ya implementada en backend y reduce la posibilidad de mostrar acciones no pertinentes para el usuario actual.

En consecuencia:

- el docente ve accesos orientados a consulta, documentos y perfil,
- el administrador ve accesos orientados a operación institucional, usuarios y perfil.

### 4.3 Diseño visual institucional y no genérico

Se definió una identidad visual propia mediante tokens de color, superficies, tipografía y personalización de `@nuxt/ui`. La intención fue evitar una interfaz genérica de prototipo y construir una base más adecuada para un proyecto de carácter institucional y académico.

### 4.4 Componentización desde la base

Se encapsularon piezas recurrentes en componentes SIPAc (`SipacBadge`, `SipacButton`, `SipacCard`, `SipacQuickAction`, `SipacPasswordInput`, `SipacSectionHeader`). La razón fue mejorar consistencia, reducir duplicación y facilitar iteraciones posteriores sobre la interfaz sin tocar cada página manualmente.

## 5. Artefactos implementados

### 5.1 Estructura base de la aplicación

| Archivo                                | Responsabilidad                                                   |
| -------------------------------------- | ----------------------------------------------------------------- |
| `app/app.vue`                          | Punto de entrada de la aplicación sobre `UApp` y `NuxtLayout`     |
| `app/layouts/default.vue`              | Shell autenticado con `sidebar`, encabezado y contenido principal |
| `app/components/layout/AppHeader.vue`  | Encabezado contextual, rol visible, fecha y menú de usuario       |
| `app/components/layout/AppSidebar.vue` | Navegación contextual y resumen de usuario autenticado            |

### 5.2 Estado y acceso a sesión

| Archivo                      | Responsabilidad                                                               |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `app/stores/auth.ts`         | Gestión del usuario autenticado, login, registro, logout y consulta de sesión |
| `app/stores/users.ts`        | Gestión de listado, consulta, creación y edición administrativa de usuarios   |
| `app/composables/useAuth.ts` | Fachada composable sobre el store de autenticación                            |

### 5.3 Control de navegación

| Archivo                         | Responsabilidad                                                              |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `app/middleware/auth.global.ts` | Protección automática de rutas privadas y redirección según estado de sesión |
| `app/middleware/admin.ts`       | Restricción de acceso a vistas administrativas                               |

### 5.4 Identidad visual del sistema

| Archivo                   | Responsabilidad                                                          |
| ------------------------- | ------------------------------------------------------------------------ |
| `app/app.config.ts`       | Personalización de `@nuxt/ui` con variantes visuales del sistema         |
| `app/assets/css/main.css` | Tokens de diseño, paleta institucional, tipografía y utilidades globales |
| `app/components/sipac/*`  | Componentes reutilizables propios del sistema                            |

### 5.5 Pantallas integradas

| Archivo                     | Responsabilidad                                                           |
| --------------------------- | ------------------------------------------------------------------------- |
| `app/pages/login.vue`       | Acceso autenticado desde interfaz                                         |
| `app/pages/register.vue`    | Registro de nuevos usuarios desde interfaz                                |
| `app/pages/index.vue`       | Página inicial con experiencia diferenciada por rol y secciones prototipo |
| `app/pages/profile.vue`     | Gestión visual de perfil y cambio de contraseña                           |
| `app/pages/admin/users.vue` | Operación visual del módulo administrativo de usuarios                    |

## 6. Flujo funcional consolidado

### 6.1 Ingreso y resolución de sesión

1. El usuario accede a la aplicación.
2. El middleware global valida si existe una sesión utilizable.
3. Si no existe, redirige a `/login` o permite `/register`.
4. Si existe, carga el shell principal del sistema.
5. El encabezado y la navegación se ajustan automáticamente al rol del usuario.

### 6.2 Navegación operativa del administrador

1. El administrador autenticado ingresa al panel principal.
2. El `sidebar` habilita acceso al módulo de gestión de usuarios.
3. El middleware `admin` protege la vista administrativa.
4. La página `/admin/users` consume el store y expone las operaciones de consulta y edición ya implementadas en backend.

### 6.3 Navegación operativa del docente

1. El docente autenticado accede al inicio.
2. La interfaz prioriza un workspace orientado a consulta asistida y gestión documental futura.
3. Desde el mismo entorno puede acceder a su perfil y a las secciones preparadas para módulos posteriores.

## 7. Evidencia técnica y criterios de calidad

### 7.1 Consistencia visual

- Existe una paleta propia del proyecto y no una apariencia por defecto del framework.
- Los componentes reutilizan variantes comunes y preservan lenguaje visual coherente.
- La interfaz distingue claramente superficies, acciones primarias y acciones secundarias.

### 7.2 Navegación segura

- Las rutas privadas exigen sesión activa.
- Las vistas administrativas se restringen adicionalmente por rol.
- La interfaz no depende solo de ocultamiento visual; trabaja en conjunto con la autorización ya implementada en backend.

### 7.3 Accesibilidad base considerada

- Se incluyó enlace de salto al contenido principal.
- Se definieron estados de foco visibles en controles principales.
- Se contempla `prefers-reduced-motion` para reducir animaciones cuando el usuario lo solicita.

### 7.4 Reutilización y mantenibilidad

- La lógica de sesión se centraliza en store y composable.
- La navegación está desacoplada de páginas concretas.
- La base visual puede ampliarse para nuevos módulos sin rehacer estructura principal.

## 8. Resultados obtenidos

| Resultado                                | Estado                               |
| ---------------------------------------- | ------------------------------------ |
| Shell privado del sistema                | Operativo                            |
| Navegación por rol                       | Operativa                            |
| Integración visual de M1 y M6            | Operativa                            |
| Base visual institucional                | Operativa                            |
| Preparación de workspace IA y documentos | Operativa como prototipo de interfaz |

## 9. Validación realizada

- Verificación de redirección hacia `/login` cuando no existe sesión.
- Verificación de redirección fuera de `/login` y `/register` cuando el usuario ya está autenticado.
- Confirmación de restricción visual y de navegación para la ruta administrativa.
- Confirmación de resolución del rol y de adaptación del menú lateral.
- Confirmación de integración de stores con las pantallas ya implementadas.

## 10. Limitaciones y trabajo pendiente

- Las secciones de consulta IA y documentos visibles en la página principal aún no están conectadas a módulos backend completos.
- Aún no existen pruebas automatizadas específicas para esta capa de interfaz.

## 11. Conclusión técnica

La implementación de esta base de interfaz representa un avance significativo en la madurez del proyecto. SIPAc dejó de ser únicamente una suma de endpoints y modelos para convertirse en una aplicación navegable, coherente y preparada para crecimiento incremental. Desde la perspectiva de pasantía, esta evidencia demuestra criterio de arquitectura frontend, control de acceso en la capa de navegación y construcción de una identidad visual institucional mantenible.
