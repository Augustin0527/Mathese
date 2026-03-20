'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import {
  Send, Loader2, Sparkles, BookOpen, ExternalLink,
  Plus, CheckCircle2, Copy, Check, FileSearch, FileDown,
  MessageSquarePlus, Trash2, Pencil, X, ChevronLeft, ChevronRight,
  MessagesSquare, RefreshCw, AlertCircle, ChevronDown,
} from 'lucide-react';

// ─── Modèles IA disponibles ───────────────────────────────────────────────────

const AI_MODELS = [
  { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash', desc: 'Rapide · Économique',     color: 'text-blue-600' },
  { id: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash', desc: 'Stable · Gratuit',        color: 'text-sky-600' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku', desc: 'Ultra-rapide · Léger',    color: 'text-emerald-600' },
  { id: 'claude-sonnet-4-6',     label: 'Claude Sonnet',    desc: 'Équilibré · Précis',      color: 'text-violet-600' },
  { id: 'claude-opus-4-6',       label: 'Claude Opus',      desc: 'Très puissant · Lent',    color: 'text-purple-700' },
] as const;

type ModelId = (typeof AI_MODELS)[number]['id'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleBiblio {
  id: string;
  titre: string;
  auteurs?: string[];
  annee?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
}

interface ArticleCrossRef {
  titre: string;
  auteurs: string;
  annee: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  type: string | null;
  source?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposeWord?: boolean;
  isError?: boolean;
  retryFromMessages?: ChatMessage[];
  wordDoc?: { titre: string; userRequest?: string; articles?: ArticleCrossRef[] };
}

interface Conversation {
  id: string;
  titre: string;
  created_at: string;
  updated_at: string;
}

// ─── Composant table avec copie ───────────────────────────────────────────────

// ─── Widget de téléchargement Word ───────────────────────────────────────────

function WordDocWidget({ titre, userRequest, articles, auteur, sujet }: {
  titre: string;
  userRequest?: string;
  articles?: ArticleCrossRef[];
  auteur?: string;
  sujet?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const filenameRef = useRef(
    (titre.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'document') + '.docx'
  );

  useEffect(() => {
    let url: string | null = null;
    fetch('/api/ai/generate-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre, userRequest, articles, sujetThese: sujet, auteur }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));

    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Génération du document Word...</p>
          <p className="text-xs text-gray-400">{titre}</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-red-500 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Erreur lors de la génération du document. Réessayez.
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileDown className="w-5 h-5 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">Document Word prêt</p>
          <p className="text-xs text-gray-400 truncate">{titre}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <a
          href={downloadUrl!}
          download={filenameRef.current}
          className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-medium transition-colors shadow-sm"
        >
          <FileDown className="w-4 h-4" />
          Télécharger (.docx)
        </a>
        <a
          href={downloadUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ouvrir
        </a>
      </div>
    </div>
  );
}

// ─── Composant table avec copie ───────────────────────────────────────────────

function CopyableTable({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  function copyTable() {
    if (!tableRef.current) return;
    const rows = Array.from(tableRef.current.querySelectorAll('tr'));
    const text = rows
      .map((row) =>
        Array.from(row.querySelectorAll('th, td'))
          .map((cell) => cell.textContent?.trim() ?? '')
          .join('\t')
      )
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative my-4 group">
      <button
        onClick={copyTable}
        className="absolute -top-2 right-0 z-10 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-300 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title="Copier le tableau"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copié !' : 'Copier'}
      </button>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table ref={tableRef} className="w-full text-sm border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}

// ─── Composant markdown riche ─────────────────────────────────────────────────

function MarkdownMessage({ content }: { content: string }) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-base font-bold text-gray-900 mt-5 mb-2 pb-1 border-b border-gray-100">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-sm font-bold text-gray-900 mt-4 mb-2 flex items-center gap-2">
        <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block flex-shrink-0" />
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1.5">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-sm text-gray-800 leading-relaxed my-2">{children}</p>
    ),
    ul: ({ children }) => <ul className="my-2 space-y-1.5 pl-1">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 space-y-1.5 pl-1 list-decimal list-inside">{children}</ol>,
    li: ({ children }) => (
      <li className="text-sm text-gray-800 leading-relaxed flex items-start gap-2">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
        <span>{children}</span>
      </li>
    ),
    code: ({ className, children, ...props }) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return <code className="block w-full text-xs text-indigo-800 font-mono leading-relaxed whitespace-pre-wrap">{children}</code>;
      }
      return <code className="text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono" {...props}>{children}</code>;
    },
    pre: ({ children }) => (
      <pre className="my-3 bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto border border-gray-700 leading-relaxed">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-indigo-400 bg-indigo-50 pl-4 pr-3 py-2 rounded-r-xl text-sm text-indigo-800 italic">{children}</blockquote>
    ),
    hr: () => <hr className="my-4 border-gray-100" />,
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors">{children}</a>
    ),
    table: ({ children }) => <CopyableTable>{children}</CopyableTable>,
    thead: ({ children }) => <thead className="bg-indigo-600 text-white">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-gray-100">{children}</tbody>,
    tr: ({ children }) => <tr className="hover:bg-indigo-50/40 transition-colors">{children}</tr>,
    th: ({ children }) => (
      <th className="text-left text-xs font-semibold px-4 py-2.5 border-r border-indigo-500 last:border-r-0 whitespace-nowrap">{children}</th>
    ),
    td: ({ children }) => (
      <td className="text-sm text-gray-700 px-4 py-2.5 border-r border-gray-100 last:border-r-0 align-top leading-relaxed">{children}</td>
    ),
  };

  return (
    <div className="min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function RecherchePage() {
  const { user, profile } = useAuth();

  // ── Bibliothèque ──
  const [biblioExistante, setBiblioExistante] = useState<ArticleBiblio[]>([]);

  // ── Conversations (historique) ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Chat ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [exportingWord, setExportingWord] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Édition de message ──
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // ── Résultats IA ──
  const [articlesIA, setArticlesIA] = useState<ArticleCrossRef[]>([]);
  const [ajoutesIA, setAjoutesIA] = useState<Set<number>>(new Set());
  const [searchingStatus, setSearchingStatus] = useState<string | null>(null);

  // ── Sélecteur de modèle ──
  const [selectedModel, setSelectedModel] = useState<ModelId>('claude-sonnet-4-6');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mathese_model') as ModelId | null;
    if (saved && AI_MODELS.some((m) => m.id === saved)) setSelectedModel(saved);
  }, []);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const close = () => setModelMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [modelMenuOpen]);

  function changeModel(id: ModelId) {
    setSelectedModel(id);
    localStorage.setItem('mathese_model', id);
    setModelMenuOpen(false);
  }


  // ─── Chargements initiaux ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from('articles').select('id, titre, auteurs, annee, doi, abstract, notes')
      .eq('user_id', user.id)
      .then(({ data }) => { if (data) setBiblioExistante(data as ArticleBiblio[]); });
    loadConversations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Chargement de la liste des conversations ────────────────────────────
  async function loadConversations() {
    if (!user) return;
    const { data } = await supabase
      .from('conversations')
      .select('id, titre, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (data) setConversations(data as Conversation[]);
  }

  // ─── Charger une conversation existante ─────────────────────────────────
  async function ouvrirConversation(convId: string) {
    if (chatLoading) return;
    setCurrentConvId(convId);
    setArticlesIA([]);
    setAjoutesIA(new Set());
    const { data } = await supabase
      .from('conversation_messages')
      .select('role, content, propose_word')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data.map((m) => {
        // Décoder les infos du document Word si présentes
        const wdMatch = m.content.match(/\n\n__WD__(.+)$/s);
        const wordDoc = wdMatch ? (() => { try { return JSON.parse(wdMatch[1]); } catch { return undefined; } })() : undefined;
        const displayContent = m.content.replace(/\n\n__WD__.*$/s, '');
        return {
          role: m.role as 'user' | 'assistant',
          content: displayContent,
          proposeWord: m.propose_word ?? false,
          wordDoc,
        };
      }));
    }
  }

  // ─── Nouvelle conversation ───────────────────────────────────────────────
  function nouvelleConversation() {
    setCurrentConvId(null);
    setMessages([]);
    setArticlesIA([]);
    setAjoutesIA(new Set());
    setInput('');
  }

  // ─── Supprimer une conversation ─────────────────────────────────────────
  async function supprimerConversation(convId: string) {
    setDeletingId(convId);
    await supabase.from('conversations').delete().eq('id', convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (currentConvId === convId) {
      setCurrentConvId(null);
      setMessages([]);
    }
    setDeletingId(null);
  }

  // ─── Sauvegarder un message en base ─────────────────────────────────────
  const sauvegarderMessage = useCallback(async (
    convId: string,
    msg: ChatMessage
  ) => {
    // Encoder les infos du document Word dans le contenu pour persistance
    const contentToSave = msg.wordDoc
      ? msg.content + '\n\n__WD__' + JSON.stringify({ titre: msg.wordDoc.titre, userRequest: msg.wordDoc.userRequest })
      : msg.content;
    await supabase.from('conversation_messages').insert({
      conversation_id: convId,
      role: msg.role,
      content: contentToSave,
      propose_word: msg.proposeWord ?? false,
    });
    await supabase.from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);
  }, []);

  // ─── Envoi d'un message ──────────────────────────────────────────────────
  async function envoyerMessage(inputOverride?: string, messagesOverride?: ChatMessage[]) {
    const texte = (inputOverride ?? input).trim();
    if (!texte || chatLoading) return;

    const baseMessages = messagesOverride ?? messages;
    const userMsg: ChatMessage = { role: 'user', content: texte };
    const newMessages: ChatMessage[] = [...baseMessages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    // Créer la conversation en base si elle n'existe pas encore
    let convId = currentConvId;
    if (!convId && user) {
      const titre = texte.slice(0, 70).trim();
      const { data } = await supabase.from('conversations').insert({
        user_id: user.id,
        titre,
      }).select('id').single();
      if (data) {
        convId = data.id;
        setCurrentConvId(convId);
        setConversations((prev) => [{
          id: data.id,
          titre,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, ...prev]);
      }
    }

    // Sauvegarder le message utilisateur
    if (convId) await sauvegarderMessage(convId, userMsg);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages,
          sujetThese: profile?.sujet_recherche ?? '',
          bibliotheque: biblioExistante,
          model: selectedModel,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });

        // Détecter statut de recherche CrossRef
        const statusMatch = fullText.match(/__STATUS__([^_]*)__STATUS_END__/);
        if (statusMatch) {
          setSearchingStatus(statusMatch[1]);
        } else if (searchingStatus) {
          setSearchingStatus(null);
        }

        const separatorIdx = fullText.indexOf('\n\n__SEARCH_RESULTS__');
        const visibleText = (separatorIdx >= 0 ? fullText.slice(0, separatorIdx) : fullText)
          .replace(/\n*__PROPOSE_WORD__\n*/g, '')
          .replace(/__STATUS__[^_]*__STATUS_END__\n?/g, '')
          .replace(/\n*__WORD_DOC__[\s\S]*?__WORD_DOC_END__\n*/g, '');

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: visibleText };
          return updated;
        });
      }

      // Extraire articles
      const separatorIdx = fullText.indexOf('\n\n__SEARCH_RESULTS__');
      if (separatorIdx >= 0) {
        try {
          const articles: ArticleCrossRef[] = JSON.parse(
            fullText.slice(separatorIdx + '\n\n__SEARCH_RESULTS__'.length)
          );
          if (articles.length > 0) { setArticlesIA(articles); setAjoutesIA(new Set()); }
        } catch { /* ignore */ }
      }

      let visibleFinal = (separatorIdx >= 0 ? fullText.slice(0, separatorIdx) : fullText)
        .replace(/__STATUS__[^_]*__STATUS_END__\n?/g, '')
        .replace(/\n*__WORD_DOC__[\s\S]*?__WORD_DOC_END__\n*/g, '')
        .replace(/\n*__WORD_DOC_ERROR__\n*/g, '');

      // Extraire le document Word si présent
      let wordDoc: { titre: string; userRequest?: string; articles?: ArticleCrossRef[] } | undefined;
      const wordDocMatch = fullText.match(/__WORD_DOC__([\s\S]*?)__WORD_DOC_END__/);
      if (wordDocMatch) {
        try {
          const parsed = JSON.parse(wordDocMatch[1]);
          const lastUserMsg = newMessages.filter((m) => m.role === 'user').pop()?.content;
          // Récupérer les articles depuis __SEARCH_RESULTS__ si présent dans ce stream
          let streamArticles: ArticleCrossRef[] = [];
          const searchIdx = fullText.indexOf('\n\n__SEARCH_RESULTS__');
          if (searchIdx >= 0) {
            try { streamArticles = JSON.parse(fullText.slice(searchIdx + '\n\n__SEARCH_RESULTS__'.length)); } catch { /* ignore */ }
          }
          wordDoc = { titre: parsed.titre, userRequest: lastUserMsg, articles: streamArticles };
        } catch { /* ignore */ }
      }

      // Erreur de génération Word (contenu trop court / JSON tronqué)
      if (fullText.includes('__WORD_DOC_ERROR__')) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '⚠️ Le document est trop long pour être généré en une seule fois. Essayez de demander un rapport plus court ou en plusieurs parties.',
            isError: true,
            retryFromMessages: newMessages,
          };
          return updated;
        });
        return;
      }

      // Détecter une erreur serveur signalée dans le stream
      if (visibleFinal.includes('__ERROR__')) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: 'Erreur de connexion.',
          isError: true,
          retryFromMessages: newMessages,
        };
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = errorMsg;
          return updated;
        });
        return;
      }

      visibleFinal = visibleFinal.replace(/\n*__PROPOSE_WORD__\n*/g, '').trim();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: visibleFinal,
        wordDoc,
      };
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = assistantMsg;
        return updated;
      });

      // Sauvegarder la réponse IA
      if (convId) await sauvegarderMessage(convId, assistantMsg);

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: 'Erreur de connexion.',
        isError: true,
        retryFromMessages: newMessages,
      };
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && !last.content) updated[updated.length - 1] = errorMsg;
        else updated.push(errorMsg);
        return updated;
      });
    } finally {
      setChatLoading(false);
      setSearchingStatus(null);
      abortRef.current = null;
    }
  }

  // ─── Édition d'un message utilisateur ────────────────────────────────────
  function commencerEdition(index: number) {
    setEditingIndex(index);
    setEditValue(messages[index].content);
  }

  async function soumettreEdition() {
    if (editingIndex === null || !editValue.trim()) return;

    // Supprimer tous les messages à partir de ce point en base
    if (currentConvId) {
      // Recharger les IDs et supprimer
      const { data: dbMessages } = await supabase
        .from('conversation_messages')
        .select('id, created_at')
        .eq('conversation_id', currentConvId)
        .order('created_at', { ascending: true });

      if (dbMessages && dbMessages[editingIndex]) {
        const cutoffDate = dbMessages[editingIndex].created_at;
        await supabase
          .from('conversation_messages')
          .delete()
          .eq('conversation_id', currentConvId)
          .gte('created_at', cutoffDate);
      }
    }

    // Tronquer les messages locaux jusqu'à l'index édité
    const truncated = messages.slice(0, editingIndex);
    setMessages(truncated);
    setEditingIndex(null);

    // Renvoyer avec le nouveau texte
    await envoyerMessage(editValue, truncated);
    setEditValue('');
  }

  // ─── Export Word ─────────────────────────────────────────────────────────
  async function exporterWord(content: string, index: number) {
    if (exportingWord !== null) return;
    setExportingWord(index);
    try {
      const res = await fetch('/api/ai/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenu: content,
          titre: profile?.sujet_recherche ? `Rapport — ${profile.sujet_recherche}` : 'Rapport Agent IA',
          auteur: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || undefined,
          sujet: profile?.sujet_recherche ?? '',
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-ia-${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de la génération Word.');
    } finally {
      setExportingWord(null);
    }
  }

  // ─── Ajouter article ─────────────────────────────────────────────────────
  async function ajouterArticleIA(article: ArticleCrossRef, index: number) {
    if (!user || ajoutesIA.has(index)) return;
    await supabase.from('articles').insert({
      user_id: user.id,
      titre: article.titre,
      auteurs: article.auteurs ? article.auteurs.split(',').map((a) => a.trim()) : [],
      annee: article.annee ? Number(article.annee) : null,
      doi: article.doi ?? '',
      url: article.url ?? '',
      notes: article.abstract ?? '',
      tags: [],
      lu: false,
    });
    setAjoutesIA((prev) => new Set(prev).add(index));
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ══ Sidebar conversations ════════════════════════════════════════════ */}
      <div className={`flex flex-col flex-shrink-0 border-r border-gray-100 bg-white transition-all duration-200 ${sidebarOpen ? 'w-52' : 'w-10'}`}>

        {/* Toggle + Nouvelle conv */}
        <div className={`flex items-center border-b border-gray-100 px-2 py-2.5 gap-1 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {sidebarOpen && (
            <button
              onClick={nouvelleConversation}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg font-medium transition-colors flex-1"
              title="Nouvelle conversation"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 flex-shrink-0" />
              Nouveau chat
            </button>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex-shrink-0"
            title={sidebarOpen ? 'Réduire' : 'Ouvrir les conversations'}
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {!sidebarOpen && (
          <button
            onClick={nouvelleConversation}
            className="flex items-center justify-center p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Nouvelle conversation"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        )}

        {/* Liste des conversations */}
        {sidebarOpen && (
          <div className="flex-1 overflow-y-auto py-2">
            {conversations.length === 0 && (
              <p className="text-xs text-gray-300 text-center px-3 py-6 leading-relaxed">
                Vos conversations apparaîtront ici
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative flex items-center px-2 py-1.5 mx-1 rounded-lg cursor-pointer transition-colors ${
                  currentConvId === conv.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
                onClick={() => ouvrirConversation(conv.id)}
              >
                <MessagesSquare className={`w-3.5 h-3.5 flex-shrink-0 mr-2 ${currentConvId === conv.id ? 'text-indigo-500' : 'text-gray-300'}`} />
                <span className="text-xs truncate flex-1 leading-snug pr-1">{conv.titre}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); supprimerConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                  title="Supprimer"
                  disabled={deletingId === conv.id}
                >
                  {deletingId === conv.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Panneau chat ════════════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 border-r border-gray-100">

        {/* En-tête */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Agent IA de MaThèse</p>
              <p className="text-xs text-gray-400 truncate">
                {biblioExistante.length > 0
                  ? `${biblioExistante.length} référence${biblioExistante.length > 1 ? 's' : ''} · Recherche CrossRef intégrée`
                  : 'Recherche d\'articles automatique'}
              </p>
            </div>
            {/* Sélecteur de modèle */}
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setModelMenuOpen((v) => !v); }}
                className="flex items-center gap-1.5 text-xs border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50 rounded-xl px-3 py-1.5 transition-colors"
              >
                <span className={`font-medium ${AI_MODELS.find((m) => m.id === selectedModel)?.color ?? 'text-gray-700'}`}>
                  {AI_MODELS.find((m) => m.id === selectedModel)?.label}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {modelMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-52">
                  {AI_MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={(e) => { e.stopPropagation(); changeModel(m.id); }}
                      className={`w-full flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${selectedModel === m.id ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${m.color}`}>{m.label}</p>
                        <p className="text-xs text-gray-400">{m.desc}</p>
                      </div>
                      {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-gray-50/30">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-0.5">Agent IA de MaThèse</p>
              <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-5">
                Posez une question ou demandez une recherche. L&apos;historique de vos conversations est sauvegardé.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {[
                  'Trouve-moi des articles sur les inégalités scolaires',
                  'Quelles références sont liées à ma problématique ?',
                  'Rédige une synthèse sur la résilience scolaire avec citations APA',
                  'Comment structurer ma revue de littérature ?',
                ].map((s) => (
                  <button key={s} onClick={() => setInput(s)}
                    className="text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2.5 rounded-xl transition-colors border border-indigo-100">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>

              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 px-1">
                  <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <span className={`text-xs font-medium ${AI_MODELS.find((m) => m.id === selectedModel)?.color ?? 'text-gray-500'}`}>
                    {AI_MODELS.find((m) => m.id === selectedModel)?.label ?? 'Agent IA'}
                  </span>
                </div>
              )}

              <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} w-full`}>

                {/* ── Bulle message ── */}
                <div className={`rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'max-w-[80%] bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-br-sm shadow-sm'
                    : 'w-full bg-white border border-gray-200 px-5 py-4 rounded-bl-sm shadow-sm'
                }`}>
                  {msg.role === 'user' ? (
                    editingIndex === i ? (
                      /* Mode édition */
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); soumettreEdition(); } }}
                          rows={3}
                          className="w-full bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/50"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingIndex(null)}
                            className="flex items-center gap-1 text-xs text-white/70 hover:text-white px-2 py-1 rounded-md transition-colors">
                            <X className="w-3 h-3" /> Annuler
                          </button>
                          <button onClick={soumettreEdition}
                            className="flex items-center gap-1 text-xs bg-white text-indigo-700 font-medium px-3 py-1 rounded-md hover:bg-indigo-50 transition-colors">
                            <Send className="w-3 h-3" /> Envoyer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</span>
                    )
                  ) : msg.isError ? (
                    /* ── Bulle d'erreur avec bouton Réessayer ── */
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-red-500">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">La réponse n&apos;a pas pu être générée.</span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        La requête a peut-être pris trop de temps. Pour les rapports longs, essayez de simplifier ou de relancer.
                      </p>
                      {msg.retryFromMessages && (
                        <button
                          onClick={() => {
                            // Retirer le message d'erreur et réessayer
                            const lastUser = msg.retryFromMessages![msg.retryFromMessages!.length - 1];
                            const base = msg.retryFromMessages!.slice(0, -1);
                            setMessages(base);
                            envoyerMessage(lastUser.content, base);
                          }}
                          disabled={chatLoading}
                          className="flex items-center gap-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-xl font-medium transition-colors w-fit"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Réessayer
                        </button>
                      )}
                    </div>
                  ) : msg.content || msg.wordDoc ? (
                    <>
                      {msg.content && <MarkdownMessage content={msg.content} />}
                      {msg.wordDoc && (
                        <WordDocWidget
                          titre={msg.wordDoc.titre}
                          userRequest={msg.wordDoc.userRequest}
                          articles={msg.wordDoc.articles}
                          auteur={[profile?.prenom, profile?.nom].filter(Boolean).join(' ') || undefined}
                          sujet={profile?.sujet_recherche ?? ''}
                        />
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-400 text-xs py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Réflexion en cours...
                    </span>
                  )}
                </div>

                {/* ── Actions à côté de la bulle ── */}
                <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
                  {msg.role === 'user' && editingIndex !== i && (
                    <button onClick={() => commencerEdition(i)}
                      className="p-1.5 text-gray-300 hover:text-indigo-500 transition-colors"
                      title="Modifier ce message">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {msg.role === 'assistant' && msg.content && (
                    <button
                      onClick={async () => { await navigator.clipboard.writeText(msg.content); setCopiedId(i); setTimeout(() => setCopiedId(null), 2000); }}
                      className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                      title="Copier la réponse">
                      {copiedId === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Bannière de statut CrossRef */}
        {searchingStatus && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-50 border-t border-indigo-100 text-xs text-indigo-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            <span className="truncate">{searchingStatus}</span>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage(); } }}
              placeholder="Votre question ou demande de recherche..."
              disabled={chatLoading}
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 resize-none leading-relaxed"
            />
            <button onClick={() => envoyerMessage()} disabled={!input.trim() || chatLoading}
              className="flex items-center justify-center w-10 h-10 self-end bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0">
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-300 mt-1.5 px-1">Maj+Entrée pour sauter une ligne</p>
        </div>
      </div>

      {/* ══ Panneau droit : Documents ════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 min-h-0">
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileSearch className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Documents trouvés</p>
              <p className="text-xs text-gray-400">
                {articlesIA.length > 0
                  ? `${articlesIA.length} article${articlesIA.length > 1 ? 's' : ''}`
                  : 'Via Agent IA · CrossRef'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {articlesIA.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-2">
              <BookOpen className="w-8 h-8 text-gray-200 mb-3" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Demandez à l&apos;Agent IA de trouver des articles — il interrogera CrossRef automatiquement.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-medium">
                Source CrossRef · {articlesIA.length} résultat{articlesIA.length > 1 ? 's' : ''}
              </p>
              {articlesIA.map((article, idx) => (
                <ArticleCardIA key={idx} article={article}
                  ajoute={ajoutesIA.has(idx)}
                  onAjouter={() => ajouterArticleIA(article, idx)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carte article CrossRef ───────────────────────────────────────────────────

function ArticleCardIA({ article, ajoute, onAjouter }: {
  article: ArticleCrossRef;
  ajoute: boolean;
  onAjouter: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="px-3 py-3">
        <p className="text-xs font-medium text-gray-900 leading-snug">{article.titre}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {article.auteurs && <span className="text-xs text-gray-400 truncate max-w-full">{article.auteurs}</span>}
          {article.annee && <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{article.annee}</span>}
          {article.source && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              article.source === 'Semantic Scholar' ? 'bg-blue-50 text-blue-600' :
              article.source === 'OpenAlex' ? 'bg-emerald-50 text-emerald-600' :
              'bg-gray-50 text-gray-500'
            }`}>{article.source}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {ajoute ? (
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg font-medium">
              <CheckCircle2 className="w-3 h-3" /> Ajouté
            </span>
          ) : (
            <button onClick={onAjouter}
              className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1 rounded-lg font-medium transition-colors">
              <Plus className="w-3 h-3" /> Ajouter
            </button>
          )}
          {(article.doi || article.url) && (
            <a href={article.url ?? `https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 px-1.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">
              <ExternalLink className="w-3 h-3" /> Voir
            </a>
          )}
          {article.abstract && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>
      {expanded && article.abstract && (
        <div className="border-t border-gray-50 px-3 py-2 bg-gray-50/50">
          <p className="text-xs text-gray-500 leading-relaxed">{article.abstract}</p>
        </div>
      )}
    </div>
  );
}
