# FrioTrack 360 — Contexto del Proyecto

## 1. Descripción general

**FrioTrack 360** es un aplicativo web orientado a la gestión y trazabilidad de la distribución de productos perecibles que requieren control de condiciones de conservación, especialmente temperatura, durante su almacenamiento, despacho y transporte.

El sistema busca reemplazar procesos actualmente realizados de forma manual mediante archivos y registros dispersos, centralizando la información relacionada con:

- Lotes.
- Despachos y envíos.
- Cadena de custodia.
- Lecturas de temperatura y condición.
- Reglas de control.
- Alertas.
- No conformidades.
- Acciones correctivas.
- Bloqueo y liberación de lotes.
- Evidencias.
- Historial de eventos.
- Auditoría.

El objetivo principal no es únicamente registrar información, sino permitir **reconstruir la historia completa de un envío o lote y conocer qué ocurrió, cuándo ocurrió, quién intervino y qué decisión se tomó**.

---

# 2. Situación problemática

Actualmente, la empresa distribuye productos perecibles y registra manualmente información relacionada con los despachos, lotes, lecturas de temperatura e incidencias.

Cuando ocurre una desviación, por ejemplo una temperatura fuera del rango permitido, determinar qué sucedió requiere revisar múltiples archivos y registros.

Esto genera problemas como:

- Información dispersa.
- Dificultad para reconstruir eventos.
- Mayor tiempo para investigar incidencias.
- Riesgo de pérdida o inconsistencia de información.
- Falta de trazabilidad completa.
- Dificultad para determinar responsables.
- Dificultad para demostrar por qué se tomó una decisión.
- Ausencia de un historial centralizado.
- Dependencia de registros manuales.
- Mayor riesgo de errores humanos.

## Problema central

> La empresa no dispone de un sistema centralizado que permita gestionar y reconstruir de manera eficiente la trazabilidad de los lotes y envíos, controlar las condiciones de transporte, detectar desviaciones y registrar las decisiones tomadas frente a ellas.

---

# 3. Objetivo general

Desarrollar un aplicativo web que permita gestionar y centralizar la trazabilidad de productos perecibles durante su distribución, mediante el registro de lotes, despachos, cadena de custodia, lecturas de temperatura, reglas de control, alertas, no conformidades, acciones correctivas y decisiones de bloqueo o liberación.

El sistema deberá proporcionar evidencia suficiente para reconstruir la historia de un lote o envío ante una desviación.

---

# 4. Objetivos específicos

El sistema deberá permitir:

1. Registrar y administrar lotes de productos perecibles.
2. Registrar despachos y envíos.
3. Asociar lotes con sus respectivos envíos.
4. Registrar eventos de cadena de custodia.
5. Registrar lecturas periódicas de temperatura y condiciones.
6. Configurar reglas y umbrales de control.
7. Detectar automáticamente desviaciones.
8. Generar y gestionar alertas.
9. Registrar no conformidades.
10. Gestionar acciones correctivas.
11. Adjuntar y consultar evidencias.
12. Bloquear y liberar lotes según autorización.
13. Mantener un historial cronológico de eventos.
14. Permitir reconstruir la trazabilidad de un lote o envío.
15. Proporcionar indicadores mediante un panel de control.
16. Implementar autenticación, autorización mediante roles y JWT.
17. Mantener una auditoría de las operaciones críticas.

---

# 5. Alcance funcional

## 5.1 Gestión de lotes

El sistema permitirá registrar y administrar los lotes de productos perecibles.

Información potencial:

- Identificador del lote.
- Producto.
- Cantidad.
- Fecha de producción.
- Fecha de vencimiento.
- Estado.
- Información adicional.

Los lotes deberán poder encontrarse mediante búsquedas y filtros.

El sistema deberá mantener el historial de eventos asociados a cada lote.

### Estados posibles

Los estados pueden incluir:

- Disponible.
- En despacho.
- En tránsito.
- Bloqueado.
- Liberado.
- Vencido.

Los estados definitivos deberán definirse durante el diseño del sistema.

---

# 6. Gestión de despachos y envíos

Un despacho representa la operación mediante la cual uno o varios lotes son preparados y enviados hacia un destino.

