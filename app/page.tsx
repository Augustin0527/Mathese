'use client';

import Link from "next/link";
import { BookOpen, Brain, Timer, Users, TrendingUp, MessageSquare, Presentation } from "lucide-react";
import { useEffect, useRef } from "react";

// ─── Données ─────────────────────────────────────────────────────────────────

const features = [
  {
    icon: BookOpen,
    titre: "Bibliothèque de lectures",
    desc: "Importez vos articles, annotez-les et laissez l'IA les résumer automatiquement.",
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    icon: Brain,
    titre: "Analyse IA de vos chapitres",
    desc: "L'Agent IA analyse votre rédaction et identifie les incohérences et lacunes bibliographiques.",
    color: "bg-violet-100 text-violet-600",
  },
  {
    icon: Timer,
    titre: "Méthode Pomodoro",
    desc: "Travaillez par sessions focalisées avec un bilan intelligent à chaque pause.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: Users,
    titre: "Suivi par votre directeur",
    desc: "Votre directeur reçoit un rapport hebdomadaire automatique et peut commenter vos chapitres.",
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: TrendingUp,
    titre: "Planning & Objectifs",
    desc: "Définissez vos objectifs, planifiez vos étapes et suivez votre progression.",
    color: "bg-amber-100 text-amber-600",
  },
  {
    icon: MessageSquare,
    titre: "Journal de bord",
    desc: "Notez vos avancées quotidiennes et vos blocages pour garder le fil.",
    color: "bg-rose-100 text-rose-600",
  },
  {
    icon: Presentation,
    titre: "Communication académique",
    desc: "Préparez vos présentations avec l'Agent IA, générez un PowerPoint téléchargeable avec slides et notes de discours.",
    color: "bg-cyan-100 text-cyan-600",
  },
];

const equipe = [
  {
    nom: "Équipe MaThèse",
    role: "Fondateurs",
    desc: "Chercheurs passionnés par l'innovation académique et la réussite des doctorants.",
    initiale: "E",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    nom: "Support académique",
    role: "Experts en recherche",
    desc: "Spécialistes en méthodologie de recherche, revue de littérature et rédaction académique.",
    initiale: "S",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    nom: "Développement IA",
    role: "Ingénieurs IA",
    desc: "Développeurs spécialisés dans l'intelligence artificielle appliquée à la recherche académique.",
    initiale: "D",
    gradient: "from-violet-500 to-purple-600",
  },
];

const ateliers = [
  "Revue de littérature systématique",
  "Méthodologie de recherche qualitative & quantitative",
  "Méthodes d'analyse de données (SPSS, R, NVivo)",
  "Rédaction académique et publication",
  "Gestion de projet de thèse",
];

