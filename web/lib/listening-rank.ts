/** Cómo se arma el orden «Prioridad» del inbox. Pesos en `rankScore`. */
export const RANKING_STEPS = [
  {
    id: 'original',
    title: 'Original antes que RT',
    body: 'El hilo canónico gana si el texto no empieza con RT @. Los reprints se agrupan con reprintKey.',
  },
  {
    id: 'tono',
    title: 'Tono negativo',
    body: 'classifications.sentimiento < 0 suma más. YouTube no aporta tono (mención exacta).',
  },
  {
    id: 'urgencia',
    title: 'Urgencia',
    body: 'classifications.urgencia × 8.000. El chip «Urgencia 3» recorta el feed y los KPIs.',
  },
  {
    id: 'seguidores',
    title: 'Seguidores',
    body: 'author_meta.followers cuando el colector los trajo, con tope 400.000.',
  },
  {
    id: 'alcance',
    title: 'Alcance del hilo',
    body: 'Suma de reach_score de todos los reprints del grupo × 40.',
  },
  {
    id: 'visto',
    title: 'Veces visto',
    body: 'Tamaño del grupo reprintKey, tope 50. No es un conteo de impresiones de la red.',
  },
] as const;