El sistema deberá permitir:

- Crear despachos.
- Generar un identificador único de envío.
- Asociar uno o varios lotes.
- Registrar destino.
- Registrar vehículo.
- Registrar responsable.
- Registrar fecha y hora.
- Consultar el estado del envío.
- Registrar cambios de estado.
- Consultar el historial del envío.

### Relación conceptual

```text
Producto
   │
   └── Lote
         │
         └── Envío
               │
               ├── Cadena de custodia
               ├── Lecturas
               ├── Alertas
               ├── Incidencias
               └── Eventos
```

---

# 7. Cadena de custodia

La cadena de custodia permite registrar quién tuvo responsabilidad sobre el envío y qué eventos ocurrieron durante su recorrido.

Cada evento relevante deberá registrar, cuando corresponda:

- Tipo de evento.
- Fecha.
- Hora.
- Responsable.
- Ubicación.
- Observaciones.
- Evidencia.

Ejemplos:

- Preparación del despacho.
- Salida del almacén.
- Recepción por transportista.
- Cambio de responsable.
- Llegada a destino.
- Entrega.
- Recepción.
- Incidencia durante transporte.

El sistema deberá conservar estos eventos de manera cronológica.

---

# 8. Control de temperatura y condiciones

El sistema deberá permitir registrar lecturas periódicas relacionadas con las condiciones de conservación de los productos.

Como mínimo se contempla:

- Temperatura.
- Fecha y hora.
- Envío asociado.
- Lote asociado cuando corresponda.

En el futuro podría ampliarse para registrar:

- Humedad.
- Estado del vehículo.
- Condición del embalaje.
- Apertura de puertas.
- Otros parámetros obtenidos mediante sensores.

El sistema deberá permitir consultar el historial de lecturas y representar la evolución de la temperatura.

---

# 9. Reglas y umbrales

Las condiciones aceptables para los productos deberán poder configurarse mediante reglas.

Ejemplo:

```text
Producto: Producto refrigerado A

Temperatura mínima: 2 °C
Temperatura máxima: 8 °C
```

Una lectura de:

```text
5 °C → Cumple
```

Una lectura de:

```text
10 °C → No cumple
```

Las reglas deberán ser configurables y no estar necesariamente codificadas directamente en el programa.

El sistema deberá conservar el historial de modificaciones realizadas sobre las reglas.

---

# 10. Alertas

Cuando una lectura incumpla una regla configurada, el sistema deberá poder generar automáticamente una alerta.

Una alerta deberá estar asociada al contexto que la originó.

Ejemplo:

```text
Envío: ENV-2026-00125
Lote: LOT-2026-0045
Lectura: 10.4 °C
Rango permitido: 2 °C - 8 °C
Fecha: 2026-08-28 14:30
Motivo: Temperatura superior al umbral permitido
```

La alerta deberá permitir conocer:

- Qué ocurrió.
- Cuándo ocurrió.
- Qué lote fue afectado.
- Qué envío fue afectado.
- Qué regla fue incumplida.
- Quién atendió la alerta.
- Qué acciones se realizaron.

---

# 11. No conformidades

Una desviación significativa podrá generar una **no conformidad**.

La no conformidad deberá permitir registrar:

- Identificador.
- Tipo.
- Descripción.
- Fecha.
- Lote afectado.
- Envío afectado.
- Causa.
- Responsable.
- Estado.
- Evidencias.
- Acciones realizadas.
- Fecha de resolución.

Ejemplo:

```text
Alerta
   ↓
Desviación de temperatura
   ↓
No conformidad
   ↓
Investigación
   ↓
Acción correctiva
   ↓
Validación
   ↓
Cierre
```

---

# 12. Acciones correctivas

Las acciones correctivas representan las medidas tomadas para solucionar o prevenir la repetición de una no conformidad.

Cada acción podrá registrar:

- Descripción.
- Responsable.
- Fecha de creación.
- Fecha límite.
- Estado.
- Evidencia.
- Fecha de finalización.
- Usuario que validó el cumplimiento.

Una acción correctiva no debería considerarse cerrada hasta que haya sido validada por el usuario autorizado correspondiente.

---

# 13. Evidencias

