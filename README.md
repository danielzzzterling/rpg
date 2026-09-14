# PushUp RPG

Contador de push-ups con la cámara del teléfono, con sistema RPG liviano: cada push-up pega daño a un monstruo y suma XP. Los push-ups a una mano dan doble XP. Todo se guarda localmente en el teléfono (localStorage), sin servidor.

## Correr en local

```sh
npm install
npm run dev
```

Abrir en el teléfono: la app usa la cámara, así que sirve mejor en HTTPS o en un navegador del teléfono. Para probar contra un iPhone en la misma red: `npm run dev -- --host`.

## Chequeo del detector (tests, sin framework)

```sh
npm run check
```

## Deploy a GitHub Pages

1. Crea el repo en GitHub y súbelo a la rama `main`.
2. En *Settings → Pages*, elige GitHub Actions como fuente.
3. Cada push publica automáticamente (ver `.github/workflows/deploy.yml`).

La app queda en `https://<usuario>.github.io/<repo>/`. Ábrela en Safari del iPhone y usa "Añadir a pantalla de inicio" para modo standalone.

## Uso

- Apoya el teléfono donde se vea tu cuerpo completo de lado.
- `ADENTRO` inicia la cuenta. Cada push-up pega 1 de daño al monstruo (2 si es a una mano).
- El detector usa el ángulo hombro-codo-muñeca (arriba >160°, abajo <90°) y la separación vertical de muñecas para detectar la mano suelta.

## Calibración

Los umbrales viven en `src/config.ts`. Si la cámara lateral no cuenta bien, ajusta `ANGLE_UP`, `ANGLE_DOWN` y `ONE_HAND_GAP`. Marcado en el código como `ponytail:` con su techo y upgrade path.