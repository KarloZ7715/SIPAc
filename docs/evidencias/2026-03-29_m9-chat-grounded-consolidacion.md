# Evidencia de Desarrollo — M9: chat grounded, resiliencia multi-proveedor y persistencia operativa

| Campo                   | Valor                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                                   |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                                               |
| **Modulo**              | M9 — Chat inteligente grounded                                                           |
| **Autor**               | Carlos A. Canabal Cordero                                                                |
| **Fecha**               | 2026-03-29                                                                               |
| **Version**             | 1.0                                                                                      |
| **Estado**              | Implementado en backend/frontend; optimizacion de experiencia y politicas en seguimiento |
| **Objetivo del avance** | Consolidar chat con recuperacion contextual, fallback robusto y persistencia estable     |

---

## 1. Proposito de la evidencia

Esta evidencia documenta el estado tecnico real del modulo M9, consolidando el cierre de marzo con ajustes documentales aplicados hasta 2026-04-09, con foco en cuatro ejes:

1. operacion del endpoint conversacional con streaming;
2. recuperacion grounded sobre el repositorio confirmado;
3. tolerancia a fallos por cadena de proveedores/modelos;
4. persistencia consistente de conversaciones y control de consumo por usuario.

No se presenta solo como listado de archivos, sino como trazabilidad entre decisiones, artefactos y comportamiento esperado del sistema.

## 2. Contexto tecnico del modulo

El chat de SIPAc se integra como capa transversal sobre el repositorio academico. La meta funcional no fue un chat generico, sino una interfaz de consulta con contexto institucional, capaz de:

- responder con apoyo de datos existentes en el sistema;
- evitar dependencia de un solo proveedor LLM;
- mantener continuidad de conversacion por usuario;
- proteger el backend frente a abuso de peticiones.

Este alcance exige coordinacion entre API, servicios de seleccion de modelo, tool grounded, modelos de persistencia y cliente web.

## 3. Alcance implementado

### 3.1 Capa API y orquestacion

- Endpoint principal `POST /api/chat` con pipeline de validacion, seleccion de modelo y stream.
- Endpoint `GET /api/chat/providers` para exponer catalogo manual y metadatos de seleccion.
- Integracion de tool-calling para `searchRepositoryProducts` dentro del flujo de respuesta.

### 3.2 Grounding sobre repositorio

- Recuperacion contextual filtrada sobre productos en estado `confirmed`.
- Encapsulamiento de la busqueda en servicio dedicado para separar logica de retrieval de la ruta HTTP.
- Uso de evidencia recuperada como contexto de respuesta en tiempo de inferencia.

### 3.3 Resiliencia multi-proveedor

- Cadena automatica de candidatos para continuidad del servicio ante error de proveedor/modelo.
- Catalogo manual paralelo para control explicito del usuario cuando se requiere.
- Sanitizacion de partes de mensaje/tool para reducir incompatibilidades entre backends LLM.

### 3.4 Persistencia y control operativo

- Persistencia de conversaciones por `userId + chatId` (unicidad compuesta).
- Actualizacion de `lastAccessedAt` y mantenimiento de historial conversacional.
- Rate limiting de chat persistido en bucket dedicado con TTL para enforcement consistente.

## 4. Trazabilidad funcional y de arquitectura

| Eje                   | Decision aplicada                           | Impacto operativo                                       |
| --------------------- | ------------------------------------------- | ------------------------------------------------------- |
| Grounding             | Tool `searchRepositoryProducts` desacoplada | Respuestas con base en repositorio institucional        |
| Resiliencia           | Fallback por candidatos                     | Menor probabilidad de indisponibilidad total            |
| Persistencia          | Conversacion por `userId + chatId`          | Elimina colision entre usuarios con IDs iguales de chat |
| Gobernanza de consumo | Bucket con TTL para rate limit              | Control estable de uso por ventana temporal             |

Esta trazabilidad se encuentra alineada con los documentos de analisis-diseno del mismo corte para arquitectura, modelo de datos y rutas API.