El sistema deberá permitir asociar evidencia a eventos importantes.

Las evidencias pueden estar relacionadas con:

- Alertas.
- No conformidades.
- Acciones correctivas.
- Bloqueos.
- Liberaciones.
- Eventos de cadena de custodia.

Cada evidencia deberá conservar como mínimo:

- Archivo o referencia.
- Usuario que la registró.
- Fecha y hora.
- Evento o entidad relacionada.

El objetivo es que las decisiones importantes puedan ser respaldadas mediante evidencia.

---

# 14. Bloqueo y liberación de lotes

Cuando un lote presente una condición que requiera revisión, podrá ser bloqueado.

Ejemplo:

```text
Lectura fuera de rango
        ↓
Alerta
        ↓
No conformidad
        ↓
Lote BLOQUEADO
        ↓
Investigación
        ↓
Decisión
       / \
      /   \
Liberar   Mantener bloqueado
```

El bloqueo deberá impedir que el lote sea utilizado en nuevos despachos mientras se encuentre bloqueado.

La liberación deberá estar restringida a usuarios con el rol autorizado.

Toda operación de bloqueo o liberación deberá registrar:

- Lote.
- Estado anterior.
- Estado nuevo.
- Usuario.
- Fecha y hora.
- Motivo.
- Evidencia cuando corresponda.

---

# 15. Trazabilidad

La trazabilidad es uno de los componentes principales del sistema.

El sistema deberá permitir reconstruir la historia de un lote o envío.

Por ejemplo:

```text
LOTE
 │
 ├── Registro
 │
 ├── Estado
 │
 ├── Despacho
 │
 ├── Cadena de custodia
 │
 ├── Lecturas de temperatura
 │
 ├── Alertas
 │
 ├── No conformidades
 │
 ├── Acciones correctivas
 │
 ├── Bloqueos
 │
 ├── Liberaciones
 │
 └── Auditoría
```

La consulta de trazabilidad debería permitir responder preguntas como:

- ¿Qué ocurrió con este lote?
- ¿En qué envío fue transportado?
- ¿Qué temperatura registró?
- ¿Cuándo ocurrió la desviación?
- ¿Qué regla fue incumplida?
- ¿Quién atendió la alerta?
- ¿Se generó una no conformidad?
- ¿Qué acción correctiva se realizó?
- ¿Quién bloqueó el lote?
- ¿Quién autorizó su liberación?
- ¿Qué evidencia respalda la decisión?

---

# 16. Historial de eventos

El sistema deberá mantener un historial cronológico de eventos.

Un evento podrá contener:

```text
ID
Tipo de evento
Entidad relacionada
Fecha y hora
Usuario
Descripción
Estado anterior
Estado nuevo
Evidencia
```

Ejemplo:

```text
14:05 - Envío creado
14:20 - Lote asociado
14:30 - Salida del almacén
15:15 - Lectura: 5.2 °C
16:15 - Lectura: 10.4 °C
16:15 - Alerta generada
16:25 - No conformidad creada
16:30 - Lote bloqueado
17:40 - Evidencia registrada
18:10 - Lote liberado
```

Esto permitirá reconstruir la secuencia de acontecimientos.

---

# 17. Dashboard

El sistema deberá proporcionar un panel de control para supervisar el estado operativo.

El dashboard podrá mostrar:

### Cumplimiento

- Porcentaje de lecturas dentro de rango.
- Porcentaje de envíos sin desviaciones.
- Cumplimiento por producto.
- Cumplimiento por período.

### Alertas

- Alertas activas.
- Alertas atendidas.
- Alertas críticas.
- Alertas por tipo de desviación.

### Lotes

- Lotes disponibles.
- Lotes en tránsito.
- Lotes bloqueados.
- Lotes pendientes de liberación.

### Validaciones

- Tiempo promedio de atención.
- Tiempo promedio de resolución.
- Tiempo de validación de liberaciones.

### Trazabilidad

- Envíos monitoreados.
- Lotes con incidencias.
- Eventos registrados.
- Envíos con trazabilidad completa.

---

# 18. Usuarios y roles

El sistema deberá implementar control de acceso basado en roles.

Una propuesta inicial de roles es:

## Administrador

Puede:

