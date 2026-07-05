import React, { useState, useEffect, useRef } from "react";
import { Home, Search, Plus, MessageCircle, User, Bell, ArrowLeft, MoreHorizontal, Heart, MessageSquare, Share2, Bookmark, Shield, Megaphone, Calendar, Crown, FileText, Users, Clock, Settings, Pencil, X, LogOut, Send } from "lucide-react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  documentId,
} from "firebase/firestore";

// ---------- Google Fonts injection ----------
function useFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}

// ---------- Storage helpers ----------
// shared = true  -> data synced across every user/device via Firestore (posts, profils, messages...)
// shared = false -> data kept only on this device (localStorage), rarely needed now that
//                   Firebase Auth itself remembers the session.
const LS_PREFIX = "nexus:";
const KV_COLLECTION = "kv";

const S = {
  async get(key, shared) {
    if (!shared) {
      try {
        const raw = window.localStorage.getItem(LS_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    try {
      const snap = await getDoc(doc(db, KV_COLLECTION, key));
      return snap.exists() ? snap.data().value : null;
    } catch (e) {
      console.error("firestore get failed", key, e);
      return null;
    }
  },
  async set(key, value, shared) {
    if (!shared) {
      try {
        window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        console.error("storage set failed", e);
      }
      return;
    }
    try {
      await setDoc(doc(db, KV_COLLECTION, key), { value });
    } catch (e) {
      console.error("firestore set failed", key, e);
    }
  },
  async list(prefix, shared) {
    if (!shared) {
      try {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(LS_PREFIX + prefix)) keys.push(k.slice(LS_PREFIX.length));
        }
        return keys;
      } catch {
        return [];
      }
    }
    try {
      const q = query(
        collection(db, KV_COLLECTION),
        where(documentId(), ">=", prefix),
        where(documentId(), "<", prefix + "\uf8ff")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.id);
    } catch (e) {
      console.error("firestore list failed", prefix, e);
      return [];
    }
  },
};

// Firebase Auth veut un email : on en fabrique un à partir du nom d'utilisateur.
const usernameToEmail = (username) => `${username}@nexus.local`;

function pairKey(a, b) {
  return [a, b].sort().join("__");
}

const SEED_GROUP = {
  id: "talibes-de-cheikh",
  name: "Talibés de Cheikh",
  description: "Unis par la foi, guidés par le Mouridisme.",
  about:
    "Ce groupe est un espace d'échange, de partage et d'entraide pour tous les talibés mourides du monde entier.",
  membersCount: 12800,
  members: [],
  image:
    "https://images.unsplash.com/photo-1591604080771-4a29908d9d67?q=80&w=1200&auto=format&fit=crop",
};

const SEED_POSTS = [
  {
    id: "seed-1",
    username: "serigne.bassirou",
    name: "Serigne Bassirou Mbacké",
    verified: true,
    time: "2 h",
    content:
      "La voie du Mouridisme est celle du travail, de la foi et du service. Restons unis autour de nos valeurs. 🤎",
    quote: { text: "Travail, Foi, Discipline et Humilité.", author: "Cheikh Ahmadou Bamba" },
    likes: [],
    comments: [],
    shares: 256,
  },
  {
    id: "seed-2",
    username: "awa.mbacke",
    name: "Awa Mbacké",
    verified: false,
    time: "5 h",
    content: "Alhamdoulilah journée de ndigueul à Touba ✨🤎",
    quote: null,
    likes: [],
    comments: [],
    shares: 12,
  },
];

// ---------- Small UI atoms ----------
const Avatar = ({ name, size = 44, gold }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      style={{ width: size, height: size, background: gold ? "#C9A66B" : "#5C4033" }}
      className="rounded-full flex items-center justify-center text-cream font-semibold shrink-0"
    >
      <span style={{ color: "#F7F2E9", fontSize: size * 0.36 }}>{initials}</span>
    </div>
  );
};

const StatusBar = () => (
  <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[13px] font-semibold" style={{ color: "inherit" }}>
    <span>9:41</span>
    <div className="flex items-center gap-1">
      <span>▂▄▆</span>
      <span>▻</span>
      <span>▮</span>
    </div>
  </div>
);

