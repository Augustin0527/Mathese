import Anthropic from '@anthropic-ai/sdk';

// Ce client s'utilise uniquement côté serveur (API routes)
export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = 'claude-sonnet-4-6';

// ── Résumé d'article ────────────────────────────────────────
export async function resumeArticle(titre: string, contenu: string): Promise<string> {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Tu es un assistant académique. Résume cet article en 5 points clés en français, de façon concise et structurée.

Titre : ${titre}

Contenu :
${contenu}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

// ── Analyse d'un chapitre ────────────────────────────────────
export async function analyserChapitre(
  sujetThese: string,
  titreChapitre: string,
  contenu: string
): Promise<string> {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `Tu es un directeur de thèse expérimenté. Analyse ce chapitre de thèse et identifie :
1. Les points forts
2. Les faiblesses ou incohérences argumentatives
3. Les manques bibliographiques potentiels
4. Des suggestions d'amélioration concrètes

Sujet de la thèse : ${sujetThese}
Chapitre : ${titreChapitre}

Contenu :
${contenu}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

// ── Bilan de session Pomodoro ────────────────────────────────
export async function bilanPomodoro(
  objectif: string,
  accomplissements: string,
  blocages: string
): Promise<string> {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Tu es un coach académique bienveillant. L'étudiant vient de terminer une session de travail.

Objectif de la session : ${objectif}
Ce qu'il a accompli : ${accomplissements}
Blocages rencontrés : ${blocages || 'Aucun'}

Donne-lui un retour encourageant et une suggestion concrète pour la prochaine session. En 3-4 phrases maximum.`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

// ── Traduction en français ───────────────────────────────────
export async function traduireEnFrancais(texte: string): Promise<string> {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Traduis ce texte académique en français. Réponds uniquement avec la traduction, sans commentaire.\n\n${texte}`,
      },
    ],
  });
  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

// ── Rapport hebdomadaire pour le directeur ──────────────────
export async function rapportHebdomadaire(
  nomEtudiant: string,
  journaux: { date: string; accomplissements: string; blocages?: string }[]
): Promise<string> {
  const journauxTexte = journaux
    .map((j) => `${j.date} : ${j.accomplissements}${j.blocages ? ` (Blocages: ${j.blocages})` : ''}`)
    .join('\n');

  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `Génère un rapport hebdomadaire synthétique pour le directeur de thèse concernant l'étudiant ${nomEtudiant}.

Entrées de journal de la semaine :
${journauxTexte}

Le rapport doit inclure : résumé des avancées, points de blocage, et recommandations pour la prochaine semaine.`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}