- Gestionar usuarios.
- Gestionar roles y permisos.
- Configurar parámetros generales.
- Consultar auditoría.
- Gestionar reglas.

## Operador / Despachador

Puede:

- Registrar lotes.
- Registrar despachos.
- Registrar envíos.
- Registrar eventos de custodia.
- Registrar lecturas.

## Responsable de Calidad

Puede:

- Consultar alertas.
- Gestionar no conformidades.
- Registrar acciones correctivas.
- Validar evidencias.
- Bloquear lotes.
- Liberar lotes según autorización.

## Supervisor

Puede:

- Consultar dashboard.
- Consultar trazabilidad.
- Supervisar alertas.
- Consultar indicadores.
- Consultar historial.

Los roles definitivos y sus permisos deberán definirse antes de implementar el control de autorización.

---

# 19. Autenticación y seguridad

El sistema deberá utilizar autenticación y autorización.

Se contempla:

- Autenticación mediante usuario y contraseña.
- JWT para autenticación de las solicitudes.
- Control de acceso mediante roles.
- Protección de endpoints.
- Expiración de tokens.
- Comunicación mediante HTTPS.
- Contraseñas almacenadas de manera segura.
- Auditoría de operaciones críticas.

La implementación tecnológica de autenticación puede utilizar un proveedor externo como Keycloak o una solución equivalente, dependiendo de las decisiones arquitectónicas del proyecto.

---

# 20. Auditoría

La auditoría deberá registrar las operaciones críticas realizadas dentro del sistema.

Como mínimo:

```text
Usuario
Acción
Entidad afectada
Fecha
Hora
Resultado
```

Operaciones que deberían auditarse:

- Creación de lotes.
- Modificación de lotes.
- Creación de despachos.
- Modificación de envíos.
- Registro de lecturas.
- Modificación de reglas.
- Generación/gestión de alertas.
- Creación de no conformidades.
- Creación de acciones correctivas.
- Bloqueo de lotes.
- Liberación de lotes.
- Cambios de roles.
- Cambios de permisos.

Los registros de auditoría deben estar protegidos contra modificaciones no autorizadas.

---

# 21. Requisitos funcionales

## RF-01 — Gestión de usuarios y roles

- RF-01.01 Registrar usuarios.
- RF-01.02 Modificar usuarios.
- RF-01.03 Activar y desactivar usuarios.
- RF-01.04 Asignar roles.
- RF-01.05 Controlar acceso según rol.

## RF-02 — Gestión de lotes

- RF-02.01 Registrar lotes.
- RF-02.02 Consultar lotes.
- RF-02.03 Modificar información permitida.
- RF-02.04 Gestionar estados.
- RF-02.05 Bloquear lotes.
- RF-02.06 Liberar lotes.
- RF-02.07 Registrar las decisiones de bloqueo/liberación.

## RF-03 — Gestión de despachos y envíos

- RF-03.01 Registrar despachos.
- RF-03.02 Generar identificadores de envío.
- RF-03.03 Asociar lotes a envíos.
- RF-03.04 Registrar destino.
- RF-03.05 Registrar vehículo.
- RF-03.06 Registrar responsables.
- RF-03.07 Gestionar estados del envío.

## RF-04 — Cadena de custodia

- RF-04.01 Registrar eventos de custodia.
- RF-04.02 Registrar responsables.
- RF-04.03 Registrar fechas y horas.
- RF-04.04 Registrar ubicación cuando corresponda.
- RF-04.05 Consultar historial de custodia.

## RF-05 — Lecturas

- RF-05.01 Registrar temperaturas.
- RF-05.02 Registrar fecha y hora.
- RF-05.03 Asociar lecturas con envíos/lotes.
- RF-05.04 Registrar otras condiciones.
- RF-05.05 Consultar historial.
- RF-05.06 Visualizar evolución de temperatura.
- RF-05.07 Detectar desviaciones.

## RF-06 — Reglas

- RF-06.01 Configurar umbrales.
- RF-06.02 Asociar reglas con productos.
- RF-06.03 Configurar condiciones de alerta.
- RF-06.04 Activar/desactivar reglas.
- RF-06.05 Mantener historial de reglas.

## RF-07 — Alertas

