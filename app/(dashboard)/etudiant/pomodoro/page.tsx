'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  addDoc, serverTimestamp, query, orderBy, limit,
  getDocs, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users, MessageSquare, Send, LogOut, Sparkles, Map,
  Clock, Target, CheckCircle2, Loader2,
} from 'lucide-react';

// ─── Timer déterministe (partagé par tous) ────────────────────────────────────
const TRAVAIL_MS = 40 * 60 * 1000;   // 40 min
const PAUSE_MS   = 10 * 60 * 1000;   // 10 min
const CYCLE_MS   = TRAVAIL_MS + PAUSE_MS;

// Référence fixe : les cycles tournent 24/7 à partir de cette date
const EPOCH = new Date('2025-01-01T00:00:00Z').getTime();

function getPhaseInfo() {
  const elapsed = (Date.now() - EPOCH) % CYCLE_MS;
  const cycleNumber = Math.floor((Date.now() - EPOCH) / CYCLE_MS);
  if (elapsed < TRAVAIL_MS) {
    return { phase: 'travail' as const, remaining: TRAVAIL_MS - elapsed, cycleNumber };
  }
  return { phase: 'pause' as const, remaining: CYCLE_MS - elapsed, cycleNumber };
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Participant {
  uid: string;
  displayName: string;
  objectif: string;
  joinedCycle: number;
  cycleCount: number;
  lastActive: number;  // timestamp ms
  bilan?: string;
  continuer?: boolean;
}

interface ChatMessage {
  id: string;
  uid: string;
  displayName: string;
  texte: string;
  createdAt: unknown;
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function PomodoroPage() {
  const { user, profile } = useAuth();

  // Timer
  const [phaseInfo, setPhaseInfo] = useState(getPhaseInfo());
  const prevCycleRef = useRef(phaseInfo.cycleNumber);
  const prevPhaseRef = useRef(phaseInfo.phase);

  // Participation
  const [participe, setParticipe] = useState(false);
  const [objectif, setObjectif] = useState('');
  const [objectifSaisi, setObjectifSaisi] = useState('');

  // Bilan de fin de session
  const [showBilan, setShowBilan] = useState(false);
  const [bilanTexte, setBilanTexte] = useState('');
  const [bilanIA, setBilanIA] = useState('');
  const [chargementIA, setChargementIA] = useState(false);

  // Continuation après 3 cycles
  const [showContinuer, setShowContinuer] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);

  // Participants en temps réel
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Heartbeat
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const displayName = profile
    ? profile.pseudo || `${profile.prenom} ${profile.nom}`.trim()
    : user?.email ?? 'Inconnu';

  // ── Tick timer chaque seconde ──────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const info = getPhaseInfo();
      setPhaseInfo(info);

      // Transition travail → pause : déclencher bilan si on participe
      if (
        prevPhaseRef.current === 'travail' &&
        info.phase === 'pause' &&
        participe
      ) {
        setShowBilan(true);
        const newCount = cycleCount + 1;
        setCycleCount(newCount);
        if (newCount > 0 && newCount % 3 === 0) setShowContinuer(true);
        if (user) {
          updateDoc(doc(db, 'pomodoro_participants', user.uid), {
            cycleCount: newCount,
            lastActive: Date.now(),
          }).catch(() => {});
        }
      }
      prevPhaseRef.current = info.phase;
      prevCycleRef.current = info.cycleNumber;
    }, 1000);
    return () => clearInterval(id);
  }, [participe, cycleCount, user]);

  // ── Participants (onSnapshot) ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pomodoro_participants'), (snap) => {
      const now = Date.now();
      const actifs = snap.docs
        .map((d) => d.data() as Participant)
        .filter((p) => now - p.lastActive < 3 * 60 * 1000); // actif dans les 3 dernières min
      setParticipants(actifs);
    });
    return unsub;
  }, []);

  // ── Messages chat (onSnapshot) ─────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'pomodoro_chat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.reverse().map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>) }))
      );
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return unsub;
  }, []);

  // ── Heartbeat (toutes les 60s) ─────────────────────────────────────────────
  const sendHeartbeat = useCallback(() => {
    if (!user || !participe) return;
    updateDoc(doc(db, 'pomodoro_participants', user.uid), {
      lastActive: Date.now(),
    }).catch(() => {});
  }, [user, participe]);

  useEffect(() => {
    if (participe) {
      heartbeatRef.current = setInterval(sendHeartbeat, 60_000);
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [participe, sendHeartbeat]);

  // ── Vérifier si déjà participant (refresh page) ────────────────────────────
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, 'pomodoro_participants')).then((snap) => {
      const me = snap.docs.find((d) => d.id === user.uid);
      if (me) {
        const data = me.data() as Participant;
        setParticipe(true);
        setObjectif(data.objectif);
        setCycleCount(data.cycleCount ?? 0);
      }
    });
  }, [user]);

  // ── Rejoindre le Pomodoro ──────────────────────────────────────────────────
  async function rejoindre(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !objectifSaisi.trim()) return;
    const info = getPhaseInfo();
    await setDoc(doc(db, 'pomodoro_participants', user.uid), {
      uid: user.uid,
      displayName,
      objectif: objectifSaisi,
      joinedCycle: info.cycleNumber,
      cycleCount: 0,
      lastActive: Date.now(),
      continuer: true,
    });
    setObjectif(objectifSaisi);
    setParticipe(true);
  }

  // ── Quitter le Pomodoro ────────────────────────────────────────────────────
  async function quitter() {
    if (!user) return;
    await deleteDoc(doc(db, 'pomodoro_participants', user.uid));
    setParticipe(false);
    setObjectif('');
    setCycleCount(0);
    setShowBilan(false);
    setBilanTexte('');
    setBilanIA('');
  }

  // ── Soumettre bilan ────────────────────────────────────────────────────────
  async function soumettresBilan() {
    if (!user) return;
    await updateDoc(doc(db, 'pomodoro_participants', user.uid), {
      bilan: bilanTexte,
      lastActive: Date.now(),
    });
    setShowBilan(false);
  }

  async function genererBilanIA() {
    setChargementIA(true);
    try {
      const res = await fetch('/api/ai/bilan-pomodoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectif, accomplissements: bilanTexte, blocages: '' }),
      });
      const data = await res.json();
      setBilanIA(data.bilan);
    } catch {
      setBilanIA("Impossible de générer le bilan.");
    } finally {
      setChargementIA(false);
    }
  }

  // ── Répondre à la question "continuer ?" ──────────────────────────────────
  async function repondreContinu(continuer: boolean) {
    if (!user) return;
    if (!continuer) {
      await quitter();
    } else {
      await updateDoc(doc(db, 'pomodoro_participants', user.uid), { continuer: true });
    }
    setShowContinuer(false);
  }

  // ── Envoyer un message chat ────────────────────────────────────────────────
  async function envoyerMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !msgInput.trim() || phaseInfo.phase !== 'pause') return;
    await addDoc(collection(db, 'pomodoro_chat'), {
      uid: user.uid,
      displayName,
      texte: msgInput.trim(),
      createdAt: serverTimestamp(),
    });
    setMsgInput('');
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────
  const progression = phaseInfo.phase === 'travail'
    ? 1 - phaseInfo.remaining / TRAVAIL_MS
    : 1 - phaseInfo.remaining / PAUSE_MS;
  const circonference = 2 * Math.PI * 90;
  const activeCount = participants.length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pomodoro Collaboratif</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Synchronisé pour tous · {activeCount} participant{activeCount !== 1 ? 's' : ''} actif{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showChat ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat{phaseInfo.phase === 'pause' ? ' (actif)' : ' (pause)'}
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${showChat ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'}`}>
        {/* Colonne principale */}
        <div className="space-y-6">
          {/* Timer */}
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <div className="flex flex-col items-center">
              {/* Badge phase */}
              <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4 ${
                phaseInfo.phase === 'travail'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-green-50 text-green-600'
              }`}>
                {phaseInfo.phase === 'travail' ? '🎯 Travail — 40 min' : '☕ Pause — 10 min'}
              </span>

              <div className="relative w-52 h-52 mb-6">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="90" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                  <circle
                    cx="100" cy="100" r="90" fill="none"
                    stroke={phaseInfo.phase === 'travail' ? '#6366f1' : '#22c55e'}
                    strokeWidth="10"
                    strokeDasharray={circonference}
                    strokeDashoffset={circonference * (1 - progression)}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900 tabular-nums">
                    {fmt(phaseInfo.remaining)}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    Cycle #{phaseInfo.cycleNumber + 1}
                  </span>
                </div>
              </div>

              {/* Objectif en cours */}
              {participe && objectif && (
                <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-sm text-indigo-700">
                  <Target className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate max-w-xs">{objectif}</span>
                </div>
              )}
            </div>
          </div>

          {/* Formulaire pour rejoindre */}
          {!participe && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-1">Rejoindre la session</h2>
              <p className="text-sm text-gray-500 mb-4">
                Définissez votre objectif pour cette session Pomodoro.
              </p>
              <form onSubmit={rejoindre} className="flex gap-2">
                <input
                  type="text"
                  value={objectifSaisi}
                  onChange={(e) => setObjectifSaisi(e.target.value)}
                  required
                  placeholder="Ex : Rédiger la section 2.3 de l'intro"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Participer
                </button>
              </form>
            </div>
          )}

          {/* Bilan de fin de session */}
          {showBilan && (
            <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h2 className="font-semibold text-gray-900">Session terminée — Bilan</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Objectif était : <span className="font-medium text-gray-700">{objectif}</span>
              </p>
              <textarea
                value={bilanTexte}
                onChange={(e) => setBilanTexte(e.target.value)}
                rows={3}
                placeholder="Ce que j'ai accompli... et ce qu'il reste à faire."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={genererBilanIA}
                  disabled={chargementIA || !bilanTexte.trim()}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {chargementIA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Analyse IA
                </button>
                <button
                  onClick={soumettresBilan}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Continuer →
                </button>
              </div>
              {bilanIA && (
                <div className="mt-3 bg-indigo-50 rounded-xl p-3 text-sm text-indigo-900 whitespace-pre-line">
                  {bilanIA}
                </div>
              )}
            </div>
          )}

          {/* Demande de continuation après 3 cycles */}
          {showContinuer && !showBilan && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6 shadow-sm">
              <h2 className="font-semibold text-amber-900 mb-1">3 Pomodoros terminés !</h2>
              <p className="text-sm text-amber-700 mb-4">
                Voulez-vous continuer ? C&apos;est une bonne idée de faire une vraie pause.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => repondreContinu(true)}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Continuer
                </button>
                <button
                  onClick={() => repondreContinu(false)}
                  className="border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  Prendre une vraie pause
                </button>
              </div>
            </div>
          )}

          {/* Carte des participants */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Map className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Qui travaille maintenant ?</h2>
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Aucun participant actif — soyez le premier !
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {participants.map((p) => (
                  <div
                    key={p.uid}
                    className={`rounded-xl p-3 border ${
                      p.uid === user?.uid
                        ? 'border-indigo-200 bg-indigo-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${
                        Date.now() - p.lastActive < 90_000 ? 'bg-green-400' : 'bg-yellow-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {p.displayName}
                        {p.uid === user?.uid ? ' (moi)' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{p.objectif}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {p.cycleCount} cycle{p.cycleCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {participe && (
              <button
                onClick={quitter}
                className="mt-4 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Quitter la session
              </button>
            )}
          </div>
        </div>

        {/* Panel chat */}
        {showChat && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[600px]">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-sm text-gray-900">Chat</span>
              {phaseInfo.phase === 'travail' && (
                <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                  Disponible en pause
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.uid === user?.uid ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-xs text-gray-400 mb-0.5">{msg.displayName}</span>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[80%] ${
                    msg.uid === user?.uid
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.texte}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={envoyerMessage} className="px-3 py-3 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                disabled={phaseInfo.phase !== 'pause' || !participe}
                placeholder={
                  phaseInfo.phase !== 'pause'
                    ? 'Chat actif pendant les pauses'
                    : 'Votre message...'
                }
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="submit"
                disabled={phaseInfo.phase !== 'pause' || !participe || !msgInput.trim()}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
