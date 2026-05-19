# Estado actual del sistema PCA CLI

Fecha de corte: 2026-05-17

## Resumen ejecutivo

PCA CLI es un CLI TypeScript publicado como `@quantpartners/pca`, actualmente en version `0.3.1`.

El sistema implementa una arquitectura de memoria persistente para proyectos de desarrollo AI-native:

- Markdown local como fuente de verdad.
- Comandos offline para crear y consultar estado local del proyecto.
- Registro local de "context commits".
- Modo BYOK para guardar y validar una API key de OpenAI.
- Modo cloud separado para autenticacion PCA.
- Sincronizacion de memoria Markdown hacia OpenAI Vector Stores.
- Backend web separado (`pca-auth`) para login browser-based con Clerk y Redis.

La suite actual pasa completa:

```txt
npm.cmd test
27 tests passed
0 failed
```

## Estructura del repositorio

```txt
PCA-CLI/
  src/
    index.ts
    commands/
    core/
    templates/
  tests/
    cli.test.mjs
  scripts/
    clean-dist.js
  pca-auth/
    src/app/
    src/lib/
  README.md
  package.json
  tsconfig.json
```

## Producto principal: CLI

El entrypoint es `src/index.ts`.

Comandos registrados actualmente:

- `pca help`
- `pca setup`
- `pca doctor`
- `pca login`
- `pca logout`
- `pca whoami`
- `pca config`
- `pca status`
- `pca commit`
- `pca logs`
- `pca init`
- `pca sync`
- `pca query`
- `pca task`
- `pca visual add`
- `pca close`

El CLI usa:

- `commander` para comandos.
- `chalk` para output.
- `fs-extra` para filesystem.
- `openai` para Vector Stores.
- `dotenv` para leer `.env`.
- `fast-glob` para descubrir archivos sincronizables.

Requiere Node.js `>=20`.

## Modos implementados

### Local-only

Estado: implementado y probado.

No requiere PCA auth, OpenAI key, backend ni red.

Comandos principales:

- `pca setup --mode local-only`
- `pca init`
- `pca status`
- `pca commit`
- `pca logs`

`pca init` puede inicializar un proyecto con `vectorStoreId: "local-only"` cuando no hay sesion PCA ni OpenAI key.

### BYOK

Estado: implementado y probado.

Permite guardar una API key de OpenAI en credenciales globales PCA.

Comandos principales:

- `pca setup --mode byok --api-key <key>`
- `pca config set openai-api-key`
- `pca config get openai-api-key`
- `pca config clear openai-api-key`

El sistema puede migrar una key encontrada en `.env` del proyecto hacia credenciales globales, sin borrarla automaticamente en modo no interactivo.

### Cloud

Estado: parcialmente implementado.

El CLI soporta configuracion de backend auth y sesion local:

- `pca config set auth-base-url <url>`
- `pca login`
- `pca logout`
- `pca whoami`
- `pca doctor`

La autenticacion cloud requiere un backend PCA hospedado. El CLI no incluye secretos de Clerk ni opera como backend cloud completo por si solo.

## Memoria local

`pca init` crea la estructura base de memoria:

- `PCA_INDEX.md`
- `AGENTS.md`
- `README.md`, si no existe
- `pca/prd/`
- `pca/decisions/`
- `pca/visual/screenshots/`
- `pca/visual/mockups/`
- `pca/visual/references/`
- `pca/visual/generated/`
- `.pca/config.json`

`pca commit` registra eventos locales en:

```txt
.pca/context-commits.json
```

Tipos soportados:

- `decision`
- `feature`
- `bugfix`
- `architecture`
- `product`
- `general`

`pca logs` lista estos eventos, con filtros por tipo y limite.

## RAG y Vector Stores

Estado: implementado a nivel CLI, dependiente de credenciales.

`pca sync`:

- Requiere sesion PCA.
- Requiere OpenAI API key valida.
- Lee archivos Markdown sincronizables.
- Los sube a OpenAI Files.
- Los adjunta a un OpenAI Vector Store.
- Registra resultado en `pca/rag/sync-log.md`.

`pca query`:

- Requiere sesion PCA.
- Requiere OpenAI API key valida.
- Busca en el Vector Store configurado.
- Devuelve resultados formateados.

`pca task`:

- Clasifica la tarea.
- Recupera contexto via Vector Store.
- Genera un contexto compacto.
- Guarda el resultado en `.pca/last-task-context.md`.

Restriccion importante: la capa RAG todavia depende de OpenAI Vector Stores y de auth activa. El modo local-only no tiene busqueda semantica offline.