- RF-07.01 Generar alertas automáticamente.
- RF-07.02 Registrar causa.
- RF-07.03 Asociar alerta con lote/envío.
- RF-07.04 Gestionar estado.
- RF-07.05 Registrar atención.
- RF-07.06 Registrar responsable.

## RF-08 — No conformidades

- RF-08.01 Registrar no conformidades.
- RF-08.02 Asociarlas a lotes/envíos.
- RF-08.03 Registrar causas.
- RF-08.04 Asignar responsables.
- RF-08.05 Gestionar estados.
- RF-08.06 Registrar evidencias.

## RF-09 — Acciones correctivas

- RF-09.01 Crear acciones correctivas.
- RF-09.02 Asignar responsables.
- RF-09.03 Definir fechas límite.
- RF-09.04 Registrar avances.
- RF-09.05 Registrar evidencias.
- RF-09.06 Validar y cerrar acciones.

## RF-10 — Trazabilidad

- RF-10.01 Registrar eventos de envío.
- RF-10.02 Registrar eventos de lote.
- RF-10.03 Consultar línea temporal.
- RF-10.04 Identificar responsables.
- RF-10.05 Reconstruir historial.
- RF-10.06 Relacionar alertas, incidencias y decisiones.

## RF-11 — Evidencias

- RF-11.01 Adjuntar evidencias.
- RF-11.02 Asociar evidencias a eventos.
- RF-11.03 Registrar autor y fecha.
- RF-11.04 Consultar evidencias.

## RF-12 — Dashboard

- RF-12.01 Mostrar cumplimiento.
- RF-12.02 Mostrar alertas.
- RF-12.03 Mostrar lotes bloqueados.
- RF-12.04 Mostrar indicadores.
- RF-12.05 Mostrar tiempos de validación.
- RF-12.06 Mostrar información de trazabilidad.
- RF-12.07 Filtrar información.

## RF-13 — Auditoría

- RF-13.01 Registrar operaciones críticas.
- RF-13.02 Registrar usuario.
- RF-13.03 Registrar fecha y hora.
- RF-13.04 Registrar cambios relevantes.
- RF-13.05 Consultar auditoría según permisos.

## RF-14 — Autenticación

- RF-14.01 Autenticar usuarios.
- RF-14.02 Utilizar JWT.
- RF-14.03 Validar tokens.
- RF-14.04 Aplicar autorización por roles.
- RF-14.05 Impedir operaciones no autorizadas.
- RF-14.06 Permitir cerrar sesión.

---

# 22. Requisitos no funcionales

## RNF-01 — Seguridad

El sistema deberá:

- Utilizar HTTPS.
- Proteger las credenciales.
- Utilizar JWT.
- Controlar permisos por rol.
- Proteger endpoints.
- Aplicar expiración de tokens.
- Proteger información sensible.

## RNF-02 — Rendimiento

Como objetivo inicial:

- Las operaciones comunes deberían responder en menos de 2–3 segundos bajo condiciones normales.
- El sistema deberá soportar múltiples usuarios concurrentes.
- Las consultas de trazabilidad deberán ser eficientes incluso con un historial considerable.

Los valores definitivos deberán validarse mediante pruebas de rendimiento.

## RNF-03 — Disponibilidad

- El sistema deberá estar disponible durante el horario operativo.
- Se deberán implementar mecanismos de recuperación ante errores.
- Se deberán realizar respaldos de la información.
- Las fallas no deberán provocar pérdida de registros confirmados.

## RNF-04 — Integridad

- Los registros deberán mantener consistencia.
- Las lecturas deberán estar correctamente asociadas a su envío/lote.
- Los eventos deberán conservar su información temporal.
- Las operaciones críticas deberán mantener su historial.

## RNF-05 — Trazabilidad

- Los lotes deberán tener identificadores únicos.
- Los envíos deberán tener identificadores únicos.
- Los eventos deberán poder relacionarse con sus entidades.
- Las acciones críticas deberán ser rastreables.

## RNF-06 — Escalabilidad

La arquitectura deberá permitir aumentar:

- Número de usuarios.
- Número de envíos.
- Número de lotes.
- Número de lecturas.
- Número de eventos.