## 5. Decisiones tecnicas clave

### 5.1 Doble estrategia de seleccion de modelo

Se mantuvo separacion entre:

- modo automatico de resiliencia (prioriza disponibilidad),
- modo manual (prioriza control del operador/usuario).

Esto evita mezclar objetivos operativos diferentes en una sola politica opaca.

### 5.2 Saneamiento de mensajes antes de proveedores

Se aplico normalizacion de partes de mensaje y tool calls para reducir fallas por diferencias de compatibilidad entre proveedores LLM.

### 5.3 Persistencia por identidad de sesion de usuario

La decision de unicidad compuesta `userId + chatId` corrige el riesgo de colision de historiales y habilita una semantica de sesion mas robusta.

### 5.4 Rate limit persistente

Persistir buckets en coleccion dedicada evita dependencia de estado efimero en memoria y mejora consistencia en escenarios de reinicio o escalado.

## 6. Artefactos implementados

### 6.1 Backend

- `server/api/chat/index.post.ts`
- `server/api/chat/providers.get.ts`
- `server/services/chat/conversations.ts`
- `server/services/chat/model-selection.ts`
- `server/services/chat/repository-search-tool.ts`
- `server/services/llm/provider.ts`
- `server/models/ChatConversation.ts`
- `server/models/ChatRateLimitBucket.ts`
- `server/utils/chat-rate-limit.ts`
- `scripts/migrate-chat-conversation-index.mjs`

### 6.2 Frontend

- `app/pages/chat.vue`
- `app/composables/useChatPageSession.ts`
- `app/stores/chat.ts`
- `app/types/chat.ts`

### 6.3 Pruebas relacionadas en repositorio

- `tests/unit/server/chat-model-selection.test.ts`
- `tests/unit/server/chat-conversations.test.ts`
- `tests/unit/server/chat-repository-search-tool.test.ts`
- `tests/unit/server/chat-rate-limit.test.ts`
- `tests/unit/server/chat-message-sanitization.test.ts`
- `tests/unit/server/chat-conversation-model.test.ts`

## 7. Flujo funcional resumido

1. Cliente envia prompt al endpoint de chat.
2. API valida payload y contexto de sesion.
3. Se determina ruta de modelo (manual o automatica).
4. Se inicializa generacion con tool grounded disponible.
5. Si falla el proveedor actual, se aplica siguiente candidato de la cadena.
6. La respuesta se transmite en stream y se sanea para persistencia.
7. Se actualiza conversacion (`userId + chatId`) con marcas de acceso.
8. Se aplica control de cuota por bucket de rate limit con TTL.

## 8. Validacion tecnica verificable

La validacion de este modulo se sustenta en tres niveles verificables dentro del repositorio:

- **contratos y rutas**: endpoints y servicios de chat estan trazados en `server/api/chat/*` y `server/services/chat/*`;
- **persistencia**: modelos y utilidades de rate limit documentan estructura y politica de ventana;
- **pruebas unitarias**: existe bateria especifica para seleccion de modelo, saneamiento, conversaciones, tool grounded y rate limit.

Adicionalmente, en el ciclo actual de trabajo se ejecuto una prueba unitaria de utilidades de chat en verde (`tests/unit/app/chat-formatters.test.ts`), manteniendo estabilidad base de la capa cliente asociada.

## 9. Limitaciones y pendientes

- Ajuste fino del catalogo manual por proveedor sigue sujeto a politica operativa.
- Telemetria agregada por proveedor/modelo aun puede profundizarse para control de costos.
- El tuning de mensajes de UX frente a fallback automatico permanece como mejora incremental.

## 10. Conclusion tecnica

M9 queda evidenciado como modulo funcional y operable: consulta grounded, tolerancia a fallos de proveedor, persistencia consistente por sesion y control de uso por usuario. El estado actual es de consolidacion operativa con mejoras incrementales abiertas, no de estancamiento arquitectonico.
