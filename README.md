# NEXO — Subastas en línea

NEXO es una plataforma para explorar y participar en subastas de productos y servicios.

- **Sitio oficial:** https://nexosubastas.com
- **Catálogo:** https://nexosubastas.com/subastas
- **Idioma principal:** español

## Desarrollo

Este repositorio contiene el código fuente de NEXO. El proyecto está conectado a Lovable; los cambios enviados a la rama conectada pueden sincronizarse con el editor. Mantén los commits pequeños y evita reescribir el historial publicado.

Requisitos: Bun o Node.js compatible con la versión de Vite del proyecto.

```sh
git clone https://github.com/systemaiveta-source/nexosubasta.git
cd nexosubasta
bun install
bun run dev
```

## Comprobaciones

```sh
bun run lint
bun run test
bun run build
```

No despliegues desde esta rama de trabajo. Integra los cambios mediante revisión antes de incorporarlos a `main`.