También deberá permitir futuras integraciones con sensores IoT.

## RNF-07 — Usabilidad

- La interfaz deberá ser intuitiva.
- Los formularios deberán validar información.
- Los mensajes de error deberán ser comprensibles.
- Las alertas deberán ser fácilmente identificables.
- La información crítica deberá destacarse adecuadamente.

## RNF-08 — Mantenibilidad

- El código deberá utilizar una arquitectura organizada.
- Deberá existir separación de responsabilidades.
- Los componentes deberán ser reutilizables.
- Las reglas de negocio no deberán estar innecesariamente acopladas a la interfaz.
- La configuración deberá mantenerse separada del código cuando corresponda.

## RNF-09 — Compatibilidad

- El sistema deberá funcionar en navegadores web modernos.
- La interfaz deberá ser responsive.
- El backend deberá poder exponer APIs para futuras aplicaciones móviles o integraciones.

## RNF-10 — Auditabilidad

- Las operaciones críticas deberán quedar registradas.
- Los registros deberán contener usuario, acción, fecha y hora.
- Los registros deberán estar protegidos contra modificaciones no autorizadas.

---

# 23. Reglas de negocio iniciales

Las siguientes reglas representan el comportamiento esperado del sistema y deberán refinarse durante el análisis.

### RB-01 — Lote bloqueado

Un lote bloqueado no podrá ser incluido en un nuevo despacho.

### RB-02 — Liberación autorizada

Solo un usuario con el permiso correspondiente podrá liberar un lote bloqueado.

### RB-03 — Desviación de temperatura

Cuando una lectura incumpla los límites configurados para el producto, el sistema deberá identificar la lectura como una desviación.

### RB-04 — Generación de alerta

Una desviación deberá generar una alerta según las reglas configuradas.

### RB-05 — Trazabilidad

Todo evento relevante deberá quedar asociado a su lote, envío o entidad correspondiente.

### RB-06 — Auditoría

Las operaciones críticas deberán generar registros de auditoría.

### RB-07 — Evidencia

Las decisiones críticas, especialmente bloqueo y liberación, deberán poder estar respaldadas por evidencia.

### RB-08 — Integridad histórica

Los eventos históricos críticos no deberán modificarse arbitrariamente.

### RB-09 — Acciones correctivas

Una acción correctiva deberá tener un responsable y, cuando corresponda, una fecha límite.

### RB-10 — Cierre

Una no conformidad no debería cerrarse mientras existan acciones correctivas pendientes de validación.

---

# 24. Modelo conceptual inicial

La estructura conceptual puede representarse de manera simplificada como:

```text
USUARIO
   │
   └── ROL
        │
        ▼
      ACCIONES
        │
        ▼
     AUDITORÍA


PRODUCTO
   │
   └── LOTE
         │
         ├── ESTADO
         │
         └── ENVÍO
               │
               ├── CADENA DE CUSTODIA
               │
               ├── LECTURAS
               │      │
               │      └── REGLAS
               │             │
               │             └── ALERTAS
               │
               ├── EVENTOS
               │
               └── NO CONFORMIDADES
                         │
                         ├── EVIDENCIAS
                         │
                         └── ACCIONES CORRECTIVAS
```

---

# 25. Flujo principal del sistema

Un flujo típico podría ser:

```text
Registrar producto
      ↓
Registrar lote
      ↓
Crear despacho
      ↓
Asociar lote al envío
      ↓
Iniciar transporte
      ↓
Registrar eventos de custodia
      ↓
Registrar lecturas
      ↓
Evaluar reglas
      ↓
¿Existe desviación?
   /           \
 NO             SÍ
 │               │
 ▼               ▼
Continuar      Generar alerta
                 ↓
             Evaluar situación
                 ↓
          ¿Requiere intervención?
             /          \
           NO            SÍ
           │              │
           ▼              ▼
       Continuar      Crear no conformidad
                           ↓
                     Bloquear lote
                           ↓
                   Registrar investigación
                           ↓
                    Acción correctiva
                           ↓
                       Evidencia
                           ↓
                       Validación
                           ↓
                  ¿Lote conforme?
                     /       \
                   SÍ         NO
                   │           │
                   ▼           ▼
                Liberar    Mantener bloqueado
                   │
                   ▼
             Registrar decisión
                   │
                   ▼
              Auditoría
```

