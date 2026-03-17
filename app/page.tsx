import Link from "next/link";
import { BookOpen, Brain, Timer, Users, TrendingUp, MessageSquare } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    titre: "Bibliothèque de lectures",
    desc: "Importez vos articles, annotez-les et laissez l'IA les résumer automatiquement.",
  },
  {
    icon: Brain,
    titre: "Analyse IA de vos chapitres",
    desc: "Claude analyse votre rédaction et identifie les incohérences et lacunes bibliographiques.",
  },
  {
    icon: Timer,
    titre: "Méthode Pomodoro",
    desc: "Travaillez par sessions focalisées avec un bilan intelligent à chaque pause.",
  },
  {
    icon: Users,
    titre: "Suivi par votre directeur",
    desc: "Votre directeur reçoit un rapport hebdomadaire automatique et peut commenter vos chapitres.",
  },
  {
    icon: TrendingUp,
    titre: "Planning & Objectifs",
    desc: "Définissez vos objectifs, planifiez vos étapes et suivez votre progression.",
  },
  {
    icon: MessageSquare,
    titre: "Journal de bord",
    desc: "Notez vos avancées quotidiennes et vos blocages pour garder le fil.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="font-semibold text-gray-900 text-lg">MaThèse</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/connexion" className="text-sm text-gray-600 hover:text-gray-900">
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Commencer gratuitement
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center py-24 px-6 max-w-4xl mx-auto">
        <div className="inline-block bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          Propulsé par l&apos;IA Claude
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Rédigez votre thèse avec{" "}
          <span className="text-indigo-600">méthode et sérénité</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          MaThèse centralise votre bibliographie, votre planning, votre rédaction et
          votre communication avec votre directeur — avec l&apos;intelligence artificielle comme copilote.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/inscription"
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-base font-medium hover:bg-indigo-700 transition-colors"
          >
            Démarrer maintenant
          </Link>
          <Link
            href="/connexion"
            className="border border-gray-200 text-gray-700 px-8 py-3 rounded-xl text-base font-medium hover:bg-gray-50 transition-colors"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Tout ce dont vous avez besoin
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.titre} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.titre}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} MaThèse · mathese.sikaflow.org · Propulsé par SikaFlow
      </footer>
    </div>
  );
}