const BottomNav = ({ screen, go, onPlus }) => {
  const items = [
    { key: "feed", label: "Accueil", icon: Home },
    { key: "discover", label: "Découvrir", icon: Search },
    { key: "plus", label: "", icon: Plus },
    { key: "messages", label: "Messages", icon: MessageCircle },
    { key: "profile", label: "Profil", icon: User },
  ];
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: "#E4DCCB", background: "#FBF8F2" }}>
      {items.map((it) => {
        const Icon = it.icon;
        if (it.key === "plus") {
          return (
            <button
              key="plus"
              onClick={onPlus}
              className="w-12 h-12 rounded-full flex items-center justify-center -mt-2 shadow-md"
              style={{ background: "#3E2B22" }}
            >
              <Icon size={22} color="#F7F2E9" />
            </button>
          );
        }
        const active = screen === it.key;
        return (
          <button key={it.key} onClick={() => go(it.key)} className="flex flex-col items-center gap-1 px-2">
            <Icon size={22} color={active ? "#3E2B22" : "#A99783"} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[11px]" style={{ color: active ? "#3E2B22" : "#A99783", fontWeight: active ? 600 : 500 }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ---------- Screens ----------

function Splash({ go }) {
  return (
    <div
      className="h-full flex flex-col items-center justify-between px-8 pb-10 pt-6"
      style={{ background: "linear-gradient(160deg,#3E2B22 0%,#2B1D14 100%)", color: "#F7F2E9" }}
    >
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: "rgba(247,242,233,0.08)" }}>
          <span style={{ fontFamily: "Playfair Display", fontSize: 40, fontWeight: 700 }}>M</span>
        </div>
        <div>
          <h1 style={{ fontFamily: "Playfair Display", fontSize: 30, letterSpacing: 4, fontWeight: 700 }}>NEXUS</h1>
          <p style={{ letterSpacing: 6, fontSize: 13, opacity: 0.8, marginTop: 2 }}>MOURIDE</p>
        </div>
        <div className="w-16 h-px" style={{ background: "rgba(247,242,233,0.3)" }} />
        <p style={{ opacity: 0.75, fontSize: 14, lineHeight: 1.6 }}>
          Le réseau social
          <br />
          au cœur du Mouridisme
        </p>
      </div>
      <div className="w-full flex flex-col gap-3">
        <button
          onClick={() => go("signup")}
          className="w-full py-3.5 rounded-full font-semibold text-[15px]"
          style={{ background: "#F7F2E9", color: "#2B1D14" }}
        >
          Commencer
        </button>
        <button
          onClick={() => go("login")}
          className="w-full py-3.5 rounded-full font-semibold text-[15px] border"
          style={{ borderColor: "rgba(247,242,233,0.4)", color: "#F7F2E9" }}
        >
          Se connecter
        </button>
      </div>
    </div>
  );
}

function AuthForm({ mode, go, onAuth }) {
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!username || !password || (isSignup && !name)) {
      setError("Merci de remplir tous les champs.");
      return;
    }
    const uname = username.toLowerCase().trim();
    const key = `user:${uname}`;
    const email = usernameToEmail(uname);
    setLoading(true);
    try {
      if (isSignup) {
        const existing = await S.get(key, true);
        if (existing) {
          setError("Ce nom d'utilisateur existe déjà.");
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        const user = {
          username: uname,
          name,
          bio: "Talibé mouride",
          premium: false,
          groups: ["talibes-de-cheikh"],
          followers: [],
          following: [],
          joinedAt: Date.now(),
        };
        await S.set(key, user, true);
        onAuth(user);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        const existing = await S.get(key, true);
        if (!existing) {
          setError("Profil introuvable pour ce compte.");
          setLoading(false);
          return;
        }
        onAuth(existing);
      }
    } catch (e) {
      console.error(e);
      if (e.code === "auth/email-already-in-use") setError("Ce nom d'utilisateur existe déjà.");
      else if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(e.code))
        setError("Identifiants incorrects.");
      else if (e.code === "auth/weak-password") setError("Mot de passe trop court (6 caractères min).");
      else setError("Une erreur est survenue. Réessaie.");
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col px-7 pt-4 pb-8" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <button onClick={() => go("splash")} className="mt-2 mb-6">
        <ArrowLeft size={22} color="#2B1D14" />
      </button>
      <h2 style={{ fontFamily: "Playfair Display", fontSize: 26, color: "#2B1D14", fontWeight: 700 }}>
        {isSignup ? "Créer un compte" : "Se connecter"}
      </h2>
      <p className="mt-1 mb-8 text-[14px]" style={{ color: "#8A7A6D" }}>
        {isSignup ? "Rejoins la communauté Nexus Mouride" : "Content de te revoir"}
      </p>

      <div className="flex flex-col gap-4">
        {isSignup && (
          <div>
            <label className="text-[13px] font-medium" style={{ color: "#5C4033" }}>Nom complet</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mouhamed Lo"
              className="w-full mt-1.5 px-4 py-3 rounded-xl border text-[15px] outline-none"
              style={{ borderColor: "#E4DCCB", background: "#fff", color: "#2B1D14" }}
            />
          </div>
        )}
        <div>
          <label className="text-[13px] font-medium" style={{ color: "#5C4033" }}>Nom d'utilisateur</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="mouhamedl"
            className="w-full mt-1.5 px-4 py-3 rounded-xl border text-[15px] outline-none"
            style={{ borderColor: "#E4DCCB", background: "#fff", color: "#2B1D14" }}
          />
        </div>
        <div>
          <label className="text-[13px] font-medium" style={{ color: "#5C4033" }}>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full mt-1.5 px-4 py-3 rounded-xl border text-[15px] outline-none"
            style={{ borderColor: "#E4DCCB", background: "#fff", color: "#2B1D14" }}
          />
        </div>
        {error && <p className="text-[13px]" style={{ color: "#B3543A" }}>{error}</p>}
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="w-full py-3.5 rounded-full font-semibold text-[15px] mt-8"
        style={{ background: "#3E2B22", color: "#F7F2E9" }}
      >
        {loading ? "..." : isSignup ? "Créer mon compte" : "Se connecter"}
      </button>

      <button
        onClick={() => go(isSignup ? "login" : "signup")}
        className="mt-4 text-[14px] text-center"
        style={{ color: "#8A7A6D" }}
      >
        {isSignup ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
      </button>
    </div>
  );
}

function QuoteCard({ quote }) {
  return (
    <div
      className="mt-3 rounded-2xl overflow-hidden px-5 py-6 relative"
      style={{
        background:
          "linear-gradient(160deg, rgba(62,43,34,0.92), rgba(43,29,20,0.94)), url(https://images.unsplash.com/photo-1591604080771-4a29908d9d67?q=80&w=1200&auto=format&fit=crop) center/cover",
      }}
    >
      <p style={{ fontFamily: "Playfair Display", color: "#F7F2E9", fontSize: 22, fontWeight: 600, lineHeight: 1.35 }}>
        "{quote.text}"
      </p>
      <p style={{ color: "rgba(247,242,233,0.7)", fontSize: 13, marginTop: 14 }}>— {quote.author}</p>
    </div>
  );
}

function Post({ post, currentUser, onLike, onComment }) {
  const [showComment, setShowComment] = useState(false);
  const [text, setText] = useState("");
  const liked = post.likes.includes(currentUser?.username);
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: "#EFE9DD" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={post.name} size={40} />
          <div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[14.5px]" style={{ color: "#2B1D14" }}>{post.name}</span>
              {post.verified && <Shield size={13} color="#C9A66B" fill="#C9A66B" />}
            </div>
            <span className="text-[12px]" style={{ color: "#A99783" }}>{post.time}</span>
          </div>
        </div>
        <MoreHorizontal size={18} color="#A99783" />
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "#3B2C22" }}>{post.content}</p>
      {post.quote && <QuoteCard quote={post.quote} />}
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => onLike(post.id)} className="flex items-center gap-1.5">
          <Heart size={19} color={liked ? "#B3543A" : "#A99783"} fill={liked ? "#B3543A" : "none"} />
          <span className="text-[13px]" style={{ color: "#8A7A6D" }}>{post.likes.length}</span>
        </button>
        <button onClick={() => setShowComment((s) => !s)} className="flex items-center gap-1.5">
          <MessageSquare size={19} color="#A99783" />
          <span className="text-[13px]" style={{ color: "#8A7A6D" }}>{post.comments.length}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <Share2 size={19} color="#A99783" />
          <span className="text-[13px]" style={{ color: "#8A7A6D" }}>{post.shares || 0}</span>
        </div>
        <Bookmark size={19} color="#A99783" />
      </div>
      {showComment && (
        <div className="mt-3 flex flex-col gap-2">
          {post.comments.map((c, i) => (
            <div key={i} className="text-[13px]" style={{ color: "#5C4033" }}>
              <b>{c.name}</b> {c.text}
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Écrire un commentaire..."
              className="flex-1 px-3 py-2 rounded-full border text-[13px] outline-none"
              style={{ borderColor: "#E4DCCB" }}
            />
            <button
              onClick={() => {
                if (!text.trim()) return;
                onComment(post.id, text);
                setText("");
              }}
              className="px-4 py-2 rounded-full text-[13px] font-medium"
              style={{ background: "#3E2B22", color: "#F7F2E9" }}
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Feed({ currentUser, posts, setPosts, go }) {
  const [tab, setTab] = useState("pourvous");

  const persist = async (next) => {
    setPosts(next);
    await S.set("posts", next, true);
  };

  const onLike = (id) => {
    const next = posts.map((p) => {
      if (p.id !== id) return p;
      const has = p.likes.includes(currentUser.username);
      return { ...p, likes: has ? p.likes.filter((u) => u !== currentUser.username) : [...p.likes, currentUser.username] };
    });
    persist(next);
  };

  const onComment = (id, text) => {
    const next = posts.map((p) =>
      p.id === id ? { ...p, comments: [...p.comments, { name: currentUser.name, text }] } : p
    );
    persist(next);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#3E2B22" }}>
            <span style={{ color: "#F7F2E9", fontFamily: "Playfair Display", fontWeight: 700, fontSize: 15 }}>M</span>
          </div>
          <div>
            <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 15, color: "#2B1D14" }}>NEXUS</div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#A99783" }}>MOURIDE</div>
          </div>
        </div>
        <Bell size={20} color="#3E2B22" />
      </div>

      <div className="flex gap-6 px-5 overflow-x-auto pb-3">
        {[
          { label: "Ajouter", icon: <Plus size={20} color="#5C4033" /> },
          { label: currentUser.name.split(" ")[0], avatar: true },
          { label: "Touba", icon: <span style={{ fontSize: 18 }}>🕌</span> },
          { label: "Talibés", icon: <Users size={19} color="#5C4033" />, onClick: () => go("group") },
          { label: "Plus", icon: <span style={{ fontSize: 18 }}>▦</span> },
        ].map((it, i) => (
          <button key={i} onClick={it.onClick} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-14 h-14 rounded-full flex items-center justify-center border" style={{ borderColor: "#E4DCCB", background: "#fff" }}>
              {it.avatar ? <Avatar name={currentUser.name} size={54} /> : it.icon}
            </div>
            <span className="text-[11px]" style={{ color: "#5C4033" }}>{it.label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 px-5 pb-3">
        {[
          { k: "pourvous", label: "Pour vous" },
          { k: "abonnements", label: "Abonnements" },
          { k: "groupes", label: "Groupes" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => (t.k === "groupes" ? go("group") : setTab(t.k))}
            className="px-4 py-1.5 rounded-full text-[13px] font-medium"
            style={{
              background: tab === t.k ? "#3E2B22" : "#F0EAdd",
              color: tab === t.k ? "#F7F2E9" : "#5C4033",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {posts.map((p) => (
          <Post key={p.id} post={p} currentUser={currentUser} onLike={onLike} onComment={onComment} />
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}

function CreatePost({ currentUser, posts, setPosts, go }) {
  const [text, setText] = useState("");
  const submit = async () => {
    if (!text.trim()) return;
    const newPost = {
      id: "p-" + Date.now(),
      username: currentUser.username,
      name: currentUser.name,
      verified: false,
      time: "à l'instant",
      content: text,
      quote: null,
      likes: [],
      comments: [],
      shares: 0,
    };
    const next = [newPost, ...posts];
    setPosts(next);
    await S.set("posts", next, true);
    go("feed");
  };
  return (
    <div className="h-full flex flex-col px-5 pt-2 pb-6" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="flex items-center justify-between mt-2 mb-5">
        <button onClick={() => go("feed")}><X size={22} color="#2B1D14" /></button>
        <span className="font-semibold text-[15px]" style={{ color: "#2B1D14" }}>Nouvelle publication</span>
        <button
          onClick={submit}
          className="px-4 py-1.5 rounded-full text-[13px] font-semibold"
          style={{ background: "#3E2B22", color: "#F7F2E9" }}
        >
          Publier
        </button>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={currentUser.name} size={40} />
        <span className="font-medium text-[14px]" style={{ color: "#2B1D14" }}>{currentUser.name}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Partage une pensée, un ndigueul, un moment..."
        className="flex-1 outline-none text-[16px] resize-none bg-transparent"
        style={{ color: "#2B1D14" }}
        autoFocus
      />
    </div>
  );
}

function GroupScreen({ group, setGroup, currentUser, go }) {
  const isMember = group.members.includes(currentUser.username);
  const [tab, setTab] = useState("apropos");

  const join = async () => {
    const next = { ...group, members: isMember ? group.members.filter((m) => m !== currentUser.username) : [...group.members, currentUser.username] };
    setGroup(next);
    await S.set("groups:talibes-de-cheikh", next, true);
  };

  const totalMembers = group.membersCount + group.members.length;

  return (
    <div className="h-full flex flex-col" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-2">
        <button onClick={() => go("feed")} className="flex items-center gap-3">
          <ArrowLeft size={20} color="#2B1D14" />
          <span className="font-semibold text-[16px]" style={{ color: "#2B1D14" }}>Groupe</span>
        </button>
        <MoreHorizontal size={20} color="#2B1D14" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div
          className="h-40 mx-5 rounded-2xl mt-2 flex items-end p-4"
          style={{ background: `linear-gradient(180deg, rgba(62,43,34,0.1), rgba(43,29,20,0.75)), url(${group.image}) center/cover` }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(247,242,233,0.9)" }}>
            <Users size={22} color="#3E2B22" />
          </div>
        </div>
        <div className="px-5 mt-4">
          <div className="flex items-center gap-1.5">
            <h2 style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 21, color: "#2B1D14" }}>{group.name}</h2>
            <Shield size={15} color="#C9A66B" fill="#C9A66B" />
          </div>
          <p className="text-[13px] mt-1" style={{ color: "#A99783" }}>
            Groupe public • {(totalMembers / 1000).toFixed(1)}K membres
          </p>
          <p className="text-[14px] mt-3" style={{ color: "#3B2C22" }}>{group.description}</p>

          <div className="flex gap-2 mt-5 overflow-x-auto">
            {["À propos", "Publications", "Membres", "Média"].map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(t.toLowerCase().replace(" ", ""))}
                className="px-4 py-1.5 rounded-full text-[13px] font-medium shrink-0"
                style={{ background: i === 0 ? "#3E2B22" : "#F0EAdd", color: i === 0 ? "#F7F2E9" : "#5C4033" }}
              >
                {t}
              </button>
            ))}
          </div>

          <h3 className="font-semibold text-[15px] mt-6 mb-2" style={{ color: "#2B1D14" }}>À propos du groupe</h3>
          <p className="text-[14px] leading-relaxed" style={{ color: "#5C4033" }}>{group.about}</p>

          <div className="mt-4 flex flex-col divide-y" style={{ borderColor: "#EFE9DD" }}>
            {[
              { icon: Shield, label: "Règles du groupe" },
              { icon: Megaphone, label: "Annonces" },
              { icon: Calendar, label: "Événements" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: "#EFE9DD" }}>
                <div className="flex items-center gap-3">
                  <r.icon size={18} color="#5C4033" />
                  <span className="text-[14px]" style={{ color: "#2B1D14" }}>{r.label}</span>
                </div>
                <span style={{ color: "#C9BBA8" }}>›</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <button
          onClick={join}
          className="w-full py-3.5 rounded-full font-semibold text-[15px] flex items-center justify-center gap-2"
          style={{ background: isMember ? "#EFE9DD" : "#3E2B22", color: isMember ? "#5C4033" : "#F7F2E9" }}
        >
          <Users size={17} />
          {isMember ? "Membre du groupe" : "Rejoindre le groupe"}
        </button>
      </div>
    </div>
  );
}

function ProfileScreen({ currentUser, posts, group, go, onLogout }) {
  const myPosts = posts.filter((p) => p.username === currentUser.username);
  return (
    <div className="h-full flex flex-col" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-2">
        <button onClick={() => go("feed")}><ArrowLeft size={20} color="#2B1D14" /></button>
        <div className="flex items-center gap-4">
          <Pencil size={18} color="#2B1D14" />
          <button onClick={onLogout}><LogOut size={18} color="#2B1D14" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="h-28 mx-5 rounded-2xl mt-1" style={{ background: `linear-gradient(180deg, rgba(62,43,34,0.15), rgba(43,29,20,0.85)), url(${group.image}) center/cover` }} />
        <div className="px-5 -mt-9">
          <Avatar name={currentUser.name} size={72} />
        </div>
        <div className="px-5 mt-3">
          <div className="flex items-center gap-1.5">
            <h2 style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 21, color: "#2B1D14" }}>{currentUser.name}</h2>
            <Shield size={15} color="#C9A66B" fill="#C9A66B" />
          </div>
          <p className="text-[13px]" style={{ color: "#A99783" }}>@{currentUser.username}</p>
          <p className="text-[13.5px] mt-2" style={{ color: "#5C4033" }}>
            {currentUser.bio} • Disciple de Cheikh Ahmadou Bamba
            <br />
            Travail • Foi • Discipline • Humilité 🤎
          </p>

          <div className="flex gap-8 mt-4">
            {[
              { n: myPosts.length, l: "Publications" },
              { n: currentUser.followers.length, l: "Abonnés" },
              { n: currentUser.following.length, l: "Abonnements" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-bold text-[16px]" style={{ color: "#2B1D14" }}>{s.n}</div>
                <div className="text-[12px]" style={{ color: "#A99783" }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 px-4 py-3 rounded-xl" style={{ background: "#F0EAdd" }}>
            <div className="flex items-center gap-2">
              <Crown size={18} color="#C9A66B" />
              <div>
                <div className="text-[13.5px] font-semibold" style={{ color: "#2B1D14" }}>NEXUS PREMIUM</div>
                <div className="text-[11.5px]" style={{ color: "#A99783" }}>
                  {currentUser.premium ? "Membre Premium" : "Passer en Premium"}
                </div>
              </div>
            </div>
            <button className="px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ background: "#3E2B22", color: "#F7F2E9" }}>
              Gérer
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-5">
            {[
              { icon: FileText, label: "Mes publications" },
              { icon: Bookmark, label: "Enregistrés" },
              { icon: Users, label: "Mes groupes", onClick: () => go("group") },
              { icon: Clock, label: "Historique" },
            ].map((it) => (
              <button key={it.label} onClick={it.onClick} className="flex flex-col items-center gap-2 py-3 rounded-xl" style={{ background: "#fff", border: "1px solid #EFE9DD" }}>
                <it.icon size={19} color="#5C4033" />
                <span className="text-[10.5px] text-center leading-tight" style={{ color: "#5C4033" }}>{it.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 mb-2">
            <h3 className="font-semibold text-[15px]" style={{ color: "#2B1D14" }}>Récentes activités</h3>
            <span className="text-[13px]" style={{ color: "#8A7A6D" }}>Voir tout</span>
          </div>
          {myPosts.length === 0 && (
            <p className="text-[13px] pb-6" style={{ color: "#A99783" }}>Aucune publication pour l'instant.</p>
          )}
          {myPosts.slice(0, 3).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#EFE9DD" }}>
              <div className="flex items-center gap-3">
                <Users size={16} color="#5C4033" />
                <div>
                  <div className="text-[13px]" style={{ color: "#5C4033" }}>Vous avez publié</div>
                  <div className="text-[12px]" style={{ color: "#A99783" }}>{p.time}</div>
                </div>
              </div>
            </div>
          ))}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}

function DiscoverScreen({ currentUser, group, go, startChat }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const keys = await S.list("user:", true);
      const all = await Promise.all(keys.map((k) => S.get(k, true)));
      setUsers(all.filter((u) => u && u.username !== currentUser.username));
      setLoading(false);
    })();
  }, []);

  const q = query.trim().toLowerCase();
  const filteredUsers = q
    ? users.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    : users;
  const groupMatches = !q || group.name.toLowerCase().includes(q);

  return (
    <div className="h-full flex flex-col" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-3">
        <h2 style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 21, color: "#2B1D14" }}>Découvrir</h2>
        <div className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-full" style={{ background: "#F0EAdd" }}>
          <Search size={17} color="#A99783" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher des talibés, groupes..."
            className="flex-1 bg-transparent outline-none text-[14px]"
            style={{ color: "#2B1D14" }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {groupMatches && (
          <>
            <h3 className="text-[13px] font-semibold mb-2" style={{ color: "#A99783" }}>GROUPES</h3>
            <button
              onClick={() => go("group")}
              className="w-full flex items-center gap-3 p-3 rounded-xl mb-4"
              style={{ background: "#fff", border: "1px solid #EFE9DD" }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#3E2B22" }}>
                <Users size={20} color="#F7F2E9" />
              </div>
              <div className="text-left">
                <div className="font-medium text-[14px]" style={{ color: "#2B1D14" }}>{group.name}</div>
                <div className="text-[12px]" style={{ color: "#A99783" }}>
                  {((group.membersCount + group.members.length) / 1000).toFixed(1)}K membres
                </div>
              </div>
            </button>
          </>
        )}

        <h3 className="text-[13px] font-semibold mb-2" style={{ color: "#A99783" }}>TALIBÉS</h3>
        {loading && <p className="text-[13px]" style={{ color: "#A99783" }}>Chargement...</p>}
        {!loading && filteredUsers.length === 0 && (
          <p className="text-[13px] pb-6" style={{ color: "#A99783" }}>Aucun résultat.</p>
        )}
        {filteredUsers.map((u) => (
          <div key={u.username} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#EFE9DD" }}>
            <div className="flex items-center gap-3">
              <Avatar name={u.name} size={42} />
              <div>
                <div className="font-medium text-[14px]" style={{ color: "#2B1D14" }}>{u.name}</div>
                <div className="text-[12px]" style={{ color: "#A99783" }}>@{u.username}</div>
              </div>
            </div>
            <button
              onClick={() => startChat(u)}
              className="px-3.5 py-1.5 rounded-full text-[12.5px] font-medium"
              style={{ background: "#3E2B22", color: "#F7F2E9" }}
            >
              Message
            </button>
          </div>
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}

function MessagesScreen({ currentUser, go, startChat }) {
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await S.get(`inbox:${currentUser.username}`, true);
      setInbox(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="h-full flex flex-col" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="px-5 pt-2 pb-3">
        <h2 style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 21, color: "#2B1D14" }}>Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {loading && <p className="text-[13px]" style={{ color: "#A99783" }}>Chargement...</p>}
        {!loading && inbox.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-16 gap-3">
            <MessageCircle size={32} color="#C9BBA8" />
            <p className="text-[14px] text-center" style={{ color: "#A99783" }}>
              Aucune conversation.
              <br />
              Va dans Découvrir pour écrire à un talibé.
            </p>
            <button
              onClick={() => go("discover")}
              className="px-4 py-2 rounded-full text-[13px] font-medium mt-1"
              style={{ background: "#3E2B22", color: "#F7F2E9" }}
            >
              Découvrir
            </button>
          </div>
        )}
        {inbox
          .slice()
          .sort((a, b) => b.lastTime - a.lastTime)
          .map((c) => (
            <button
              key={c.peer}
              onClick={() => startChat({ username: c.peer, name: c.peerName })}
              className="w-full flex items-center gap-3 py-3.5 border-b text-left"
              style={{ borderColor: "#EFE9DD" }}
            >
              <Avatar name={c.peerName} size={46} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[14.5px]" style={{ color: "#2B1D14" }}>{c.peerName}</div>
                <div className="text-[13px] truncate" style={{ color: "#A99783" }}>{c.lastText}</div>
              </div>
            </button>
          ))}
        <div className="h-4" />
      </div>
    </div>
  );
}

function ChatThread({ currentUser, peer, go }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const key = `chat:${pairKey(currentUser.username, peer.username)}`;

  useEffect(() => {
    (async () => {
      const data = await S.get(key, true);
      setMessages(data || []);
      setLoading(false);
    })();
  }, [key]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  const send = async () => {
    if (!text.trim()) return;
    const msg = { from: currentUser.username, text: text.trim(), ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    setText("");
    await S.set(key, next, true);

    const now = Date.now();
    const [myInbox, peerInbox] = await Promise.all([
      S.get(`inbox:${currentUser.username}`, true),
      S.get(`inbox:${peer.username}`, true),
    ]);
    const updateInbox = (list, peerUsername, peerName, previewOwner) => {
      const arr = list ? [...list] : [];
      const idx = arr.findIndex((c) => c.peer === peerUsername);
      const entry = { peer: peerUsername, peerName, lastText: msg.text, lastTime: now };
      if (idx >= 0) arr[idx] = entry;
      else arr.push(entry);
      return arr;
    };
    await S.set(`inbox:${currentUser.username}`, updateInbox(myInbox, peer.username, peer.name), true);
    await S.set(`inbox:${peer.username}`, updateInbox(peerInbox, currentUser.username, currentUser.name), true);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "#FBF8F2" }}>
      <StatusBar />
      <div className="flex items-center gap-3 px-5 pt-2 pb-3 border-b" style={{ borderColor: "#EFE9DD" }}>
        <button onClick={() => go("messages")}><ArrowLeft size={20} color="#2B1D14" /></button>
        <Avatar name={peer.name} size={36} />
        <span className="font-semibold text-[15px]" style={{ color: "#2B1D14" }}>{peer.name}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {loading && <p className="text-[13px] text-center" style={{ color: "#A99783" }}>Chargement...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-[13px] text-center mt-8" style={{ color: "#A99783" }}>
            Dis salam à {peer.name.split(" ")[0]} 👋
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.from === currentUser.username;
          return (
            <div key={i} className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[14px] ${mine ? "self-end" : "self-start"}`}
              style={{
                background: mine ? "#3E2B22" : "#F0EAdd",
                color: mine ? "#F7F2E9" : "#2B1D14",
                borderBottomRightRadius: mine ? 4 : 16,
                borderBottomLeftRadius: mine ? 16 : 4,
              }}
            >
              {m.text}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: "#EFE9DD" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Écrire un message..."
          className="flex-1 px-4 py-2.5 rounded-full border text-[14px] outline-none"
          style={{ borderColor: "#E4DCCB", background: "#fff", color: "#2B1D14" }}
        />
        <button onClick={send} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#3E2B22" }}>
          <Send size={16} color="#F7F2E9" />
        </button>
      </div>
    </div>
  );
}

// ---------- Root App ----------
export default function App() {
  useFonts();
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState("splash");
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState(SEED_POSTS);
  const [group, setGroup] = useState(SEED_GROUP);
  const [activePeer, setActivePeer] = useState(null);

  useEffect(() => {
    (async () => {
      const [savedPosts, savedGroup] = await Promise.all([
        S.get("posts", true),
        S.get("groups:talibes-de-cheikh", true),
      ]);
      if (savedPosts) setPosts(savedPosts);
      else await S.set("posts", SEED_POSTS, true);

      if (savedGroup) setGroup(savedGroup);
      else await S.set("groups:talibes-de-cheikh", SEED_GROUP, true);
    })();

    // Firebase Auth restaure la session automatiquement (même après un
    // rechargement de page), donc on écoute juste les changements d'état.
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser?.email) {
        const uname = fbUser.email.split("@")[0];
        const user = await S.get(`user:${uname}`, true);
        if (user) {
          setCurrentUser(user);
          setScreen((s) => (["splash", "login", "signup"].includes(s) ? "feed" : s));
        }
      } else {
        setCurrentUser(null);
      }
      setReady(true);
    });
    return unsubscribe;
  }, []);

  const handleAuth = (user) => {
    setCurrentUser(user);
    setScreen("feed");
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setScreen("splash");
  };

  const go = (s) => setScreen(s);

  const startChat = (peer) => {
    setActivePeer(peer);
    setScreen("chat");
  };

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#3E2B22" }}>
        <span style={{ color: "#F7F2E9", fontFamily: "Playfair Display" }}>M</span>
      </div>
    );
  }

  let body;
  if (screen === "splash") body = <Splash go={go} />;
  else if (screen === "signup") body = <AuthForm mode="signup" go={go} onAuth={handleAuth} />;
  else if (screen === "login") body = <AuthForm mode="login" go={go} onAuth={handleAuth} />;
  else if (screen === "feed") body = <Feed currentUser={currentUser} posts={posts} setPosts={setPosts} go={go} />;
  else if (screen === "plus") body = <CreatePost currentUser={currentUser} posts={posts} setPosts={setPosts} go={go} />;
  else if (screen === "group") body = <GroupScreen group={group} setGroup={setGroup} currentUser={currentUser} go={go} />;
  else if (screen === "profile") body = <ProfileScreen currentUser={currentUser} posts={posts} group={group} go={go} onLogout={handleLogout} />;
  else if (screen === "discover") body = <DiscoverScreen currentUser={currentUser} group={group} go={go} startChat={startChat} />;
  else if (screen === "messages") body = <MessagesScreen currentUser={currentUser} go={go} startChat={startChat} />;
  else if (screen === "chat" && activePeer) body = <ChatThread currentUser={currentUser} peer={activePeer} go={go} />;
  else body = <div className="h-full flex items-center justify-center" style={{ color: "#8A7A6D" }}>Bientôt disponible</div>;

  const showNav = currentUser && !["splash", "login", "signup", "plus", "chat"].includes(screen);

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#E9E2D3", fontFamily: "Inter, sans-serif" }}>
      <div className="w-[380px] h-[780px] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col" style={{ background: "#FBF8F2" }}>
        <div className="flex-1 overflow-hidden flex flex-col">{body}</div>
        {showNav && <BottomNav screen={screen} go={go} onPlus={() => go("plus")} />}
      </div>
    </div>
  );
}