---

# 26. Arquitectura tecnológica

La arquitectura tecnológica todavía puede definirse según las necesidades del proyecto.

Una posible arquitectura para el aplicativo web sería:

```text
┌──────────────────────────┐
│       Frontend Web       │
│     React / Next.js      │
└────────────┬─────────────┘
             │ HTTPS / REST
             ▼
┌──────────────────────────┐
│        Backend API       │
│       Spring Boot        │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       ▼           ▼
┌────────────┐ ┌─────────────┐
│ PostgreSQL │ │ Auth Server │
│            │ │  JWT/OAuth2 │
└────────────┘ └─────────────┘
```

Esta arquitectura es únicamente una propuesta inicial. Las tecnologías concretas pueden cambiar sin modificar los requisitos funcionales del sistema.

---

# 27. Principio fundamental del proyecto

FrioTrack 360 no debe diseñarse únicamente como un sistema CRUD.

El valor principal del sistema está en la **trazabilidad y reconstrucción de eventos**.

La información debe estar relacionada de forma que sea posible pasar de:

```text
Lote
 ↓
Envío
 ↓
Evento
 ↓
Lectura
 ↓
Regla
 ↓
Desviación
 ↓
Alerta
 ↓
No conformidad
 ↓
Acción correctiva
 ↓
Decisión
 ↓
Evidencia
 ↓
Usuario
 ↓
Auditoría
```

Por lo tanto, al diseñar nuevas funcionalidades se debe preguntar:

> **¿Esta funcionalidad permite registrar, controlar, demostrar o reconstruir algo relacionado con la cadena de custodia y la condición del producto?**

Si la respuesta es no, debe evaluarse si realmente pertenece al alcance principal de FrioTrack 360.

---

# 28. Criterios generales para futuras decisiones de diseño

Cualquier IA o desarrollador que trabaje sobre este proyecto deberá respetar los siguientes principios:

1. **Priorizar trazabilidad sobre simplicidad de CRUD.**
2. **Las decisiones críticas deben ser auditables.**
3. **Los eventos importantes deben conservar usuario y fecha/hora.**
4. **El bloqueo/liberación debe estar controlado por permisos.**
5. **Las reglas de temperatura deben ser configurables.**
6. **Las alertas deben conservar su causa y contexto.**
7. **Las no conformidades deben poder relacionarse con sus alertas.**
8. **Las acciones correctivas deben relacionarse con sus no conformidades.**
9. **Las decisiones importantes deben poder respaldarse mediante evidencia.**
10. **El historial crítico no debe poder alterarse arbitrariamente.**
11. **La arquitectura debe permitir futuras integraciones con sensores IoT.**
12. **No introducir funcionalidades fuera del alcance sin justificar su necesidad.**

---

# 29. Resultado esperado

Al finalizar el desarrollo, un usuario autorizado debería poder seleccionar un lote o envío y obtener una vista completa de su trazabilidad.

Por ejemplo:

```text
ENV-2026-00125
│
├── Lote: LOT-2026-0045
├── Producto: Producto refrigerado A
├── Destino: Cliente X
├── Vehículo: VEH-015
│
├── Cadena de custodia
│   ├── Salida: 14:30
│   ├── Transportista: Usuario X
│   └── Recepción: 19:45
│
├── Temperatura
│   ├── 14:30 → 5.1 °C
│   ├── 15:30 → 5.4 °C
│   ├── 16:30 → 10.4 °C ⚠
│   └── 17:30 → 7.1 °C
│
├── Alerta
│   └── Temperatura fuera de rango
│
├── No conformidad
│   └── NC-2026-0032
│
├── Acción correctiva
│   └── AC-2026-0018
│
├── Decisión
│   └── Lote bloqueado → Liberado
│
├── Evidencias
│   └── Evidencia asociada
│
└── Auditoría
    ├── Usuario que bloqueó
    └── Usuario que liberó
```

Este resultado representa el propósito central de **FrioTrack 360: transformar registros dispersos en una trazabilidad digital, auditable y reconstruible de cada lote y envío.**