// ─── Composant Nav ────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const formRef = useRef<HTMLFormElement>(null);

  // Éviter le rechargement du formulaire
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert("Merci ! Nous vous recontacterons bientôt.");
    formRef.current?.reset();
  }

  // Smooth-scroll pour le lien "S'inscrire à un événement"
  function goToContact() {
    scrollTo("contact");
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ══ Navigation sticky ══════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => scrollTo("accueil")}
            className="flex items-center gap-2 focus:outline-none"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">MaThèse</span>
          </button>

          {/* Liens de navigation (masqués sur mobile) */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: "Accueil", id: "accueil" },
              { label: "Fonctionnalités", id: "fonctionnalites" },
              { label: "Équipe", id: "equipe" },
              { label: "Événements", id: "evenements" },
              { label: "Nous contacter", id: "contact" },
            ].map((lien) => (
              <button
                key={lien.id}
                onClick={() => scrollTo(lien.id)}
                className="text-sm text-gray-600 hover:text-indigo-600 transition-colors font-medium"
              >
                {lien.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/connexion"
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ Hero ═══════════════════════════════════════════════════════════════ */}
      <section id="accueil" className="relative text-center py-28 px-6 max-w-5xl mx-auto overflow-hidden">
        {/* Décoration de fond */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-violet-100/50 rounded-full blur-3xl" />
        </div>

        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8 border border-indigo-100">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          Propulsé par le consortium SFR-D, Africitizen &amp; École au Bénin
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Rédigez votre thèse avec{" "}
          <span className="text-indigo-600">méthode et sérénité</span>
        </h1>

        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          MaThèse centralise votre bibliographie, votre planning, votre rédaction et
          votre communication avec votre directeur — avec l&apos;intelligence artificielle comme copilote.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/inscription"
            className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
          >
            Démarrer maintenant
          </Link>
          <Link
            href="/connexion"
            className="w-full sm:w-auto border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl text-base font-medium hover:bg-gray-50 transition-colors"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>

        {/* Indicateurs de confiance */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-gray-400">
          <span>✓ Sans carte bancaire</span>
          <span>✓ Accès immédiat</span>
          <span>✓ Support inclus</span>
        </div>
      </section>

      {/* ══ Fonctionnalités ════════════════════════════════════════════════════ */}
      <section id="fonctionnalites" className="bg-gray-50 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Fonctionnalités</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Des outils pensés pour les doctorants, de la première idée à la soutenance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.titre}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-11 h-11 ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.titre}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Équipe ═════════════════════════════════════════════════════════════ */}
      <section id="equipe" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Notre équipe</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              Des experts à votre service
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Une équipe pluridisciplinaire dédiée à la réussite des doctorants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {equipe.map((membre) => (
              <div
                key={membre.nom}
                className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
              >
                {/* Avatar initiale */}
                <div className={`w-16 h-16 bg-gradient-to-br ${membre.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md`}>
                  <span className="text-white text-2xl font-bold">{membre.initiale}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-0.5">{membre.nom}</h3>
                <p className="text-indigo-600 text-sm font-medium mb-3">{membre.role}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{membre.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Événements ═════════════════════════════════════════════════════════ */}
      <section id="evenements" className="bg-gray-50 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Événements</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              Ateliers & Retraites de rédaction
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Des espaces d&apos;apprentissage et d&apos;immersion pour accélérer votre thèse.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Ateliers de renforcement */}
            <div className="rounded-3xl p-7 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-5">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-1">Ateliers de renforcement de capacités</h3>
              <p className="text-indigo-200 text-sm mb-6">
                Formations pratiques animées par des experts pour maîtriser les outils essentiels du doctorat.
              </p>
              <ul className="space-y-3">
                {ateliers.map((atelier) => (
                  <li key={atelier} className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-white font-bold">✓</span>
                    </span>
                    <span className="text-sm text-indigo-100">{atelier}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Retraites de rédaction */}
            <div className="rounded-3xl p-7 bg-gradient-to-br from-violet-600 to-purple-800 text-white shadow-lg">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-5">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-1">Retraites de rédaction</h3>
              <p className="text-violet-200 text-sm mb-6">
                Immersion complète pour avancer sur votre thèse dans un cadre propice. Salle équipée d&apos;une connexion
                internet haut débit, pauses café et déjeuner inclus.
              </p>
              <div className="space-y-3">
                {[
                  { emoji: "📶", label: "Connexion internet haut débit" },
                  { emoji: "☕", label: "Pauses café & déjeuner" },
                  { emoji: "🤝", label: "Accompagnement personnalisé" },
                  { emoji: "✍️", label: "Sessions de rédaction guidées" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-lg">{item.emoji}</span>
                    <span className="text-sm text-violet-100">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA événements */}
          <div className="text-center mt-10">
            <button
              onClick={goToContact}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
            >
              S&apos;inscrire à un événement
            </button>
          </div>
        </div>
      </section>

      {/* ══ Contact ════════════════════════════════════════════════════════════ */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-wider">Contact</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2">
              Nous contacter
            </h2>
            <p className="text-gray-500 mt-3">
              Une question ? Une inscription ? Écrivez-nous !
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            {/* Email info */}
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
              <span className="text-indigo-500 text-lg">✉️</span>
              <div>
                <p className="text-xs text-indigo-600 font-medium">Email de contact</p>
                <a href="mailto:contact@mathese.org" className="text-sm font-semibold text-indigo-800 hover:underline">
                  contact@mathese.org
                </a>
              </div>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    placeholder="Votre nom"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="votre@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type de demande</label>
                <select
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="">Sélectionnez une option</option>
                  <option value="atelier">Atelier</option>
                  <option value="retraite">Retraite de rédaction</option>
                  <option value="general">Question générale</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Votre message..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
              >
                Envoyer le message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ══ Footer ══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © 2025 MaThèse · Tous droits réservés
      </footer>
    </div>
  );
}
