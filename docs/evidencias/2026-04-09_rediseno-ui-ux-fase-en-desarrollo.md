# Evidencia de Desarrollo — Avance UI/UX transversal (fase en desarrollo)

| Campo                   | Valor                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                                 |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                                             |
| **Componente**          | Rediseno transversal de interfaz y experiencia                                         |
| **Autor**               | Carlos A. Canabal Cordero                                                              |
| **Fecha**               | 2026-04-09                                                                             |
| **Version**             | 0.4                                                                                    |
| **Estado**              | En desarrollo; fase de consolidacion visual/funcional aun no cerrada                   |
| **Objetivo del avance** | Unificar navegacion, identidad visual y experiencia en modulos principales del sistema |

---

## 1. Proposito de la evidencia

Documentar el estado real del rediseno UI/UX en su fase activa de ejecucion. Esta evidencia no representa un cierre definitivo del frente de experiencia; registra lo implementado hasta la fecha, lo validado y lo pendiente para cerrar fase.

## 2. Contexto y necesidad del avance

Con la expansion funcional de SIPAc (chat, repositorio, dashboard, perfil y workspace documental), la interfaz previa mostraba diferencias de navegacion y estilo entre modulos. El objetivo del avance actual es reducir esa fragmentacion sin romper integraciones existentes.

Problema de origen:

- patrones de layout heterogeneos entre vistas autenticadas;
- experiencia de navegacion con menor continuidad visual;
- necesidad de reforzar identidad de marca en puntos clave del flujo.

## 3. Alcance implementado en esta fase

### 3.1 Shell y navegacion

- Estructura base de layout autenticado (header + sidebar) como marco comun.
- Centralizacion de piezas de navegacion reutilizables para evitar duplicacion de comportamiento.
- Ajustes de continuidad de interaccion entre secciones principales.

### 3.2 Rediseno de vistas clave

- `app/pages/index.vue`
- `app/pages/dashboard.vue`
- `app/pages/profile.vue`
- `app/pages/chat.vue`
- `app/pages/workspace-documents.vue`

En estas vistas se avanzo en jerarquia visual, coherencia de espaciados y consistencia de componentes, manteniendo el contrato funcional actual de cada modulo.

Nota de estado de fase: el rediseño de `dashboard`, `profile` y `workspace-documents` se encuentra en desarrollo y aun requiere cierre de detalles visuales y de experiencia para considerarse terminado.

### 3.3 Sistema visual y marca

- consolidacion de estilos base en `app/assets/css/main.css`;
- afinacion de configuracion UI en `app/app.config.ts`;
- refuerzo de identidad en `app/components/brand/SipacLogoMarkAnimated.vue`;

## 4. Trazabilidad tecnica

| Eje de trabajo        | Decision aplicada                              | Resultado actual                                      |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Navegacion            | Componentes de layout comunes                  | Menor variacion de patrones entre vistas autenticadas |
| Identidad visual      | Componentes de marca dedicados                 | Mayor consistencia de branding en pantallas clave     |
| Compatibilidad        | Mantener stack `@nuxt/ui` + Tailwind + Nuxt 4  | Sin ruptura arquitectonica por el rediseno            |
| Evolucion incremental | Entrega por etapas en lugar de reemplazo total | Posible iterar UX sin detener operacion funcional     |

## 5. Artefactos implementados

### 5.1 Layout y base visual

- `app/layouts/default.vue`
- `app/components/layout/AppHeader.vue`
- `app/components/layout/AppSidebar.vue`
- `app/assets/css/main.css`
- `app/app.config.ts`

### 5.2 Marca y apoyo visual

- `app/components/brand/SipacLogoMarkAnimated.vue`

### 5.3 Vistas intervenidas en fase actual

- `app/pages/index.vue`
- `app/pages/dashboard.vue`
- `app/pages/profile.vue`
- `app/pages/chat.vue`
- `app/pages/workspace-documents.vue`

## 6. Flujo funcional impactado

1. Usuario autenticado entra al shell comun (`default.vue`).
2. Navega entre modulos con header/sidebar unificados.
3. Cada vista mantiene su logica de negocio, pero con patrones visuales mas coherentes.
4. Los componentes de marca refuerzan continuidad en puntos de entrada y reconocimiento.

Impacto esperado de esta fase: reducir friccion cognitiva entre modulos y preparar base para una fase posterior de pulido UX y cierre formal.

## 7. Validacion tecnica del avance

Validaciones registradas para esta fase en desarrollo:

- verificacion manual de navegacion entre vistas principales con foco en continuidad visual;
- comprobacion de integracion con stores/composables existentes, sin regresiones estructurales detectadas en validaciones manuales puntuales de las vistas intervenidas;
- ejecucion puntual de prueba unitaria de utilidades de chat en estado verde durante el ciclo actual (`tests/unit/app/chat-formatters.test.ts`).

Nota metodologica: la validacion integral de UI (incluyendo cierre total de copy y cobertura final de pruebas de interfaz) sigue abierta y no se considera finalizada en este documento.

## 8. Brechas actuales y trabajo pendiente

- cerrar ajustes de copy y expectativas en pruebas de interfaz afectadas por cambios de texto/estructura visual;
- completar ronda de pulido visual en estados vacios, mensajes de ayuda y microinteracciones;
- completar el rediseño pendiente de las paginas `dashboard`, `profile` y `workspace-documents`, incluyendo consistencia final de layout, jerarquia visual y estados auxiliares;
- consolidar criterios finales de aceptacion UX para declarar fase cerrada;
- ejecutar una pasada final de regression visual/manual sobre los modulos intervenidos.

## 9. Plan del siguiente corte tecnico

1. completar alineacion de pruebas de interfaz y textos;
2. completar el rediseño de `dashboard`, `profile` y `workspace-documents` hasta cierre funcional/visual;
3. cerrar checklist de consistencia visual de vistas autenticadas;
4. documentar cierre de fase con evidencia final diferenciada de este avance intermedio.

## 10. Conclusion de avance

El rediseno UI/UX presenta progreso tangible y util para la operacion diaria de SIPAc, pero esta evidencia deja explicitamente establecido que la fase sigue en desarrollo. El estado correcto en esta fecha es de consolidacion parcial con pendientes identificados, incluyendo el cierre del rediseño en `dashboard`, `profile` y `workspace-documents`, y un plan de cierre definido.