## Memoria visual

Estado: MVP implementado.

`pca visual add <image> --type <type> --note <note>`:

- Copia la imagen a `pca/visual/...`.
- Agrega metadata textual en `pca/visual/visual-index.md`.
- La imagen no se indexa multimodalmente en esta version.
- La metadata entra al RAG despues de `pca sync`.

Tipos soportados:

- `reference`
- `screenshot`
- `mockup`
- `generated`
- `bug`

## Cierre de tareas

Estado: implementado con confirmacion manual.

`pca close`:

- Requiere proyecto configurado.
- Requiere sesion PCA.
- Busca `.pca/last-task-context.md`.
- Pide confirmacion explicita del usuario.
- Escribe cambios en:
  - `pca/state/changelog.md`
  - `pca/state/roadmap.md`
  - `pca/rag/sync-log.md`

## Diagnostico y readiness

Estado: implementado y probado.

`pca doctor`, `pca whoami` y `pca config` muestran:

- Version de Node.
- Version de PCA.
- Ruta de `PCA_HOME`.
- Estado de auth.
- Estado de OpenAI/BYOK.
- Estado de proyecto local.
- Estado de Vector Store.
- Modo derivado: `local-only`, `byok`, `cloud` o `partial`.

El modelo de readiness esta cubierto por tests para estados vacios, locales, BYOK, cloud y parciales.

## Backend `pca-auth`

Estado: scaffold funcional para hosted auth bridge.

Stack:

- Next.js `16.2.6`
- React `19.2.1`
- Clerk
- Upstash Redis

Flujo previsto:

```txt
pca login
-> CLI abre login browser
-> usuario autentica via Clerk
-> backend guarda one-time code en Redis
-> browser vuelve al callback local del CLI
-> CLI intercambia code por session token
-> CLI guarda ~/.pca/auth.json
```

Variables necesarias:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PCA_CLI_SESSION_SECRET`

No hay evidencia en este repo de dashboard, billing o gestion multiusuario completa.

## Persistencia y secretos

Configuracion global:

```txt
~/.pca/config.json
~/.pca/auth.json
~/.pca/secrets.json
```

Configuracion del proyecto:

```txt
.pca/config.json
```

El diseno separa:

- Sesion PCA cloud.
- OpenAI API key/BYOK.
- Configuracion local del proyecto.

Los secretos no se guardan en archivos del proyecto.

## Calidad y pruebas

Comando verificado:

```powershell
npm.cmd test
```

Resultado:

```txt
27 tests passed
0 failed
```

La suite cubre:

- Routing de comandos.
- Config global.
- Resolucion de rutas bajo `PCA_HOME`.
- Readiness por modo.
- `doctor`, `whoami`, `config`.
- Login/logout auth-only.
- Setup local-only, BYOK y cloud.
- Status local.
- Init offline.
- Context commits.
- Logs y errores de JSON corrupto.

Nota Windows: `npm test` puede fallar en PowerShell por ExecutionPolicy bloqueando `npm.ps1`. Usar `npm.cmd test`.

## Limitaciones actuales

- No hay dashboard web.
- No hay billing.
- No hay multiusuario o sharing de proyectos.
- No hay deduplicacion/reemplazo avanzado de archivos en Vector Store.
- No hay busqueda semantica offline para modo local-only.
- La memoria visual es textual; no hay analisis multimodal real.
- El cloud auth requiere desplegar `pca-auth` con Clerk, Redis y secretos.
- Los secretos OpenAI se guardan en `~/.pca/secrets.json`; integracion con keychain queda pendiente.
- `pca sync`, `pca query`, `pca task`, `pca visual add` y `pca close` aun dependen de sesion PCA activa.

## Estado git observado

Antes de crear este documento, la rama estaba limpia:

```txt
main...origin/main
```

Este archivo agrega documentacion nueva y no modifica codigo de runtime.

## Proximos pasos recomendados

1. Decidir si `local-only` debe tener RAG offline real.
2. Definir si comandos como `visual add` y `close` deben funcionar sin sesion cloud.
3. Implementar deduplicacion/replacement en Vector Store.
4. Agregar tests para `sync`, `query`, `task`, `visual add` y `close` con mocks mas completos.
5. Desplegar y validar `pca-auth` en Vercel con Clerk y Upstash.
6. Reemplazar almacenamiento plano de secretos por keychain del sistema operativo.
7. Corregir textos con encoding roto observados en algunos prompts/documentos (`¿`, flechas, `sí`) si aparecen en terminal.
